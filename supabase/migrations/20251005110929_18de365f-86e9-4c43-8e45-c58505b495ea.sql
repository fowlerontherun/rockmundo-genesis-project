-- Activity-status compatibility before the timer-focused follow-up migration.
CREATE TABLE IF NOT EXISTS public.profile_activity_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id)
);

ALTER TABLE public.profile_activity_statuses
  ADD COLUMN IF NOT EXISTS activity_type varchar,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.profile_activity_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity statuses"
  ON public.profile_activity_statuses;
CREATE POLICY "Users can view their own activity statuses"
  ON public.profile_activity_statuses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = profile_activity_statuses.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own activity statuses"
  ON public.profile_activity_statuses;
CREATE POLICY "Users can insert their own activity statuses"
  ON public.profile_activity_statuses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = profile_activity_statuses.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own activity statuses"
  ON public.profile_activity_statuses;
CREATE POLICY "Users can update their own activity statuses"
  ON public.profile_activity_statuses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = profile_activity_statuses.profile_id
        AND profiles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = profile_activity_statuses.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own activity statuses"
  ON public.profile_activity_statuses;
CREATE POLICY "Users can delete their own activity statuses"
  ON public.profile_activity_statuses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = profile_activity_statuses.profile_id
        AND profiles.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_profile_activity_statuses_updated_at
  ON public.profile_activity_statuses;
CREATE TRIGGER update_profile_activity_statuses_updated_at
  BEFORE UPDATE ON public.profile_activity_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- The 20250916153000 bundle owns the jam-session table, participant arrays,
-- ownership policies, join function, and updated-at trigger. This migration
-- contributes only the later compatibility status field.
ALTER TABLE public.jam_sessions
  ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active';
