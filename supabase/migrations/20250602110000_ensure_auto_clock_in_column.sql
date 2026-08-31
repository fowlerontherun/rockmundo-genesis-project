-- This historical migration sorts before the timestamped base schema creates
-- public.player_employment on a clean database. Preserve the original upgrade
-- behaviour when the table already exists, but defer it during fresh replays.
DO $$
BEGIN
  IF to_regclass('public.player_employment') IS NOT NULL THEN
    ALTER TABLE public.player_employment
      ADD COLUMN IF NOT EXISTS auto_clock_in boolean NOT NULL DEFAULT false;

    UPDATE public.player_employment
      SET auto_clock_in = false
      WHERE auto_clock_in IS NULL;
  ELSE
    RAISE NOTICE 'Deferred player employment auto_clock_in compatibility field until public.player_employment exists';
  END IF;
END
$$;
