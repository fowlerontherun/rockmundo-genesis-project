-- This historical migration sorts before the timestamped base schema creates
-- public.profiles on a clean database. Apply the compatibility fields when the
-- table already exists (as it did in the original environment), otherwise defer
-- them so fresh migration replays can continue to the base schema.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS avatar_url text,
      ADD COLUMN IF NOT EXISTS current_location text;

    NOTIFY pgrst, 'reload schema';
  ELSE
    RAISE NOTICE 'Deferred profile avatar/location compatibility fields until public.profiles exists';
  END IF;
END
$$;
