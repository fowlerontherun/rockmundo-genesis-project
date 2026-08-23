DO $$
DECLARE
  community_days integer;
  capacity_definition text;
  preview_definition text;
  purchase_gated_levels integer := 0;
  usage_gated_levels integer := 0;
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
      AND column_name = 'usage_licence_tier'
  ) THEN
    SELECT count(*) FILTER (WHERE minimum_licence_tier > 1),
           count(*) FILTER (WHERE usage_licence_tier > 1)
    INTO purchase_gated_levels, usage_gated_levels
    FROM public.festival_upgrade_levels;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_upgrade_levels'
      AND column_name = 'usage_licence_rank'
  ) THEN
    SELECT count(*) FILTER (WHERE minimum_licence_rank > 1),
           count(*) FILTER (WHERE usage_licence_rank > 1)
    INTO purchase_gated_levels, usage_gated_levels
    FROM public.festival_upgrade_levels;
  ELSE
    RAISE EXCEPTION 'Festival upgrade usage licence metadata is missing';
  END IF;

  IF purchase_gated_levels <> 0 THEN
    RAISE EXCEPTION 'Festival upgrades are still blocked by higher licence tiers';
  END IF;
  IF usage_gated_levels = 0 THEN
    RAISE EXCEPTION 'Festival upgrade usage licence thresholds were not preserved';
  END IF;

  SELECT pg_get_functiondef('public.get_festival_upgrade_purchase_preview(uuid,text)'::regprocedure)
  INTO preview_definition;

  IF position('usage_licence_' in preview_definition) = 0
     OR position('attendance remains capped' in preview_definition) = 0 THEN
    RAISE EXCEPTION 'Festival upgrade preview does not explain the licence usage ceiling';
  END IF;
END;
$$;
