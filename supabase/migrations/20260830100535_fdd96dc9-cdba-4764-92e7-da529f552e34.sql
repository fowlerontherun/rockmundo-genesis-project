ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS absence_alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS absent_member_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absence_decision text,
  ADD COLUMN IF NOT EXISTS absence_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS absence_decided_by_profile_id uuid,
  ADD COLUMN IF NOT EXISTS absence_quality_penalty numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.notify_gig_absent_members()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gig record;
  v_absent integer;
  v_present integer;
  v_total integer;
  v_absent_names text;
  v_leader_user uuid;
  v_notified integer := 0;
  v_checked integer := 0;
  v_penalty numeric;
BEGIN
  FOR v_gig IN
    SELECT g.id, g.band_id, g.scheduled_date, v.city_id AS venue_city_id,
           coalesce(v.name, 'the venue') AS venue_name, b.leader_id, b.name AS band_name
    FROM public.gigs g
    LEFT JOIN public.venues v ON v.id = g.venue_id
    LEFT JOIN public.bands b ON b.id = g.band_id
    WHERE g.status = 'scheduled'
      AND g.started_at IS NULL
      AND g.absence_alert_sent_at IS NULL
      AND g.absence_decision IS NULL
      AND g.scheduled_date > now()
      AND g.scheduled_date <= now() + interval '30 minutes'
  LOOP
    v_checked := v_checked + 1;

    SELECT
      count(*),
      count(*) FILTER (WHERE p.current_city_id IS DISTINCT FROM v_gig.venue_city_id OR coalesce(p.is_traveling, false)),
      count(*) FILTER (WHERE p.current_city_id = v_gig.venue_city_id AND coalesce(p.is_traveling, false) = false),
      string_agg(p.display_name, ', ') FILTER (WHERE p.current_city_id IS DISTINCT FROM v_gig.venue_city_id OR coalesce(p.is_traveling, false))
    INTO v_total, v_absent, v_present, v_absent_names
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = v_gig.band_id
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(p.is_active, true) = true
      AND p.died_at IS NULL;

    IF coalesce(v_absent, 0) = 0 THEN
      CONTINUE;
    END IF;

    v_penalty := LEAST(0.6, (v_absent::numeric / GREATEST(v_total, 1)) * 0.75);

    UPDATE public.gigs
    SET absence_alert_sent_at = now(),
        absent_member_count = v_absent,
        updated_at = now()
    WHERE id = v_gig.id;

    SELECT user_id INTO v_leader_user FROM public.profiles WHERE id = v_gig.leader_id;

    IF v_leader_user IS NOT NULL THEN
      INSERT INTO public.player_inbox (
        user_id, category, priority, title, message, metadata,
        action_type, action_data, related_entity_type, related_entity_id, expires_at
      ) VALUES (
        v_leader_user,
        'gig_result',
        'urgent',
        format('⚠️ %s band member(s) missing for %s', v_absent, v_gig.venue_name),
        format(
          'Your gig at %s starts in under 30 minutes and %s of %s members are not at the venue%s.'
          || E'\n\nPerform without them: the show goes ahead with a %s%% performance quality penalty.'
          || E'\nPull the gig: the show fails and your band loses fans, fan sentiment and fame.',
          v_gig.venue_name, v_absent, v_total,
          CASE WHEN v_absent_names IS NULL THEN '' ELSE ' (' || v_absent_names || ')' END,
          round(v_penalty * 100)
        ),
        jsonb_build_object(
          'gig_id', v_gig.id,
          'band_id', v_gig.band_id,
          'absent_members', v_absent,
          'present_members', v_present,
          'total_members', v_total,
          'absent_names', v_absent_names,
          'quality_penalty', v_penalty,
          'scheduled_date', v_gig.scheduled_date
        ),
        'gig_absence_decision',
        jsonb_build_object('gigId', v_gig.id, 'route', '/gigs'),
        'gig',
        v_gig.id,
        v_gig.scheduled_date + interval '6 hours'
      );
      v_notified := v_notified + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('totalChecked', v_checked, 'notified', v_notified);
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_gig_absence(p_gig_id uuid, p_decision text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  g public.gigs%ROWTYPE;
  v_leader uuid;
  v_band_name text;
  v_total integer;
  v_absent integer;
  v_venue_city uuid;
  v_penalty numeric;
  v_fan_loss integer := 0;
  v_fame_loss integer := 0;
BEGIN
  IF p_decision NOT IN ('perform', 'cancel') THEN
    RAISE EXCEPTION 'invalid_decision:%', p_decision;
  END IF;

  SELECT * INTO g FROM public.gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'gig_not_found' USING ERRCODE='P0002'; END IF;

  SELECT b.leader_id, b.name INTO v_leader, v_band_name FROM public.bands b WHERE b.id = g.band_id;

  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_leader AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_authorised' USING ERRCODE='42501';
  END IF;

  IF g.absence_decision IS NOT NULL THEN
    RETURN jsonb_build_object('alreadyDecided', true, 'decision', g.absence_decision);
  END IF;
  IF g.status <> 'scheduled' THEN
    RAISE EXCEPTION 'gig_decision_not_available_from_status:%', g.status;
  END IF;

  SELECT city_id INTO v_venue_city FROM public.venues WHERE id = g.venue_id;

  SELECT
    count(*),
    count(*) FILTER (WHERE p.current_city_id IS DISTINCT FROM v_venue_city OR coalesce(p.is_traveling, false))
  INTO v_total, v_absent
  FROM public.band_members bm
  JOIN public.profiles p ON p.id = bm.profile_id
  WHERE bm.band_id = g.band_id
    AND coalesce(bm.member_status, 'active') = 'active'
    AND coalesce(p.is_active, true) = true
    AND p.died_at IS NULL;

  v_penalty := LEAST(0.6, (coalesce(v_absent, 0)::numeric / GREATEST(v_total, 1)) * 0.75);

  IF p_decision = 'perform' THEN
    UPDATE public.gigs
    SET absence_decision = 'perform',
        absence_decision_at = now(),
        absence_decided_by_profile_id = v_leader,
        absent_member_count = coalesce(v_absent, 0),
        absence_quality_penalty = v_penalty,
        failure_reason = NULL,
        updated_at = now()
    WHERE id = p_gig_id;

    RETURN jsonb_build_object(
      'decision', 'perform',
      'absentMembers', coalesce(v_absent, 0),
      'qualityPenalty', v_penalty
    );
  END IF;

  -- Cancel: the show fails and the band pays in fans, sentiment and fame.
  SELECT GREATEST(1, floor(coalesce(b.total_fans, 0) * 0.03))::integer,
         GREATEST(1, floor(coalesce(b.fame, 0) * 0.04))::integer
  INTO v_fan_loss, v_fame_loss
  FROM public.bands b WHERE b.id = g.band_id;

  UPDATE public.bands
  SET total_fans = GREATEST(0, coalesce(total_fans, 0) - v_fan_loss),
      casual_fans = GREATEST(0, coalesce(casual_fans, 0) - v_fan_loss),
      fame = GREATEST(0, coalesce(fame, 0) - v_fame_loss),
      popularity = GREATEST(0, coalesce(popularity, 0) - 2),
      fan_sentiment_score = GREATEST(0, coalesce(fan_sentiment_score, 50) - 8),
      updated_at = now()
  WHERE id = g.band_id;

  UPDATE public.gigs
  SET status = 'cancelled',
      absence_decision = 'cancel',
      absence_decision_at = now(),
      absence_decided_by_profile_id = v_leader,
      absent_member_count = coalesce(v_absent, 0),
      cancelled_at = now(),
      cancelled_by_profile_id = v_leader,
      cancellation_reason = 'band_members_absent',
      cancellation_fame_penalty = v_fame_loss,
      cancellation_fan_sentiment_penalty = 8,
      failure_reason = format('Gig failed: %s of %s band members were not at the venue.', coalesce(v_absent, 0), v_total),
      updated_at = now()
  WHERE id = p_gig_id;

  INSERT INTO public.player_inbox (user_id, category, priority, title, message, metadata, action_type, action_data, related_entity_type, related_entity_id)
  SELECT p.user_id, 'gig_result', 'high',
         format('❌ Gig cancelled — missing members'),
         format('%s pulled the show because %s member(s) were not at the venue. Lost %s fans and %s fame.', coalesce(v_band_name, 'Your band'), coalesce(v_absent, 0), v_fan_loss, v_fame_loss),
         jsonb_build_object('gig_id', p_gig_id, 'band_id', g.band_id, 'fan_loss', v_fan_loss, 'fame_loss', v_fame_loss),
         'navigate', jsonb_build_object('route', '/gigs'), 'gig', p_gig_id
  FROM public.band_members bm
  JOIN public.profiles p ON p.id = bm.profile_id
  WHERE bm.band_id = g.band_id
    AND coalesce(bm.member_status, 'active') = 'active'
    AND p.user_id IS NOT NULL;

  RETURN jsonb_build_object(
    'decision', 'cancel',
    'absentMembers', coalesce(v_absent, 0),
    'fanLoss', v_fan_loss,
    'fameLoss', v_fame_loss
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_gig_absence(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_gig_absent_members() TO service_role;

-- Gigs where the leader chose to perform anyway must start with whoever is present.
CREATE OR REPLACE FUNCTION public.auto_start_scheduled_gigs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_gig record;
  v_started integer := 0;
  v_cancelled integer := 0;
  v_deferred integer := 0;
  v_checked integer := 0;
  v_lenient boolean;
  v_overdue_hours numeric;
  v_present integer;
  v_details jsonb := '[]'::jsonb;
BEGIN
  BEGIN
    PERFORM public.auto_prepare_gig_travel();
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG '[gig-auto-start] travel prep failed code=% message=%', SQLSTATE, SQLERRM;
  END;

  FOR v_gig IN
    SELECT g.id, g.band_id, g.scheduled_date, g.absence_decision, v.city_id AS venue_city_id
    FROM public.gigs g
    LEFT JOIN public.venues v ON v.id = g.venue_id
    WHERE g.status = 'scheduled' AND g.scheduled_date <= now() AND g.started_at IS NULL
    ORDER BY g.scheduled_date
  LOOP
    v_checked := v_checked + 1;
    v_overdue_hours := extract(epoch FROM (now() - v_gig.scheduled_date)) / 3600.0;
    v_lenient := v_overdue_hours >= 2 OR v_gig.absence_decision = 'perform';

    SELECT count(*) INTO v_present
    FROM public.band_members bm
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = v_gig.band_id
      AND coalesce(bm.member_status, 'active') = 'active'
      AND coalesce(p.is_active, true) = true
      AND p.died_at IS NULL
      AND p.current_city_id = v_gig.venue_city_id
      AND coalesce(p.is_traveling, false) = false;

    IF v_overdue_hours >= 12 AND coalesce(v_present, 0) = 0 THEN
      UPDATE public.gigs
      SET status = 'cancelled',
          cancelled_at = now(),
          cancellation_reason = 'no_show_band_not_in_venue_city',
          failure_reason = 'Automatically cancelled: no active band member was in the venue city.',
          updated_at = now()
      WHERE id = v_gig.id;
      v_cancelled := v_cancelled + 1;
      v_details := v_details || jsonb_build_object('gigId', v_gig.id, 'outcome', 'cancelled');
      CONTINUE;
    END IF;

    BEGIN
      PERFORM public.start_gig_authoritative(v_gig.id, v_lenient);
      v_started := v_started + 1;
      v_details := v_details || jsonb_build_object('gigId', v_gig.id, 'outcome', 'started', 'lenient', v_lenient);
    EXCEPTION WHEN OTHERS THEN
      v_deferred := v_deferred + 1;
      UPDATE public.gigs
      SET failure_reason = format('auto-start deferred (%s): %s', SQLSTATE, SQLERRM),
          updated_at = now()
      WHERE id = v_gig.id;
      v_details := v_details || jsonb_build_object('gigId', v_gig.id, 'outcome', 'deferred', 'error', SQLERRM);
      RAISE LOG '[gig-auto-start] deferred gig=% code=% message=%', v_gig.id, SQLSTATE, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'totalChecked', v_checked,
    'started', v_started,
    'cancelled', v_cancelled,
    'deferred', v_deferred,
    'details', v_details
  );
END;
$function$;

SELECT cron.unschedule('notify-gig-absent-members') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'notify-gig-absent-members'
);

SELECT cron.schedule('notify-gig-absent-members', '*/5 * * * *', 'SELECT public.notify_gig_absent_members();');