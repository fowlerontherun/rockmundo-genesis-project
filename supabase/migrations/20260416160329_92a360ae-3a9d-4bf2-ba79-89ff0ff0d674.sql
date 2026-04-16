
-- Add new columns to tours table for vehicle tier and production system
ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS vehicle_tier TEXT NOT NULL DEFAULT 'rusty_van',
  ADD COLUMN IF NOT EXISTS production_rating INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipment_hauling_cost INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_components JSONB NOT NULL DEFAULT '{}'::jsonb;
