CREATE TABLE public.band_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id uuid REFERENCES public.bands(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  delta integer NOT NULL,
  new_value integer NOT NULL,
  source text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_health_events_band ON public.band_health_events(band_id, created_at DESC);

ALTER TABLE public.band_health_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Band members can view their band health events"
  ON public.band_health_events FOR SELECT TO authenticated
  USING (band_id IN (SELECT band_id FROM public.band_members WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert health events"
  ON public.band_health_events FOR INSERT TO service_role
  WITH CHECK (true);