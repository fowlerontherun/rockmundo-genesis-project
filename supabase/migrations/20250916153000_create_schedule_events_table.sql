-- Create schedule_events table to manage user schedule items
CREATE TABLE IF NOT EXISTS public.schedule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gig', 'recording', 'rehearsal', 'meeting', 'tour')),
  date DATE NOT NULL,
  time TIME WITHOUT TIME ZONE NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_events_user_id_idx ON public.schedule_events (user_id);
CREATE INDEX IF NOT EXISTS schedule_events_date_idx ON public.schedule_events (user_id, date);

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

CREATE OR REPLACE FUNCTION public.update_schedule_events_updated_at()
RETURNS TRIGGER AS $$
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
