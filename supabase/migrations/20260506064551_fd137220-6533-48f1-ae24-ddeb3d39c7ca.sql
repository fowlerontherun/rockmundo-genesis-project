
CREATE TABLE IF NOT EXISTS public.travel_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  user_id uuid,
  band_id uuid,
  tour_id uuid,
  tour_leg_id uuid,
  travel_history_id uuid,
  from_city_id uuid,
  to_city_id uuid,
  event_type text NOT NULL,
  message text NOT NULL,
  previous_eta timestamptz,
  new_eta timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tte_profile_occurred ON public.travel_timeline_events (profile_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tte_tour_occurred ON public.travel_timeline_events (tour_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tte_band_occurred ON public.travel_timeline_events (band_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_tte_leg ON public.travel_timeline_events (tour_leg_id);

ALTER TABLE public.travel_timeline_events ENABLE ROW LEVEL SECURITY;

-- Players can view events for their own profiles
CREATE POLICY "Users view own travel timeline events"
ON public.travel_timeline_events
FOR SELECT
TO authenticated
USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Players can view tour-scoped events for tours they own or whose band they are in
CREATE POLICY "Users view tour travel timeline events"
ON public.travel_timeline_events
FOR SELECT
TO authenticated
USING (
  tour_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.tours t
    WHERE t.id = travel_timeline_events.tour_id
      AND (
        t.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.band_members bm
          WHERE bm.band_id = t.band_id
            AND bm.user_id = auth.uid()
        )
      )
  )
);
