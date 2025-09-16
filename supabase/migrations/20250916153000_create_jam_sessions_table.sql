-- Create collaborative jam sessions table and supporting helpers
CREATE TABLE IF NOT EXISTS public.jam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  genre TEXT NOT NULL,
  tempo INTEGER NOT NULL DEFAULT 120 CHECK (tempo > 0),
  max_participants INTEGER NOT NULL DEFAULT 4 CHECK (max_participants > 0),
  current_participants INTEGER NOT NULL DEFAULT 0 CHECK (current_participants >= 0),
  participant_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  skill_requirement INTEGER NOT NULL DEFAULT 0 CHECK (skill_requirement >= 0),
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  access_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jam_sessions_host_id_idx ON public.jam_sessions (host_id);

ALTER TABLE public.jam_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jam sessions are viewable by authenticated users" ON public.jam_sessions;
CREATE POLICY "Jam sessions are viewable by authenticated users"
  ON public.jam_sessions
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Hosts can create jam sessions" ON public.jam_sessions;
CREATE POLICY "Hosts can create jam sessions"
  ON public.jam_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can manage jam sessions" ON public.jam_sessions;
CREATE POLICY "Hosts can manage jam sessions"
  ON public.jam_sessions
  FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can delete jam sessions" ON public.jam_sessions;
CREATE POLICY "Hosts can delete jam sessions"
  ON public.jam_sessions
  FOR DELETE
  USING (auth.uid() = host_id);

CREATE OR REPLACE FUNCTION public.update_jam_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_jam_sessions_updated_at ON public.jam_sessions;
CREATE TRIGGER update_jam_sessions_updated_at
  BEFORE UPDATE ON public.jam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_jam_sessions_updated_at();

CREATE OR REPLACE FUNCTION public.join_jam_session(p_session_id UUID)
RETURNS public.jam_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session public.jam_sessions;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join jam sessions';
  END IF;

  SELECT *
  INTO v_session
  FROM public.jam_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jam session not found';
  END IF;

  IF v_session.current_participants >= v_session.max_participants THEN
    RAISE EXCEPTION 'Jam session is full';
  END IF;

  IF v_user_id = ANY (v_session.participant_ids) THEN
    RETURN v_session;
  END IF;

  UPDATE public.jam_sessions
  SET participant_ids = array_append(participant_ids, v_user_id),
      current_participants = current_participants + 1,
      updated_at = now()
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  RETURN v_session;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_jam_session(UUID) TO authenticated;
