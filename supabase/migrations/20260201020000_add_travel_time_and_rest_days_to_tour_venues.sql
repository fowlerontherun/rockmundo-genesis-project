-- Add travel logistics tracking to tour_venues
ALTER TABLE public.tour_venues
  ADD COLUMN travel_time numeric DEFAULT 0,
  ADD COLUMN rest_days integer DEFAULT 1;

-- Ensure existing rows use the defaults
UPDATE public.tour_venues
SET
  travel_time = COALESCE(travel_time, 0),
  rest_days = COALESCE(rest_days, 1);
