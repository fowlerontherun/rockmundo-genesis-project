-- Top of the Pops phase 3: immutable canonical broadcast archive.
-- Playback rows are presentation evidence only and never award progression/rewards.

CREATE TABLE IF NOT EXISTS public.totp_broadcast_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  performance_id uuid NOT NULL UNIQUE REFERENCES public.totp_performances(id) ON DELETE CASCADE,
  replay_version integer NOT NULL DEFAULT 1 CHECK (replay_version > 0),
  stage_key text NOT NULL CHECK (stage_key IN ('main_stage', 'stage_b', 'rock_stage', 'studio_floor')),
  presenter_key text NOT NULL DEFAULT 'alex_rayne',
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 30000 AND 900000),
  payload jsonb NOT NULL,
  checksum text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS totp_broadcast_replays_episode_idx
  ON public.totp_broadcast_replays (episode_id, performance_id);

ALTER TABLE public.totp_broadcast_replays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.totp_broadcast_replays FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.totp_build_broadcast_replay(p_performance_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_performance public.totp_performances%ROWTYPE;
  v_episode public.totp_episodes%ROWTYPE;
  v_band_name text;
  v_song_title text;
  v_genre text;
  v_rank integer;
  v_stage text;
  v_duration integer := 187000;
  v_shots text[];
  v_members jsonb;
  v_cues jsonb := '[]'::jsonb;
  v_payload jsonb;
  v_checksum text;
  v_replay_id uuid;
  v_index integer;
  v_shot text;
  v_offset integer;
  v_shot_duration integer;
BEGIN
  SELECT * INTO v_performance
  FROM public.totp_performances
  WHERE id = p_performance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Top of the Pops performance not found';
  END IF;

  SELECT * INTO v_episode
  FROM public.totp_episodes
  WHERE id = v_performance.episode_id;

  SELECT b.name::text, s.title, coalesce(s.genre, ''), i.qualifying_rank
  INTO v_band_name, v_song_title, v_genre, v_rank
  FROM public.bands b
  JOIN public.songs s ON s.id = v_performance.song_id
  JOIN public.totp_invitations i ON i.id = v_performance.invitation_id
  WHERE b.id = v_performance.band_id;

  v_stage := CASE v_performance.stage_key
    WHEN 'secondary_stage' THEN 'stage_b'
    WHEN 'main_stage' THEN 'main_stage'
    WHEN 'rock_stage' THEN 'rock_stage'
    WHEN 'studio_floor' THEN 'studio_floor'
    ELSE 'main_stage'
  END;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'profile_id', bm.profile_id,
      'display_name', coalesce(p.stage_name, p.display_name, p.username, 'Band member'),
      'role', coalesce(nullif(bm.instrument_role, ''), nullif(bm.vocal_role, ''), nullif(bm.role, ''), 'performer'),
      'instrument_role', bm.instrument_role,
      'vocal_role', bm.vocal_role
    ) ORDER BY coalesce(p.stage_name, p.display_name, p.username, ''), bm.id), '[]'::jsonb)
  INTO v_members
  FROM public.band_members bm
  LEFT JOIN public.profiles p ON p.id = bm.profile_id
  WHERE bm.band_id = v_performance.band_id
    AND coalesce(bm.member_status, 'active') = 'active'
    AND coalesce(bm.is_touring_member, false) = false;

  IF lower(v_genre) ~ '(metal|punk|rock|grunge|hardcore|dance|electronic)' THEN
    v_shots := ARRAY['crane_sweep','lead_close','instrument_close','side_tracking','drummer_close','audience_reverse','low_angle','push_in','studio_master','finale_wide'];
  ELSE
    v_shots := ARRAY['crane_sweep','lead_medium','lead_close','audience_dance','studio_master','push_in','lead_close','pull_back','finale_wide'];
  END IF;

  v_cues := v_cues || jsonb_build_array(jsonb_build_object(
    'id','presenter-intro','type','presenter','offsetMs',0,'durationMs',7000,
    'cameraShot','presenter_wide','stage',v_stage,'presenterText',coalesce(v_performance.presenter_intro, format('At number %s this week, please welcome %s performing %s!', v_rank, v_band_name, v_song_title))
  ));

  v_shot_duration := greatest(3500, floor(v_duration::numeric / greatest(1, array_length(v_shots, 1)))::integer);

  v_cues := v_cues || jsonb_build_array(jsonb_build_object(
    'id','lower-third','type','graphic','offsetMs',7800,'durationMs',4000,
    'cameraShot',coalesce(v_shots[1], 'crane_sweep'),'stage',v_stage,
    'graphic',jsonb_build_object('artistName',v_band_name,'songTitle',v_song_title,'chartRank',v_rank,'trendChange',NULL,'debut',false)
  ));

  FOR v_index IN 1..coalesce(array_length(v_shots, 1), 0) LOOP
    v_shot := v_shots[v_index];
    v_offset := 7000 + ((v_index - 1) * v_shot_duration);
    EXIT WHEN v_offset >= 7000 + v_duration;
    v_cues := v_cues || jsonb_build_array(jsonb_build_object(
      'id',format('performance-%s', v_index),
      'type','performance',
      'offsetMs',v_offset,
      'durationMs',least(v_shot_duration, 7000 + v_duration - v_offset),
      'cameraShot',v_shot,
      'stage',v_stage
    ));
  END LOOP;

  v_cues := v_cues || jsonb_build_array(jsonb_build_object(
    'id','applause','type','audience','offsetMs',7000 + v_duration,'durationMs',4000,
    'cameraShot','finale_wide','stage',v_stage
  ));

  v_payload := jsonb_build_object(
    'schemaVersion', 1,
    'episodeId', v_episode.id,
    'episodeNumber', v_episode.episode_number,
    'episodeDate', v_episode.episode_date,
    'broadcastAt', v_episode.broadcast_at,
    'performanceId', v_performance.id,
    'runningOrder', v_performance.running_order,
    'presenterKey', v_episode.presenter_key,
    'band', jsonb_build_object('id',v_performance.band_id,'name',v_band_name,'members',v_members),
    'song', jsonb_build_object('id',v_performance.song_id,'title',v_song_title,'genre',v_genre,'qualifyingRank',v_rank),
    'stage', v_stage,
    'performanceDurationMs', v_duration,
    'totalDurationMs', 7000 + v_duration + 4000,
    'cues', v_cues
  );

  v_checksum := md5(v_payload::text);

  INSERT INTO public.totp_broadcast_replays (
    episode_id, performance_id, replay_version, stage_key, presenter_key,
    duration_ms, payload, checksum
  ) VALUES (
    v_episode.id, v_performance.id, 1, v_stage, v_episode.presenter_key,
    7000 + v_duration + 4000, v_payload, v_checksum
  )
  ON CONFLICT (performance_id) DO NOTHING
  RETURNING id INTO v_replay_id;

  IF v_replay_id IS NULL THEN
    SELECT id INTO v_replay_id
    FROM public.totp_broadcast_replays
    WHERE performance_id = p_performance_id;
  END IF;

  RETURN v_replay_id;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_build_broadcast_replay(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.totp_build_broadcast_replay(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.totp_build_episode_broadcast_replays(p_episode_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_performance record;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  FOR v_performance IN
    SELECT id FROM public.totp_performances
    WHERE episode_id = p_episode_id
      AND running_order IS NOT NULL
    ORDER BY running_order
  LOOP
    PERFORM public.totp_build_broadcast_replay(v_performance.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.totp_build_episode_broadcast_replays(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.totp_build_episode_broadcast_replays(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.totp_public_broadcast_archive(p_episode_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_episode_id uuid;
  v_rows jsonb;
BEGIN
  IF p_episode_id IS NULL THEN
    SELECT id INTO v_episode_id
    FROM public.totp_episodes
    WHERE status <> 'cancelled'
      AND broadcast_at <= now()
    ORDER BY broadcast_at DESC
    LIMIT 1;
  ELSE
    v_episode_id := p_episode_id;
  END IF;

  IF v_episode_id IS NULL THEN
    RETURN jsonb_build_object('episode_id', NULL, 'replays', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'performance_id', r.performance_id,
      'replay_version', r.replay_version,
      'stage_key', r.stage_key,
      'presenter_key', r.presenter_key,
      'duration_ms', r.duration_ms,
      'checksum', r.checksum,
      'generated_at', r.generated_at,
      'payload', r.payload
    ) ORDER BY (r.payload->>'runningOrder')::integer), '[]'::jsonb)
  INTO v_rows
  FROM public.totp_broadcast_replays r
  WHERE r.episode_id = v_episode_id;

  RETURN jsonb_build_object('episode_id', v_episode_id, 'replays', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.totp_public_broadcast_archive(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.totp_public_broadcast_archive(uuid) TO anon, authenticated;

COMMENT ON TABLE public.totp_broadcast_replays IS 'Immutable Top of the Pops broadcast-direction and performer snapshots for historical playback. Read-only playback evidence; never awards rewards.';
