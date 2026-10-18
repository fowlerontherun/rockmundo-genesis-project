-- Ensure venues link to a city record for geographic context
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS city_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.venues'::regclass
      AND conname = 'venues_city_id_fkey'
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_city_id_fkey
      FOREIGN KEY (city_id)
      REFERENCES public.cities(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS venues_city_id_idx ON public.venues(city_id);
