-- Top of the Pops phase 5: selectable incident recovery and immutable live-TV broadcast lock.
-- Recoveries are leader-only, one-time, and bounded to reputation/fan/media/audience effects.
-- Canonical replay rows are locked only after the performance is completed, with safe neutral fallbacks for unanswered choices.

ALTER TABLE public.totp_live_tv_events
  ADD COLUMN IF NOT EXISTS recovery_choice text,
  ADD COLUMN IF NOT EXISTS recovery_effects jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz;

ALTER TABLE public.totp_live_tv_events
  DROP CONSTRAINT IF EXISTS totp_live_tv_events_recovery_choice_check;
ALTER TABLE public.totp_live_tv_events
  ADD CONSTRAINT totp_live_tv_events_recovery_choice_check
  CHECK (recovery_choice IS NULL OR recovery_choice IN ('professional','improvise','showman'));

ALTER TABLE public.totp_performance_styles
  DROP CONSTRAINT IF EXISTS totp_performance_styles_selected_style_check;
ALTER TABLE public.totp_performance_styles
  ADD CONSTRAINT totp_performance_styles_selected_style_check
  CHECK (selected_style IS NULL OR selected_style IN ('polished','crowd_first','raw_live','house_direction'));

CREATE OR REPLACE FUNCTION public.totp_choose_incident_recovery(
  p_event_id uuid,
  p_choice text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.totp_live_tv_events%ROWTYPE;
  v_reaction integer := 0;
  v_rep numeric := 0;
  v_sentiment numeric := 0;
  v_media numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_choice NOT IN ('professional','improvise','showman') THEN
    RAISE EXCEPTION 'Choose a valid production recovery';
  END IF;

  SELECT * INTO v_event
  FROM public.totp_live_tv_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops production incident not found';
  END IF;

  IF v_event.event_key NOT IN ('broken_string','late_floor_manager') THEN
    RAISE EXCEPTION 'This production event does not require a player recovery choice';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.bands b
    JOIN public.profiles p ON p.id = b.leader_id
    WHERE b.id = v_event.band_id
      AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the band leader can choose the recovery';
  END IF;

  IF v_event.recovered_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','already_resolved',
      'choice',v_event.recovery_choice,
      'audience_reaction',v_event.audience_reaction,
      'effects',v_event.recovery_effects
    );
  END IF;

  IF v_event.event_key = 'broken_string' THEN
    CASE p_choice
      WHEN 'professional' THEN
        v_reaction := 1; v_rep := 1.0;
      WHEN 'improvise' THEN
        v_reaction := 2; v_rep := 0.5; v_sentiment := 0.5; v_media := 0.5;
      WHEN 'showman' THEN
        v_reaction := 3; v_sentiment := 0.5; v_media := 1.5;
    END CASE;
  ELSE
    CASE p_choice
      WHEN 'professional' THEN
        v_reaction := 1; v_rep := 1.0;
      WHEN 'improvise' THEN
        v_reaction := 2; v_rep := 0.5; v_media := 0.5;
      WHEN 'showman' THEN
        v_reaction := 2; v_sentiment := -0.25; v_media := 1.5;
    END CASE;
  END IF;

  UPDATE public.bands
  SET reputation_score = greatest(0,coalesce(reputation_score,0) + v_rep),
      fan_sentiment_score = greatest(-100,least(100,coalesce(fan_sentiment_score,0) + v_sentiment)),
      media_intensity = greatest(0,coalesce(media_intensity,0) + v_media)
  WHERE id = v_event.band_id;

  UPDATE public.totp_live_tv_events
  SET recovery_choice = p_choice,
      audience_reaction = greatest(-5,least(5,audience_reaction + v_reaction)),
      recovery_effects = jsonb_build_object(
        'reputation',v_rep,
        'fan_sentiment',v_sentiment,
        'media_intensity',v_media,
        'audience_reaction',v_reaction,
        'chart_effect',0,
        'cash_effect',0,
        'eligibility_effect',0
      ),
      recovered_at = now()
  WHERE id = v_event.id
  RETURNING * INTO v_event;

  RETURN jsonb_build_object(
    'status','resolved',
    'choice',p_choice,
    'audience_reaction',v_event.audience_reaction,
    'effects',v_event.recovery_effects
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_choose_incident_recovery(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totp_choose_incident_recovery(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_my_live_tv_extras()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'events',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',e.id,
        'invitation_id',e.invitation_id,
        'episode_id',e.episode_id,
        'band_id',e.band_id,
        'event_key',e.event_key,
        'title',e.title,
        'description',e.description,
        'audience_reaction',e.audience_reaction,
        'effects',e.effects,
        'requires_recovery',(e.event_key IN ('broken_string','late_floor_manager')),
        'recovery_choice',e.recovery_choice,
        'recovery_effects',e.recovery_effects,
        'recovered_at',e.recovered_at,
        'created_at',e.created_at
      ) ORDER BY e.created_at DESC)
      FROM public.totp_live_tv_events e
      WHERE EXISTS (
        SELECT 1 FROM public.band_members bm
        JOIN public.profiles p ON p.id=bm.profile_id
        WHERE bm.band_id=e.band_id AND p.user_id=auth.uid()
          AND coalesce(bm.member_status,'active')='active'
      )
    ),'[]'::jsonb),
    'styles',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id',s.id,
        'invitation_id',s.invitation_id,
        'episode_id',s.episode_id,
        'band_id',s.band_id,
        'selected_style',s.selected_style,
        'fame_multiplier',s.fame_multiplier,
        'audience_reaction',s.audience_reaction,
        'effects',s.effects,
        'created_at',s.created_at,
        'selected_at',s.selected_at,
        'applied_at',s.applied_at
      ) ORDER BY s.created_at DESC)
      FROM public.totp_performance_styles s
      WHERE EXISTS (
        SELECT 1 FROM public.band_members bm
        JOIN public.profiles p ON p.id=bm.profile_id
        WHERE bm.band_id=s.band_id AND p.user_id=auth.uid()
          AND coalesce(bm.member_status,'active')='active'
      )
    ),'[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.totp_my_live_tv_extras() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totp_my_live_tv_extras() TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_lock_live_tv_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_performance public.totp_performances%ROWTYPE;
  v_style public.totp_performance_styles%ROWTYPE;
  v_event public.totp_live_tv_events%ROWTYPE;
  v_combined_reaction integer := 0;
  v_label text := 'Settled';
BEGIN
  SELECT * INTO v_performance
  FROM public.totp_performances
  WHERE id = NEW.performance_id
  FOR UPDATE;

  IF v_performance.id IS NULL THEN
    RAISE EXCEPTION 'Top of the Pops performance not found for replay lock';
  END IF;

  IF v_performance.completed_at IS NULL THEN
    RAISE EXCEPTION 'Complete the Top of the Pops performance before locking its canonical broadcast';
  END IF;

  SELECT * INTO v_style
  FROM public.totp_performance_styles
  WHERE invitation_id = v_performance.invitation_id
  FOR UPDATE;

  IF v_style.id IS NOT NULL AND v_style.selected_at IS NULL THEN
    UPDATE public.totp_performance_styles
    SET selected_style = 'house_direction',
        fame_multiplier = 1.000,
        audience_reaction = 0,
        effects = jsonb_build_object(
          'reputation',0,'fan_sentiment',0,'media_intensity',0,
          'chart_effect',0,'cash_effect',0,'auto_locked',true
        ),
        selected_at = now()
    WHERE id = v_style.id
    RETURNING * INTO v_style;
  END IF;

  SELECT * INTO v_event
  FROM public.totp_live_tv_events
  WHERE invitation_id = v_performance.invitation_id
  FOR UPDATE;

  IF v_event.id IS NOT NULL
     AND v_event.event_key IN ('broken_string','late_floor_manager')
     AND v_event.recovered_at IS NULL THEN
    UPDATE public.totp_live_tv_events
    SET recovery_choice = 'professional',
        recovery_effects = jsonb_build_object(
          'reputation',0,'fan_sentiment',0,'media_intensity',0,
          'audience_reaction',0,'chart_effect',0,'cash_effect',0,
          'eligibility_effect',0,'auto_locked',true
        ),
        recovered_at = now()
    WHERE id = v_event.id
    RETURNING * INTO v_event;
  END IF;

  v_combined_reaction := greatest(-10,least(10,
    coalesce(v_event.audience_reaction,0) + coalesce(v_style.audience_reaction,0)
  ));

  v_label := CASE
    WHEN v_combined_reaction <= -2 THEN 'Nervous'
    WHEN v_combined_reaction <= 1 THEN 'Settled'
    WHEN v_combined_reaction <= 3 THEN 'Warm'
    WHEN v_combined_reaction <= 5 THEN 'Loud'
    ELSE 'Roaring'
  END;

  NEW.payload := NEW.payload || jsonb_build_object(
    'liveTv', jsonb_build_object(
      'incident', CASE WHEN v_event.id IS NULL THEN NULL ELSE jsonb_build_object(
        'eventKey',v_event.event_key,
        'title',v_event.title,
        'description',v_event.description,
        'audienceReaction',v_event.audience_reaction,
        'effects',v_event.effects,
        'recoveryChoice',v_event.recovery_choice,
        'recoveryEffects',v_event.recovery_effects
      ) END,
      'performanceStyle', CASE WHEN v_style.id IS NULL THEN NULL ELSE jsonb_build_object(
        'style',v_style.selected_style,
        'fameMultiplier',v_style.fame_multiplier,
        'audienceReaction',v_style.audience_reaction,
        'effects',v_style.effects
      ) END,
      'audienceReaction',v_combined_reaction,
      'audienceLabel',v_label,
      'lockedAt',now()
    )
  );
  NEW.replay_version := greatest(2,NEW.replay_version);
  NEW.checksum := md5(NEW.payload::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS totp_lock_live_tv_snapshot_trigger ON public.totp_broadcast_replays;
CREATE TRIGGER totp_lock_live_tv_snapshot_trigger
BEFORE INSERT ON public.totp_broadcast_replays
FOR EACH ROW
EXECUTE FUNCTION public.totp_lock_live_tv_snapshot();

COMMENT ON FUNCTION public.totp_choose_incident_recovery(uuid,text) IS
  'Leader-only, idempotent recovery choice for recoverable TOTP production incidents. No chart, cash or eligibility effects.';
COMMENT ON FUNCTION public.totp_lock_live_tv_snapshot() IS
  'Locks final live-TV incident/style/audience state into the immutable canonical TOTP replay after performance completion.';
