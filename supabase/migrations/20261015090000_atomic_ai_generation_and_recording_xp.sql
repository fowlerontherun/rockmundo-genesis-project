-- Batch: #4120/#4121/#4122 AI generation ownership, quota reservation and
-- webhook reconciliation; #4108/#4117 durable recording XP.
-- All entry points are service-role-only and commit their related writes in one transaction.
-- Do not backfill or silently cancel live jobs: inspect existing active duplicates
-- before running this migration.
CREATE UNIQUE INDEX IF NOT EXISTS song_generation_single_active_per_song
  ON public.song_generation_attempts(song_id) WHERE status = 'generating';

CREATE OR REPLACE FUNCTION public.reserve_song_generation_atomic(
  p_song_id uuid, p_user_id uuid, p_replace_existing boolean DEFAULT false,
  p_actor_user_id uuid DEFAULT NULL, p_admin_override boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_song public.songs%ROWTYPE;
  v_count integer;
  v_limit integer := 5;
  v_admin boolean;
  v_attempt uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_song_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'GENERATION_IDENTITY_REQUIRED';
  END IF;

  -- Serialize quota reservations across different songs by the same user.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  -- Serialize generation attempts across all band members on this same song.
  SELECT * INTO v_song FROM public.songs WHERE id=p_song_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SONG_NOT_FOUND'; END IF;

  IF v_song.audio_generation_status = 'generating'
     OR EXISTS (SELECT 1 FROM public.song_generation_attempts
                WHERE song_id=p_song_id AND status='generating') THEN
    RETURN jsonb_build_object('ok',false,'code','GENERATION_IN_PROGRESS');
  END IF;
  IF nullif(v_song.audio_url,'') IS NOT NULL AND NOT p_replace_existing THEN
    RETURN jsonb_build_object('ok',false,'code','REGENERATION_CONFIRMATION_REQUIRED');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_roles
                WHERE user_id=p_user_id AND role='admin') INTO v_admin;
  IF NOT (v_admin OR p_admin_override) THEN
    SELECT count(*) INTO v_count
      FROM public.song_generation_attempts
     WHERE user_id=p_user_id
       AND started_at > now()-interval '7 days'
       AND status IN ('generating','completed');
    IF v_count >= v_limit THEN
      RETURN jsonb_build_object('ok',false,'code','WEEKLY_GENERATION_LIMIT',
                                'used',v_count,'limit',v_limit);
    END IF;
  END IF;

  INSERT INTO public.song_generation_attempts
    (song_id,user_id,triggered_by_user_id,status)
    VALUES(p_song_id,p_user_id,coalesce(p_actor_user_id,p_user_id),'generating')
    RETURNING id INTO v_attempt;
  UPDATE public.songs
     SET audio_generation_status='generating', audio_generation_started_at=now()
   WHERE id=p_song_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SONG_GENERATION_CLAIM_LOST'; END IF;
  RETURN jsonb_build_object('ok',true,'attempt_id',v_attempt,
                            'used',coalesce(v_count,0)+1,'limit',
                            CASE WHEN v_admin OR p_admin_override THEN -1 ELSE v_limit END);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_song_generation_atomic(uuid,uuid,boolean,uuid,boolean)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_song_generation_atomic(uuid,uuid,boolean,uuid,boolean)
  TO service_role;

-- A webhook can never expose completed audio unless the matching attempt
-- is also completed. Failure/cancellation preserves any prior playable URL.
CREATE OR REPLACE FUNCTION public.finish_song_generation_atomic(
  p_song_id uuid, p_attempt_id uuid, p_status text,
  p_audio_url text DEFAULT NULL, p_error_message text DEFAULT NULL,
  p_prediction_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_song public.songs%ROWTYPE;
  v_attempt public.song_generation_attempts%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_status NOT IN ('completed','failed') OR p_song_id IS NULL OR p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'GENERATION_FINALIZATION_INVALID';
  END IF;
  IF p_status='completed' AND nullif(btrim(coalesce(p_audio_url,'')),'') IS NULL THEN
    RAISE EXCEPTION 'GENERATION_AUDIO_MISSING';
  END IF;

  SELECT * INTO v_song FROM public.songs WHERE id=p_song_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SONG_NOT_FOUND'; END IF;
  SELECT * INTO v_attempt
    FROM public.song_generation_attempts
   WHERE song_id=p_song_id ORDER BY started_at DESC,id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR v_attempt.id<>p_attempt_id OR v_attempt.status<>'generating' THEN
    RETURN jsonb_build_object('applied',false,'reason','stale_or_finalized');
  END IF;
  IF v_attempt.prediction_id IS NOT NULL
     AND p_prediction_id IS NOT NULL
     AND v_attempt.prediction_id<>p_prediction_id THEN
    RAISE EXCEPTION 'GENERATION_PREDICTION_MISMATCH';
  END IF;

  UPDATE public.song_generation_attempts
     SET status=p_status, completed_at=now(),
         error_message=CASE WHEN p_status='failed' THEN left(coalesce(p_error_message,'Generation failed'),2000)
                            ELSE NULL END
   WHERE id=p_attempt_id AND status='generating';
  IF NOT FOUND THEN RAISE EXCEPTION 'GENERATION_ATTEMPT_CLAIM_LOST'; END IF;
  UPDATE public.songs
     SET audio_generation_status=
           CASE WHEN p_status='completed' OR nullif(audio_url,'') IS NOT NULL
                THEN 'completed' ELSE 'failed' END,
         audio_url=CASE WHEN p_status='completed' THEN p_audio_url ELSE audio_url END,
         audio_generated_at=CASE WHEN p_status='completed' THEN now() ELSE audio_generated_at END
   WHERE id=p_song_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SONG_GENERATION_FINALIZATION_LOST'; END IF;
  RETURN jsonb_build_object('applied',true,'status',p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.finish_song_generation_atomic(uuid,uuid,text,text,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_song_generation_atomic(uuid,uuid,text,text,text,text)
  TO service_role;

-- Award source-of-truth XP stored by the trusted recording outcome calculator.
-- The unique award ledger plus wallet/experience writes share a single DB
-- transaction. Reruns cannot multiply XP; failures rollback all grant rows.
CREATE TABLE IF NOT EXISTS public.recording_xp_grants (
  session_id uuid NOT NULL REFERENCES public.recording_sessions(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_slug text NOT NULL,
  xp_amount integer NOT NULL CHECK(xp_amount BETWEEN 1 AND 10000),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(session_id,profile_id,skill_slug)
);
ALTER TABLE public.recording_xp_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recording_xp_grants FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.award_recording_xp_atomic(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_session public.recording_sessions%ROWTYPE;
  v_award record;
  v_user uuid;
  v_inserted integer;
  v_total integer := 0;
  v_grants integer := 0;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_session FROM public.recording_sessions
   WHERE id=p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECORDING_NOT_FOUND'; END IF;
  IF v_session.status NOT IN ('in_progress','completed') THEN
    RAISE EXCEPTION 'RECORDING_NOT_READY_FOR_XP';
  END IF;
  IF jsonb_typeof(v_session.xp_awards) IS DISTINCT FROM 'array'
     OR jsonb_array_length(v_session.xp_awards)=0 THEN
    RAISE EXCEPTION 'RECORDING_XP_AWARDS_MISSING';
  END IF;

  FOR v_award IN
    SELECT (a.value->>'profileId')::uuid AS profile_id,
           a.value->>'skill' AS skill_slug,
           sum((a.value->>'amount')::integer)::integer AS amount
      FROM jsonb_array_elements(v_session.xp_awards) AS a(value)
     GROUP BY 1,2
  LOOP
    IF v_award.profile_id IS NULL OR nullif(v_award.skill_slug,'') IS NULL
       OR v_award.amount NOT BETWEEN 1 AND 10000 THEN
      RAISE EXCEPTION 'RECORDING_XP_AWARD_INVALID';
    END IF;
    SELECT user_id INTO v_user FROM public.profiles
     WHERE id=v_award.profile_id FOR UPDATE;
    IF NOT FOUND OR v_user IS NULL THEN
      RAISE EXCEPTION 'RECORDING_XP_RECIPIENT_MISSING';
    END IF;

    INSERT INTO public.recording_xp_grants(session_id,profile_id,skill_slug,xp_amount)
    VALUES(p_session_id,v_award.profile_id,v_award.skill_slug,v_award.amount)
    ON CONFLICT(session_id,profile_id,skill_slug) DO NOTHING;
    GET DIAGNOSTICS v_inserted=ROW_COUNT;
    IF v_inserted=0 THEN CONTINUE; END IF;

    INSERT INTO public.player_xp_wallet(profile_id) VALUES(v_award.profile_id)
    ON CONFLICT(profile_id) DO NOTHING;
    UPDATE public.player_xp_wallet
       SET xp_balance=coalesce(xp_balance,0)+v_award.amount,
           lifetime_xp=coalesce(lifetime_xp,0)+v_award.amount,
           skill_xp_balance=coalesce(skill_xp_balance,0)+v_award.amount,
           skill_xp_lifetime=coalesce(skill_xp_lifetime,0)+v_award.amount,
           last_recalculated=now()
     WHERE profile_id=v_award.profile_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'RECORDING_XP_WALLET_MISSING'; END IF;
    INSERT INTO public.experience_ledger
      (user_id,profile_id,activity_type,skill_slug,xp_amount,metadata)
    VALUES(v_user,v_award.profile_id,'recording_complete',v_award.skill_slug,v_award.amount,
      jsonb_build_object('session_id',p_session_id,'song_id',v_session.song_id,
                         'skill',v_award.skill_slug,'recording_outcome_v2',true));
    v_total:=v_total+v_award.amount;
    v_grants:=v_grants+1;
  END LOOP;
  RETURN jsonb_build_object('awarded_xp',v_total,'new_grants',v_grants);
END;
$$;
REVOKE ALL ON FUNCTION public.award_recording_xp_atomic(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.award_recording_xp_atomic(uuid) TO service_role;
