-- Add genre management columns to bands table
ALTER TABLE public.bands 
ADD COLUMN IF NOT EXISTS primary_genre varchar(100),
ADD COLUMN IF NOT EXISTS secondary_genres text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS genre_last_changed_at timestamp with time zone;

-- Migrate existing genre data to primary_genre
UPDATE public.bands 
SET primary_genre = genre 
WHERE primary_genre IS NULL AND genre IS NOT NULL;

-- Fix existing tour gigs with ticket_price = 0 or NULL
UPDATE public.gigs 
SET ticket_price = GREATEST(10, FLOOR(20 + (COALESCE(
  (SELECT COALESCE(fame, 0) FROM bands WHERE id = gigs.band_id), 0
) / 100)))
WHERE tour_id IS NOT NULL 
AND (ticket_price IS NULL OR ticket_price = 0);

-- Ensure travels_with_band defaults to true for existing members
UPDATE public.band_members 
SET travels_with_band = true 
WHERE travels_with_band IS NULL;