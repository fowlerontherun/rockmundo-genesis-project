-- Ensure pg_cron is available for scheduling reminder processing
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Ensure reminder support columns are present on schedule events
ALTER TABLE public.schedule_events
  ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS last_notified TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.schedule_events
  DROP CONSTRAINT IF EXISTS schedule_events_reminder_minutes_check;

ALTER TABLE public.schedule_events
  ADD CONSTRAINT schedule_events_reminder_minutes_check
    CHECK (reminder_minutes IS NULL OR reminder_minutes >= 0);

-- Allow reminder helpers to access schedule events and notifications as the service role
DROP POLICY IF EXISTS "Users can view their schedule events" ON public.schedule_events;
CREATE POLICY "Users can view their schedule events"
  ON public.schedule_events
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.role() IN ('service_role', 'supabase_admin')
  );

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

DROP POLICY IF EXISTS "Users can insert their notifications" ON public.notifications;
CREATE POLICY "Users and services can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.role() IN ('service_role', 'supabase_admin')
  );

-- Function to process schedule reminders and create notifications
CREATE OR REPLACE FUNCTION public.process_schedule_event_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  current_utc timestamp without time zone := timezone('utc', now());
BEGIN
  WITH due_events AS (
    SELECT
      id,
      user_id,
      title,
      location,
      reminder_minutes,
      (date + time) AS event_timestamp,
      ((date + time) - make_interval(mins => reminder_minutes)) AS reminder_timestamp,
      CASE
        WHEN reminder_minutes = 0 THEN 'is starting now'
        WHEN reminder_minutes = 1 THEN 'starts in 1 minute'
        WHEN reminder_minutes < 60 THEN 'starts in ' || reminder_minutes::text || ' minutes'
        WHEN mod(reminder_minutes, 1440) = 0 THEN 'starts in ' ||
          CASE
            WHEN reminder_minutes = 1440 THEN '1 day'
            ELSE (reminder_minutes / 1440)::text || ' days'
          END
        WHEN mod(reminder_minutes, 60) = 0 THEN 'starts in ' ||
          CASE
            WHEN reminder_minutes = 60 THEN '1 hour'
            ELSE (reminder_minutes / 60)::text || ' hours'
          END
        ELSE 'starts in ' ||
          CASE
            WHEN reminder_minutes / 60 = 1 THEN '1 hour'
            ELSE (reminder_minutes / 60)::text || ' hours'
          END ||
          ' and ' ||
          CASE
            WHEN mod(reminder_minutes, 60) = 1 THEN '1 minute'
            ELSE mod(reminder_minutes, 60)::text || ' minutes'
          END
      END AS timing_message
    FROM public.schedule_events
    WHERE
      reminder_minutes IS NOT NULL
      AND reminder_minutes >= 0
      AND status IN ('upcoming', 'in_progress')
      AND (date + time) >= current_utc
      AND current_utc >= ((date + time) - make_interval(mins => reminder_minutes))
      AND (
        last_notified IS NULL
        OR timezone('utc', last_notified) < ((date + time) - make_interval(mins => reminder_minutes))
      )
  ),
  inserted_notifications AS (
    INSERT INTO public.notifications (user_id, type, message)
    SELECT
      user_id,
      'system',
      'Event Reminder: ' || title || ' ' || timing_message ||
        '. Scheduled for ' || to_char(event_timestamp, 'Mon DD, YYYY') ||
        ' at ' || to_char(event_timestamp, 'HH24:MI') ||
        COALESCE(' - ' || NULLIF(location, ''), '') || '.'
    FROM due_events
    RETURNING 1
  )
  UPDATE public.schedule_events se
  SET last_notified = now()
  FROM due_events
  WHERE se.id = due_events.id;
END;
$$;

COMMENT ON FUNCTION public.process_schedule_event_reminders() IS 'Checks upcoming schedule events and generates reminder notifications.';

GRANT EXECUTE ON FUNCTION public.process_schedule_event_reminders() TO service_role;

-- Schedule the reminder processor to run every minute
DO $$
DECLARE
  existing_job_id integer;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'schedule_event_reminders_job';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'schedule_event_reminders_job',
    '*/1 * * * *',
    $$SELECT public.process_schedule_event_reminders();$$
  );
END;
$$;
