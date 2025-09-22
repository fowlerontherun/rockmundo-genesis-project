-- Ensure the schedule_events table exists with the structure expected by the app
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
  reminder_minutes integer,
  last_notified timestamptz,
  recurrence_rule text,
  duration_minutes integer NOT NULL DEFAULT 60,
  energy_cost integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Make sure the core columns exist even if the table was partially created earlier
ALTER TABLE public.schedule_events
  ADD COLUMN IF NOT EXISTS reminder_minutes integer,
  ADD COLUMN IF NOT EXISTS last_notified timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS energy_cost integer,
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Apply required defaults and not-null constraints
ALTER TABLE public.schedule_events
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN type SET NOT NULL,
  ALTER COLUMN date SET NOT NULL,
  ALTER COLUMN time SET NOT NULL,
  ALTER COLUMN location SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'upcoming',
  ALTER COLUMN duration_minutes SET DEFAULT 60,
  ALTER COLUMN duration_minutes SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

-- Backfill defaults for any legacy rows
UPDATE public.schedule_events
SET duration_minutes = 60
WHERE duration_minutes IS NULL;

UPDATE public.schedule_events
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- Maintain data integrity with checks that match the frontend expectations
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

ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_metadata_is_object;
ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_metadata_is_object
    CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object');

-- Helpful indexes for lookups
CREATE INDEX IF NOT EXISTS schedule_events_user_id_idx ON public.schedule_events (user_id);
CREATE INDEX IF NOT EXISTS schedule_events_date_idx ON public.schedule_events (user_id, date);

-- Trigger to keep updated_at current
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

-- RLS configuration so users can only manage their own events
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their schedule events" ON public.schedule_events;
CREATE POLICY "Users can view their schedule events"
  ON public.schedule_events
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their schedule events" ON public.schedule_events;
CREATE POLICY "Users can create their schedule events"
  ON public.schedule_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their schedule events" ON public.schedule_events;
CREATE POLICY "Users can update their schedule events"
  ON public.schedule_events
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their schedule events" ON public.schedule_events;
CREATE POLICY "Users can delete their schedule events"
  ON public.schedule_events
  FOR DELETE
  USING (auth.uid() = user_id);
