-- Add duration and energy cost metadata to schedule events
ALTER TABLE public.schedule_events
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS energy_cost INTEGER;

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
