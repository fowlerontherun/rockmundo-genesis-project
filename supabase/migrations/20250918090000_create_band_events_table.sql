-- Create band_events table to track morale and chemistry changes
CREATE TABLE IF NOT EXISTS public.band_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('team_event', 'conflict_resolution', 'other')),
  cost INTEGER NOT NULL DEFAULT 0,
  morale_change INTEGER NOT NULL DEFAULT 0,
  chemistry_change INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  triggered_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS band_events_band_id_idx ON public.band_events (band_id, created_at DESC);

ALTER TABLE public.band_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Band members can view their events" ON public.band_events;
CREATE POLICY "Band members can view their events"
  ON public.band_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = band_id
        AND bm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.bands b
      WHERE b.id = band_id
        AND b.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Band members can insert events" ON public.band_events;
CREATE POLICY "Band members can insert events"
  ON public.band_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.band_members bm
      WHERE bm.band_id = band_id
        AND bm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.bands b
      WHERE b.id = band_id
        AND b.leader_id = auth.uid()
    )
  );

-- Add morale and chemistry tracking to band members
ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS morale INTEGER NOT NULL DEFAULT 60;

ALTER TABLE public.band_members
  ADD COLUMN IF NOT EXISTS chemistry INTEGER NOT NULL DEFAULT 60;
