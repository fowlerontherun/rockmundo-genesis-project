-- Allow entry-level Festival companies to run a weekend-length event.
-- Keep all other Community Licence limits unchanged.

UPDATE public.festival_licence_tiers
SET max_days = 2
WHERE key = 'community';

DO $$
DECLARE
  v_max_days smallint;
BEGIN
  SELECT max_days
  INTO v_max_days
  FROM public.festival_licence_tiers
  WHERE key = 'community';

  IF v_max_days IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Community Festival Licence must allow 2 days';
  END IF;
END;
$$;
