-- Add cost tracking fields to tour_venues
ALTER TABLE public.tour_venues
  ADD COLUMN travel_cost integer DEFAULT 0,
  ADD COLUMN lodging_cost integer DEFAULT 0,
  ADD COLUMN misc_cost integer DEFAULT 0;
