-- Ensure the schedule_events table exists with the expected structure used by the app
CREATE TABLE IF NOT EXISTS public.schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL,
  date date NOT NULL,
  time time without time zone NOT NULL,
  location text NOT NULL,
  status text NOT NULL DEFAULT 'upcoming',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Make sure core columns cannot be null and have the right defaults
ALTER TABLE public.schedule_events
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN date SET NOT NULL,
  ALTER COLUMN time SET NOT NULL,
  ALTER COLUMN location SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'upcoming',
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

-- Ensure optional metadata columns exist
ALTER TABLE public.schedule_events
  ADD COLUMN IF NOT EXISTS reminder_minutes integer,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS energy_cost integer,
  ADD COLUMN IF NOT EXISTS last_notified timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Provide sensible defaults for new optional fields
UPDATE public.schedule_events
SET duration_minutes = 60
WHERE duration_minutes IS NULL;

ALTER TABLE public.schedule_events
  ALTER COLUMN duration_minutes SET DEFAULT 60,
  ALTER COLUMN duration_minutes SET NOT NULL;

ALTER TABLE public.schedule_events
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- Keep metadata values as JSON objects when present
ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_metadata_is_object;
ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_metadata_is_object
    CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');

-- Normalize legacy status values to match the UI expectations
UPDATE public.schedule_events
SET status = 'upcoming'
WHERE status = 'scheduled';

-- Keep type and status constrained to the supported values used across the app
ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_type_check;
ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_type_check
    CHECK (type IN ('gig', 'recording', 'rehearsal', 'meeting', 'tour'));

ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_status_check;
ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_status_check
    CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled'));

-- Maintain the reminder and duration guard rails
ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_reminder_minutes_check;
ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_reminder_minutes_check
    CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0);

ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_duration_minutes_check;
ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_duration_minutes_check
    CHECK (duration_minutes > 0);

ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_energy_cost_check;
ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_energy_cost_check
    CHECK (energy_cost IS NULL OR energy_cost >= 0);

-- Ensure indexes exist for efficient lookups
CREATE INDEX IF NOT EXISTS schedule_events_user_id_idx ON public.schedule_events (user_id);
CREATE INDEX IF NOT EXISTS schedule_events_date_idx ON public.schedule_events (user_id, date);

-- Recreate the trigger that keeps updated_at current
CREATE OR REPLACE FUNCTION public.update_schedule_events_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_schedule_events_updated_at ON public.schedule_events;
CREATE TRIGGER update_schedule_events_updated_at
  BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_schedule_events_updated_at();

-- Make sure row level security and policies are in place for user owned events
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their schedule events" ON public.schedule_events;
CREATE POLICY "Users can view their schedule events"
  ON public.schedule_events
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.role() IN ('service_role', 'supabase_admin')
  );

DROP POLICY IF EXISTS "Users can create their schedule events" ON public.schedule_events;
CREATE POLICY "Users can create their schedule events"
  ON public.schedule_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their schedule events" ON public.schedule_events;
CREATE POLICY "Users can update their schedule events"
  ON public.schedule_events
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR auth.role() IN ('service_role', 'supabase_admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR auth.role() IN ('service_role', 'supabase_admin')
  );

DROP POLICY IF EXISTS "Users can delete their schedule events" ON public.schedule_events;
CREATE POLICY "Users can delete their schedule events"
  ON public.schedule_events
  FOR DELETE
  USING (auth.uid() = user_id);
