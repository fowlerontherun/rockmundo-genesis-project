-- Create profile_activity_statuses table
CREATE TABLE IF NOT EXISTS public.profile_activity_statuses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'active',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(profile_id)
);

-- Enable RLS
ALTER TABLE public.profile_activity_statuses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own activity statuses"
  ON public.profile_activity_statuses
  FOR SELECT
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own activity statuses"
  ON public.profile_activity_statuses
  FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own activity statuses"
  ON public.profile_activity_statuses
  FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own activity statuses"
  ON public.profile_activity_statuses
  FOR DELETE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Create jam_sessions table
CREATE TABLE IF NOT EXISTS public.jam_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name character varying NOT NULL,
  description text,
  genre character varying NOT NULL,
  tempo integer NOT NULL DEFAULT 120,
  max_participants integer NOT NULL DEFAULT 4,
  current_participants integer NOT NULL DEFAULT 1,
  skill_requirement integer NOT NULL DEFAULT 1,
  is_private boolean NOT NULL DEFAULT false,
  access_code character varying,
  status character varying NOT NULL DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.jam_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Jam sessions are viewable by everyone"
  ON public.jam_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create jam sessions"
  ON public.jam_sessions
  FOR INSERT
  WITH CHECK (host_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Hosts can update their own jam sessions"
  ON public.jam_sessions
  FOR UPDATE
  USING (host_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Hosts can delete their own jam sessions"
  ON public.jam_sessions
  FOR DELETE
  USING (host_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Create updated_at trigger for profile_activity_statuses
CREATE TRIGGER update_profile_activity_statuses_updated_at
  BEFORE UPDATE ON public.profile_activity_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for jam_sessions
CREATE TRIGGER update_jam_sessions_updated_at
  BEFORE UPDATE ON public.jam_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();