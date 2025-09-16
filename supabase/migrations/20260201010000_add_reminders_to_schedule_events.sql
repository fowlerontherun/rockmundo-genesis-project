-- Add reminder support to schedule events
ALTER TABLE public.schedule_events
  ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS last_notified TIMESTAMP WITH TIME ZONE;

-- Ensure reminder minutes are non-negative when provided
ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_reminder_minutes_check;

ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_reminder_minutes_check
    CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0);
