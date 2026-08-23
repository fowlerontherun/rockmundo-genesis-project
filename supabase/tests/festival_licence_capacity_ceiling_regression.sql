DO $$
DECLARE
  community_days integer;
  capacity_definition text;
  gated_levels integer := 0;
BEGIN
  SELECT max_days INTO community_days
  FROM public.festival_licence_tiers
  WHERE key = 'community';

  IF community_days IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Community Festival Licence must allow 2 days';
  END IF;

  IF to_regprocedure('public._festival_annual_plan_potential_capacity(uuid,text)') IS NULL
     OR to_regprocedure('public._festival_active_licence_capacity(uuid,timestamptz)') IS NULL
     OR to_regprocedure('public._festival_annual_plan_capacity(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Festival licence capacity helpers are incomplete';
  END IF;

  SELECT pg_get_functiondef('public._festival_annual_plan_capacity(uuid,text)'::regprocedure)
  INTO capacity_definition;

  IF position('_festival_annual_plan_potential_capacity' in capacity_definition) = 0
     OR position('_festival_active_licence_capacity' in capacity_definition) = 0
     OR position('least' in lower(capacity_definition)) = 0 THEN
    RAISE EXCEPTION 'Festival annual capacity is not constrained by the active licence';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_upgrade_levels'
      AND column_name = 'minimum_licence_tier'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.festival_upgrade_levels WHERE minimum_licence_tier > 1'
      INTO gated_levels;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_upgrade_levels'
      AND column_name = 'minimum_licence_rank'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.festival_upgrade_levels WHERE minimum_licence_rank > 1'
      INTO gated_levels;
  END IF;

  IF gated_levels <> 0 THEN
    RAISE EXCEPTION 'Festival upgrades are still blocked by higher licence tiers';
  END IF;
END;
$$;
