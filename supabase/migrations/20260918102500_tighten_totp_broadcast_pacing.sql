-- Tighten Top of the Pops broadcast pacing so real episodes use the same
-- fast TV camera rhythm as the admin demo.

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
  v_shot_count integer;
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
      'display_name', coalesce(nullif(p.display_name, ''), nullif(p.username, ''), nullif(bm.role, ''), 'Band member'),
      'role', coalesce(nullif(bm.instrument_role, ''), nullif(bm.vocal_role, ''), nullif(bm.role, ''), 'performer'),
      'instrument_role', bm.instrument_role,
      'vocal_role', bm.vocal_role,
      'is_touring_member', coalesce(bm.is_touring_member, false)
    ) ORDER BY coalesce(nullif(p.display_name, ''), nullif(p.username, ''), nullif(bm.role, ''), ''), bm.id), '[]'::jsonb)
  INTO v_members
  FROM public.band_members bm
  LEFT JOIN public.profiles p ON p.id = bm.profile_id
  WHERE bm.band_id = v_performance.band_id
    AND coalesce(bm.member_status, 'active') = 'active'
;

  IF lower(v_genre) ~ '(metal|punk|rock|grunge|hardcore|dance|electronic)' THEN
    v_shots := ARRAY['crane_sweep','lead_close','instrument_close','side_tracking','drummer_close','audience_reverse','low_angle','push_in','studio_master','finale_wide'];
  ELSE
    v_shots := ARRAY['crane_sweep','lead_medium','lead_close','audience_dance','studio_master','push_in','lead_close','pull_back','finale_wide'];
  END IF;

  v_cues := v_cues || jsonb_build_array(jsonb_build_object(
    'id','presenter-intro','type','presenter','offsetMs',0,'durationMs',4200,
    'cameraShot','presenter_wide','stage',v_stage,'presenterText',coalesce(v_performance.presenter_intro, format('At number %s this week, please welcome %s performing %s!', v_rank, v_band_name, v_song_title))
  ));

  v_shot_duration := CASE
    WHEN v_duration >= 150000 THEN 4800
    WHEN v_duration >= 90000 THEN 4500
    ELSE 4200
  END;
  v_shot_duration := greatest(3600, least(5400, v_shot_duration));
  v_shot_count := ceil(v_duration::numeric / v_shot_duration)::integer;

  v_cues := v_cues || jsonb_build_array(jsonb_build_object(
    'id','lower-third','type','graphic','offsetMs',4850,'durationMs',3200,
    'cameraShot',coalesce(v_shots[1], 'crane_sweep'),'stage',v_stage,
    'graphic',jsonb_build_object('artistName',v_band_name,'songTitle',v_song_title,'chartRank',v_rank,'trendChange',NULL,'debut',false)
  ));

  FOR v_index IN 1..greatest(1, v_shot_count) LOOP
    v_shot := v_shots[((v_index - 1) % greatest(1, array_length(v_shots, 1))) + 1];
    v_offset := 4200 + ((v_index - 1) * v_shot_duration);
    EXIT WHEN v_offset >= 4200 + v_duration;
    v_cues := v_cues || jsonb_build_array(jsonb_build_object(
      'id',format('performance-%s', v_index),
      'type','performance',
      'offsetMs',v_offset,
      'durationMs',least(v_shot_duration, 4200 + v_duration - v_offset),
      'cameraShot',v_shot,
      'stage',v_stage
    ));
  END LOOP;

  v_cues := v_cues || jsonb_build_array(jsonb_build_object(
    'id','applause','type','audience','offsetMs',4200 + v_duration,'durationMs',3500,
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
    'totalDurationMs', 4200 + v_duration + 3500,
    'cues', v_cues
  );

  v_checksum := md5(v_payload::text);

  INSERT INTO public.totp_broadcast_replays (
    episode_id, performance_id, replay_version, stage_key, presenter_key,
    duration_ms, payload, checksum
  ) VALUES (
    v_episode.id, v_performance.id, 1, v_stage, v_episode.presenter_key,
    4200 + v_duration + 3500, v_payload, v_checksum
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
