-- Top of the Pops: automatic Thursday broadcast lifecycle.
-- Keeps the existing admin controls as recovery/manual tools, but the normal show no longer
-- depends on an admin being online to lock the running order, start the broadcast or settle it.

-- Allow trusted database jobs (where auth.uid() is NULL) to reuse the authoritative admin lock.
-- Authenticated callers still require the admin role.
CREATE OR REPLACE FUNCTION public.totp_admin_lock_running_order(p_episode_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode public.totp_episodes%ROWTYPE;
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_episode FROM public.totp_episodes WHERE id = p_episode_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Top of the Pops episode not found'; END IF;
  IF v_episode.status IN ('completed', 'cancelled') THEN RAISE EXCEPTION 'This episode can no longer be changed'; END IF;

  DELETE FROM public.totp_performances WHERE episode_id = p_episode_id AND completed_at IS NULL;

  WITH eligible_base AS (
    SELECT i.id AS invitation_id, i.band_id, i.song_id, i.qualifying_rank, s.genre,
      md5(p_episode_id::text || ':' || i.band_id::text || ':' || i.song_id::text) AS editorial_key
    FROM public.totp_invitations i
    JOIN public.songs s ON s.id = i.song_id
    WHERE i.episode_id = p_episode_id AND i.status = 'checked_in'
  ),
  eligible AS (
    SELECT *, row_number() OVER (
      ORDER BY CASE WHEN qualifying_rank = 1 THEN 1 ELSE 0 END ASC, editorial_key ASC
    ) AS running_order
    FROM eligible_base
  )
  INSERT INTO public.totp_performances (
    episode_id, invitation_id, band_id, song_id, running_order, stage_key, camera_profile, presenter_intro
  )
  SELECT p_episode_id, e.invitation_id, e.band_id, e.song_id, e.running_order,
    CASE
      WHEN lower(coalesce(e.genre, '')) ~ '(rock|metal|punk|grunge|hardcore)' THEN 'rock_stage'
      WHEN e.qualifying_rank <= 5 THEN 'main_stage'
      WHEN mod(e.running_order, 3) = 0 THEN 'studio_floor'
      ELSE 'stage_b'
    END,
    'totp_classic',
    public.totp_presenter_intro(v_episode.presenter_key, v_episode.show_variant, e.qualifying_rank, b.name::text, s.title)
  FROM eligible e
  JOIN public.bands b ON b.id = e.band_id
  JOIN public.songs s ON s.id = e.song_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.totp_episodes SET status = 'locked', updated_at = now() WHERE id = p_episode_id;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_admin_lock_running_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_admin_lock_running_order(uuid) TO authenticated;

-- Same principle for settlement: browser/API callers must still be admins, while pg_cron may
-- settle the already-locked performance after the broadcast has finished.
CREATE OR REPLACE FUNCTION public.totp_complete_performance(
  p_performance_id uuid,
  p_performance_score integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perf public.totp_performances%ROWTYPE;
  v_episode public.totp_episodes%ROWTYPE;
  v_inv public.totp_invitations%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_prior_appearances integer := 0;
  v_appearance_number integer := 1;
  v_raw_fame integer := 0;
  v_lifetime_factor numeric := 1;
  v_progression_factor numeric := 1;
  v_effective_fame integer := 0;
  v_member record;
  v_member_share integer;
  v_history_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_perf
  FROM public.totp_performances
  WHERE id = p_performance_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Top of the Pops performance not found'; END IF;

  SELECT h.id INTO v_history_id
  FROM public.totp_appearance_history h
  WHERE h.performance_id = p_performance_id;
  IF v_history_id IS NOT NULL THEN
    RETURN (
      SELECT jsonb_build_object(
        'status','already_completed','performance_id',h.performance_id,
        'appearance_number',h.appearance_number,'fame_awarded',h.fame_awarded,
        'qualifying_rank',h.qualifying_rank
      )
      FROM public.totp_appearance_history h WHERE h.id = v_history_id
    );
  END IF;

  SELECT * INTO v_episode FROM public.totp_episodes WHERE id = v_perf.episode_id;
  SELECT * INTO v_inv FROM public.totp_invitations WHERE id = v_perf.invitation_id;
  SELECT * INTO v_band FROM public.bands WHERE id = v_perf.band_id FOR UPDATE;
  IF v_episode.id IS NULL OR v_inv.id IS NULL OR v_band.id IS NULL THEN
    RAISE EXCEPTION 'Top of the Pops completion data is incomplete';
  END IF;
  IF v_inv.status NOT IN ('checked_in','performed') THEN
    RAISE EXCEPTION 'Only a checked-in Top of the Pops act can complete a performance';
  END IF;

  SELECT count(*) INTO v_prior_appearances
  FROM public.totp_appearance_history WHERE band_id = v_perf.band_id;
  v_appearance_number := v_prior_appearances + 1;
  v_raw_fame := public.totp_raw_fame_for_rank(v_inv.qualifying_rank);
  IF v_appearance_number = 1 THEN v_raw_fame := round(v_raw_fame * 1.20); END IF;

  v_lifetime_factor := greatest(0.60, 1.0 / (1.0 + (v_prior_appearances * 0.04)));
  v_progression_factor := 1.0 / (1.0 + (ln(1.0 + greatest(0,coalesce(v_band.collective_fame_earned,0))) / ln(10.0)) / 5.0);
  v_effective_fame := greatest(1, round(v_raw_fame * v_lifetime_factor * v_progression_factor));

  UPDATE public.bands
  SET collective_fame_earned = coalesce(collective_fame_earned,0) + v_effective_fame,
      fame = coalesce(fame,0) + v_effective_fame,
      last_fame_calculation = now()
  WHERE id = v_perf.band_id;

  INSERT INTO public.band_fame_events(band_id,event_type,fame_gained,event_data)
  VALUES (v_perf.band_id,'top_of_the_pops',v_effective_fame,jsonb_build_object(
    'performance_id',v_perf.id,'episode_id',v_perf.episode_id,'episode_number',v_episode.episode_number,
    'qualifying_rank',v_inv.qualifying_rank,'appearance_number',v_appearance_number,
    'raw_fame_gain',v_raw_fame,'lifetime_factor',v_lifetime_factor,'progression_factor',v_progression_factor
  ));

  FOR v_member IN
    SELECT bm.profile_id,bm.vocal_role
    FROM public.band_members bm
    WHERE bm.band_id = v_perf.band_id
      AND bm.profile_id IS NOT NULL
      AND coalesce(bm.member_status,'active') = 'active'
      AND coalesce(bm.is_touring_member,false) = false
  LOOP
    v_member_share := round(v_effective_fame * 0.30);
    IF lower(coalesce(v_member.vocal_role,'')) LIKE '%lead%' THEN v_member_share := round(v_member_share * 1.20); END IF;
    IF v_member.profile_id = v_band.leader_id THEN v_member_share := round(v_member_share * 1.15); END IF;
    UPDATE public.profiles SET fame = coalesce(fame,0) + greatest(1,v_member_share) WHERE id = v_member.profile_id;
  END LOOP;

  UPDATE public.totp_performances
  SET performance_score = CASE WHEN p_performance_score IS NULL THEN performance_score ELSE greatest(0,least(100,p_performance_score)) END,
      fame_awarded = v_effective_fame,
      completed_at = coalesce(completed_at,now())
  WHERE id = v_perf.id;
  UPDATE public.totp_invitations SET status='performed',updated_at=now() WHERE id=v_inv.id;

  INSERT INTO public.totp_appearance_history(
    performance_id,episode_id,band_id,song_id,episode_number,episode_date,running_order,
    stage_key,qualifying_rank,appearance_number,raw_fame_reward,fame_awarded,presenter_intro,completed_at
  ) VALUES (
    v_perf.id,v_perf.episode_id,v_perf.band_id,v_perf.song_id,v_episode.episode_number,v_episode.episode_date,
    v_perf.running_order,v_perf.stage_key,v_inv.qualifying_rank,v_appearance_number,v_raw_fame,v_effective_fame,
    v_perf.presenter_intro,now()
  ) RETURNING id INTO v_history_id;

  FOR v_member IN
    SELECT bm.profile_id
    FROM public.band_members bm
    WHERE bm.band_id=v_perf.band_id AND bm.profile_id IS NOT NULL
      AND coalesce(bm.member_status,'active')='active'
      AND coalesce(bm.is_touring_member,false)=false
  LOOP
    PERFORM public.totp_award_achievement(v_member.profile_id,'totp-tv-debut',v_perf.id);
    IF v_inv.qualifying_rank <= 20 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-top-20-performer',v_perf.id); END IF;
    IF v_inv.qualifying_rank <= 10 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-top-10-performer',v_perf.id); END IF;
    IF v_inv.qualifying_rank = 1 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-number-one',v_perf.id); END IF;
    IF v_appearance_number >= 5 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-household-name',v_perf.id); END IF;
    IF v_appearance_number >= 10 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-television-regular',v_perf.id); END IF;
    IF v_appearance_number >= 25 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-pop-institution',v_perf.id); END IF;
    IF v_appearance_number >= 50 THEN PERFORM public.totp_award_achievement(v_member.profile_id,'totp-legend-of-the-pops',v_perf.id); END IF;
  END LOOP;

  INSERT INTO public.notifications(user_id,type,title,message,action_path,metadata)
  SELECT DISTINCT bm.user_id,'system','Top of the Pops',
    format('Top of the Pops complete: %s earned %s fame from its #%s appearance.',v_band.name,v_effective_fame,v_inv.qualifying_rank),
    '/top-of-the-pops',jsonb_build_object('performance_id',v_perf.id,'episode_id',v_perf.episode_id)
  FROM public.band_members bm
  WHERE bm.band_id=v_perf.band_id AND bm.user_id IS NOT NULL
    AND coalesce(bm.member_status,'active')='active'
    AND coalesce(bm.is_touring_member,false)=false;

  RETURN jsonb_build_object(
    'status','completed','performance_id',v_perf.id,'history_id',v_history_id,
    'appearance_number',v_appearance_number,'qualifying_rank',v_inv.qualifying_rank,
    'raw_fame_reward',v_raw_fame,'fame_awarded',v_effective_fame,
    'lifetime_factor',v_lifetime_factor,'progression_factor',v_progression_factor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_complete_performance(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totp_complete_performance(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.totp_run_broadcast_cycle(p_now timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode record;
  v_performance record;
  v_locked_count integer := 0;
  v_started_count integer := 0;
  v_settled_count integer := 0;
  v_completed_count integer := 0;
  v_archived_count integer := 0;
BEGIN
  FOR v_episode IN
    SELECT e.*
    FROM public.totp_episodes e
    WHERE e.status NOT IN ('completed','cancelled')
      AND e.broadcast_at <= p_now + interval '1 day'
      AND e.broadcast_at >= p_now - interval '2 days'
    ORDER BY e.broadcast_at
  LOOP
    -- Once studio check-in has closed, late/non-arriving acts are frozen out and the
    -- checked-in acts become the immutable running order.
    IF p_now >= v_episode.check_in_at + interval '45 minutes'
       AND v_episode.status IN ('scheduled','inviting') THEN
      UPDATE public.totp_invitations
      SET status = 'expired', updated_at = p_now
      WHERE episode_id = v_episode.id
        AND status = 'invited';

      UPDATE public.totp_invitations
      SET status = 'missed', missed_reason = coalesce(missed_reason, 'missed_studio_check_in'), updated_at = p_now
      WHERE episode_id = v_episode.id
        AND status = 'accepted';

      v_locked_count := v_locked_count + public.totp_admin_lock_running_order(v_episode.id);
      v_episode.status := 'locked';
    END IF;

    -- Freeze the canonical 3D television replays at transmission time, after all pre-show
    -- interactive choices have had their opportunity to resolve.
    IF p_now >= v_episode.broadcast_at
       AND v_episode.status = 'locked' THEN
      v_archived_count := v_archived_count + public.totp_build_episode_broadcast_replays(v_episode.id);
      UPDATE public.totp_episodes
      SET status = 'broadcast', updated_at = p_now
      WHERE id = v_episode.id;
      v_started_count := v_started_count + 1;
      v_episode.status := 'broadcast';
    END IF;

    -- The programme is treated as a one-hour broadcast window. Settlement occurs only
    -- afterwards, so watching/reloading the show itself can never award rewards twice.
    IF p_now >= v_episode.broadcast_at + interval '60 minutes'
       AND v_episode.status = 'broadcast' THEN
      FOR v_performance IN
        SELECT id
        FROM public.totp_performances
        WHERE episode_id = v_episode.id
          AND completed_at IS NULL
        ORDER BY running_order
      LOOP
        PERFORM public.totp_complete_performance(v_performance.id, NULL);
        v_settled_count := v_settled_count + 1;
      END LOOP;

      -- Idempotent safety pass: if an archive row was not created at broadcast start,
      -- create any missing replay now. Existing replay rows are never rewritten.
      v_archived_count := v_archived_count + public.totp_build_episode_broadcast_replays(v_episode.id);

      UPDATE public.totp_episodes
      SET status = 'completed', updated_at = p_now
      WHERE id = v_episode.id;
      v_completed_count := v_completed_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'locked_acts', v_locked_count,
    'broadcasts_started', v_started_count,
    'performances_settled', v_settled_count,
    'broadcasts_completed', v_completed_count,
    'archive_attempts', v_archived_count,
    'ran_at', p_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totp_run_broadcast_cycle(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_run_broadcast_cycle(timestamptz) TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'run_top_of_the_pops_broadcast_cycle';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'run_top_of_the_pops_broadcast_cycle',
    '*/5 * * * *',
    $cron$SELECT public.totp_run_broadcast_cycle();$cron$
  );
END;
$$;

COMMENT ON FUNCTION public.totp_run_broadcast_cycle(timestamptz) IS
  'Idempotent Thursday Top of the Pops lifecycle runner: freezes check-in, locks the rundown, starts the broadcast, builds immutable replays, settles performances and completes the episode.';
