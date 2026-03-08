
CREATE TABLE public.band_sentiment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  sentiment_change NUMERIC NOT NULL DEFAULT 0,
  media_intensity_change NUMERIC DEFAULT 0,
  media_fatigue_change NUMERIC DEFAULT 0,
  sentiment_after NUMERIC DEFAULT 0,
  source TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_band_sentiment_events_band_id ON public.band_sentiment_events(band_id);
CREATE INDEX idx_band_sentiment_events_created_at ON public.band_sentiment_events(created_at DESC);

ALTER TABLE public.band_sentiment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sentiment events for their bands"
  ON public.band_sentiment_events
  FOR SELECT
  TO authenticated
  USING (
    band_id IN (
      SELECT bm.band_id FROM public.band_members bm WHERE bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert sentiment events"
  ON public.band_sentiment_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
