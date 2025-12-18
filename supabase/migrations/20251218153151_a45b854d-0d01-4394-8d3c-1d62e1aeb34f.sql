-- Add comprehensive tour planning fields to tours table
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'country' CHECK (scope IN ('country', 'continent', 'world')),
  ADD COLUMN IF NOT EXISTS min_rest_days integer DEFAULT 1 CHECK (min_rest_days >= 1 AND min_rest_days <= 7),
  ADD COLUMN IF NOT EXISTS travel_mode text DEFAULT 'auto' CHECK (travel_mode IN ('manual', 'auto', 'tour_bus')),
  ADD COLUMN IF NOT EXISTS tour_bus_daily_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_upfront_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_show_count integer,
  ADD COLUMN IF NOT EXISTS selected_countries text[],
  ADD COLUMN IF NOT EXISTS selected_continents text[],
  ADD COLUMN IF NOT EXISTS venue_type_filter text[],
  ADD COLUMN IF NOT EXISTS max_venue_capacity integer,
  ADD COLUMN IF NOT EXISTS cancelled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_date timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_refund_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setlist_id uuid REFERENCES public.setlists(id);

-- Create tour_travel_legs table for travel between cities
CREATE TABLE IF NOT EXISTS public.tour_travel_legs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id uuid NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  from_city_id uuid REFERENCES public.cities(id),
  to_city_id uuid REFERENCES public.cities(id),
  travel_mode text NOT NULL CHECK (travel_mode IN ('bus', 'train', 'plane', 'ship', 'tour_bus')),
  travel_cost numeric DEFAULT 0,
  travel_duration_hours numeric DEFAULT 0,
  departure_date timestamptz,
  arrival_date timestamptz,
  sequence_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tour_travel_legs_tour_id ON public.tour_travel_legs(tour_id);

-- Enable RLS
ALTER TABLE public.tour_travel_legs ENABLE ROW LEVEL SECURITY;

-- RLS policies for tour_travel_legs
CREATE POLICY "Users can view their tour travel legs"
  ON public.tour_travel_legs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tours t
      WHERE t.id = tour_travel_legs.tour_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their tour travel legs"
  ON public.tour_travel_legs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tours t
      WHERE t.id = tour_travel_legs.tour_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their tour travel legs"
  ON public.tour_travel_legs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tours t
      WHERE t.id = tour_travel_legs.tour_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their tour travel legs"
  ON public.tour_travel_legs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tours t
      WHERE t.id = tour_travel_legs.tour_id
      AND t.user_id = auth.uid()
    )
  );

-- Add city_id to tour_venues if not exists for direct city reference
ALTER TABLE public.tour_venues
  ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES public.cities(id),
  ADD COLUMN IF NOT EXISTS estimated_revenue numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_fee numeric DEFAULT 0;