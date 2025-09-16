-- Add followers and engagement rate tracking to player profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followers bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_rate numeric(5,2) DEFAULT 0;

-- Ensure existing rows have non-null defaults for the new columns
UPDATE public.profiles
SET
  followers = COALESCE(followers, 0),
  engagement_rate = COALESCE(engagement_rate, 0);
