BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'current_city'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ADD COLUMN current_city uuid REFERENCES public.cities(id)';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'current_city_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.profiles ADD COLUMN current_city_id uuid REFERENCES public.cities(id)';
  END IF;
END;
$$;

-- If only one of the city columns has values, mirror them so both stay in sync
UPDATE public.profiles
SET current_city_id = current_city
WHERE current_city_id IS NULL AND current_city IS NOT NULL;

UPDATE public.profiles
SET current_city = current_city_id
WHERE current_city IS NULL AND current_city_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
