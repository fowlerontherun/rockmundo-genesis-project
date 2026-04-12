-- Drop the partial unique index that causes ON CONFLICT inference failure
DROP INDEX IF EXISTS public.sponsorship_entities_band_id_key;

-- Create a full unique constraint on band_id (allows NULL, unique for non-null)
ALTER TABLE public.sponsorship_entities ADD CONSTRAINT sponsorship_entities_band_id_unique UNIQUE (band_id);

-- Recreate the trigger function with proper OLD handling
CREATE OR REPLACE FUNCTION public.create_sponsorship_entity_for_band()
RETURNS trigger AS $$
BEGIN
  -- Only run on UPDATE when status changes to active, or on INSERT if already active
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    INSERT INTO sponsorship_entities (band_id, brand_flags, fame_momentum)
    VALUES (NEW.id, ARRAY['music', 'live']::TEXT[], COALESCE(NEW.fame, 0))
    ON CONFLICT (band_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;