-- Ensure unique index on band_id exists for the ON CONFLICT clause in the trigger
CREATE UNIQUE INDEX IF NOT EXISTS sponsorship_entities_band_id_key 
ON public.sponsorship_entities(band_id) 
WHERE band_id IS NOT NULL;