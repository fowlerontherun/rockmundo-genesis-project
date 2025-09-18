-- Replace the venues.city_id column with a city column that references cities(id)
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS city uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'city_id'
  ) THEN
    EXECUTE $$
      UPDATE public.venues
      SET city = city_id
      WHERE city IS NULL
        AND city_id IS NOT NULL;
    $$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'city'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.venues'::regclass
        AND conname = 'venues_city_fkey'
    ) THEN
      ALTER TABLE public.venues
        ADD CONSTRAINT venues_city_fkey
        FOREIGN KEY (city)
        REFERENCES public.cities(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS venues_city_idx ON public.venues(city);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.venues'::regclass
      AND conname = 'venues_city_id_fkey'
  ) THEN
    ALTER TABLE public.venues
      DROP CONSTRAINT venues_city_id_fkey;
  END IF;
END $$;

DROP INDEX IF EXISTS venues_city_id_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'city_id'
  ) THEN
    ALTER TABLE public.venues
      DROP COLUMN city_id;
  END IF;
END $$;
