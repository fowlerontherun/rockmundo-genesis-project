CREATE TABLE IF NOT EXISTS public.totp_live_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id uuid NOT NULL REFERENCES public.totp_episodes(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'soak' CHECK (mode IN ('soak','public')),
  state text NOT NULL DEFAULT 'offline' CHECK (state IN ('offline','standby','testing','live','holding','aborted','complete')),
  primary_source_label text NOT NULL DEFAULT 'Main encoder',
  backup_source_label text NOT NULL DEFAULT 'Backup encoder',
  active_source text NOT NULL DEFAULT 'primary' CHECK (active_source IN ('primary','backup')),
  youtube_broadcast_id text,
  stream_key_label text,
  manifest_checksum text,
  standby_at timestamptz,
  test_started_at timestamptz,
  live_at timestamptz,
  ended_at timestamptz,
  failover_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS totp_live_sessions_episode_idx ON public.totp_live_sessions(episode_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.totp_live_health_samples (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.totp_live_sessions(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'primary' CHECK (source IN ('primary','backup')),
  sampled_at timestamptz NOT NULL DEFAULT now(),
  bitrate_kbps numeric,
  dropped_frame_ratio numeric,
  audio_peak_dbfs numeric,
  delay_ms integer,
  stream_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS totp_live_health_session_idx ON public.totp_live_health_samples(session_id, sampled_at DESC);

CREATE TABLE IF NOT EXISTS public.totp_live_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.totp_live_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  headline text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS totp_live_events_session_idx ON public.totp_live_events(session_id, created_at DESC);

GRANT SELECT ON public.totp_live_sessions TO authenticated;
GRANT SELECT ON public.totp_live_health_samples TO authenticated;
GRANT SELECT ON public.totp_live_events TO authenticated;
GRANT ALL ON public.totp_live_sessions TO service_role;
GRANT ALL ON public.totp_live_health_samples TO service_role;
GRANT ALL ON public.totp_live_events TO service_role;

ALTER TABLE public.totp_live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.totp_live_health_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.totp_live_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "totp_live_sessions_admin_read" ON public.totp_live_sessions;
CREATE POLICY "totp_live_sessions_admin_read" ON public.totp_live_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "totp_live_health_admin_read" ON public.totp_live_health_samples;
CREATE POLICY "totp_live_health_admin_read" ON public.totp_live_health_samples
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "totp_live_events_admin_read" ON public.totp_live_events;
CREATE POLICY "totp_live_events_admin_read" ON public.totp_live_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.totp_episode_live_sessions(p_episode_id uuid)
RETURNS SETOF public.totp_live_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.totp_live_sessions s
  WHERE public.has_role(auth.uid(), 'admin')
    AND (p_episode_id IS NULL OR s.episode_id = p_episode_id)
  ORDER BY s.created_at DESC
  LIMIT 50;
$$;

CREATE OR REPLACE FUNCTION public.totp_live_recent_sessions(p_limit integer DEFAULT 40)
RETURNS SETOF public.totp_live_sessions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.*
  FROM public.totp_live_sessions s
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY s.created_at DESC
  LIMIT COALESCE(p_limit, 40);
$$;

CREATE OR REPLACE FUNCTION public.totp_live_session_health(p_session_id uuid, p_limit integer DEFAULT 60)
RETURNS SETOF public.totp_live_health_samples
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.*
  FROM public.totp_live_health_samples h
  WHERE public.has_role(auth.uid(), 'admin')
    AND h.session_id = p_session_id
  ORDER BY h.sampled_at DESC
  LIMIT COALESCE(p_limit, 60);
$$;

CREATE OR REPLACE FUNCTION public.totp_live_session_events(p_session_id uuid, p_limit integer DEFAULT 50)
RETURNS SETOF public.totp_live_events
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.totp_live_events e
  WHERE public.has_role(auth.uid(), 'admin')
    AND e.session_id = p_session_id
  ORDER BY e.created_at DESC
  LIMIT COALESCE(p_limit, 50);
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_start_live_session(
  p_episode_id uuid,
  p_mode text DEFAULT 'soak',
  p_manifest_checksum text DEFAULT NULL,
  p_youtube_broadcast_id text DEFAULT NULL,
  p_stream_key_label text DEFAULT NULL,
  p_primary_label text DEFAULT 'Main encoder',
  p_backup_label text DEFAULT 'Backup encoder'
)
RETURNS public.totp_live_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.totp_live_sessions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can start a transmission';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.totp_live_sessions s
    WHERE s.episode_id = p_episode_id AND s.state NOT IN ('complete','aborted')
  ) THEN
    RAISE EXCEPTION 'There is already an open transmission for this episode';
  END IF;

  INSERT INTO public.totp_live_sessions (
    episode_id, mode, state, primary_source_label, backup_source_label,
    youtube_broadcast_id, stream_key_label, manifest_checksum, standby_at, created_by
  ) VALUES (
    p_episode_id,
    COALESCE(NULLIF(p_mode, ''), 'soak'),
    'standby',
    COALESCE(NULLIF(p_primary_label, ''), 'Main encoder'),
    COALESCE(NULLIF(p_backup_label, ''), 'Backup encoder'),
    NULLIF(p_youtube_broadcast_id, ''),
    NULLIF(p_stream_key_label, ''),
    NULLIF(p_manifest_checksum, ''),
    now(),
    auth.uid()
  )
  RETURNING * INTO v_session;

  INSERT INTO public.totp_live_events (session_id, kind, headline, detail, actor_id)
  VALUES (v_session.id, 'standby', 'Transmission put on standby',
          jsonb_build_object('mode', v_session.mode), auth.uid());

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_transition_live_session(
  p_session_id uuid,
  p_state text,
  p_note text DEFAULT NULL
)
RETURNS public.totp_live_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.totp_live_sessions;
  v_allowed text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can control a transmission';
  END IF;

  SELECT * INTO v_session FROM public.totp_live_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Transmission not found';
  END IF;

  v_allowed := CASE v_session.state
    WHEN 'offline' THEN ARRAY['standby','aborted']
    WHEN 'standby' THEN ARRAY['testing','holding','aborted']
    WHEN 'testing' THEN ARRAY['standby','live','holding','aborted']
    WHEN 'live' THEN ARRAY['holding','complete','aborted']
    WHEN 'holding' THEN ARRAY['live','standby','complete','aborted']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (p_state = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Cannot move a transmission from % to %', v_session.state, p_state;
  END IF;

  UPDATE public.totp_live_sessions SET
    state = p_state,
    test_started_at = CASE WHEN p_state = 'testing' AND test_started_at IS NULL THEN now() ELSE test_started_at END,
    live_at = CASE WHEN p_state = 'live' AND live_at IS NULL THEN now() ELSE live_at END,
    ended_at = CASE WHEN p_state IN ('complete','aborted') THEN now() ELSE ended_at END,
    notes = COALESCE(NULLIF(p_note, ''), notes),
    updated_at = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.totp_live_events (session_id, kind, headline, detail, actor_id)
  VALUES (v_session.id, p_state, 'Transmission moved to ' || p_state,
          jsonb_build_object('note', p_note), auth.uid());

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_switch_live_source(
  p_session_id uuid,
  p_source text,
  p_reason text DEFAULT NULL
)
RETURNS public.totp_live_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.totp_live_sessions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can switch the transmission source';
  END IF;

  IF p_source NOT IN ('primary','backup') THEN
    RAISE EXCEPTION 'Unknown transmission source %', p_source;
  END IF;

  SELECT * INTO v_session FROM public.totp_live_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Transmission not found';
  END IF;

  IF v_session.state IN ('complete','aborted') THEN
    RAISE EXCEPTION 'This transmission has already finished';
  END IF;

  IF v_session.active_source = p_source THEN
    RETURN v_session;
  END IF;

  UPDATE public.totp_live_sessions SET
    active_source = p_source,
    failover_count = failover_count + 1,
    updated_at = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  INSERT INTO public.totp_live_events (session_id, kind, headline, detail, actor_id)
  VALUES (v_session.id, 'failover', 'Switched to the ' || p_source || ' encoder',
          jsonb_build_object('reason', p_reason, 'source', p_source), auth.uid());

  RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_admin_record_live_health(
  p_session_id uuid,
  p_source text DEFAULT 'primary',
  p_bitrate_kbps numeric DEFAULT NULL,
  p_dropped_frame_ratio numeric DEFAULT NULL,
  p_audio_peak_dbfs numeric DEFAULT NULL,
  p_delay_ms integer DEFAULT NULL,
  p_stream_status text DEFAULT NULL
)
RETURNS public.totp_live_health_samples
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sample public.totp_live_health_samples;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can record transmission health';
  END IF;

  INSERT INTO public.totp_live_health_samples (
    session_id, source, sampled_at, bitrate_kbps, dropped_frame_ratio, audio_peak_dbfs, delay_ms, stream_status
  ) VALUES (
    p_session_id,
    CASE WHEN p_source IN ('primary','backup') THEN p_source ELSE 'primary' END,
    now(), p_bitrate_kbps, p_dropped_frame_ratio, p_audio_peak_dbfs, p_delay_ms, NULLIF(p_stream_status, '')
  )
  RETURNING * INTO v_sample;

  RETURN v_sample;
END;
$$;