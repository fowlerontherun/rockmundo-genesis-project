DO $$
DECLARE
  community_stages integer;
  community_acts integer;
  materializer_definition text;
  readiness_definition text;
BEGIN
  SELECT max_stages, max_acts_per_day
  INTO community_stages, community_acts
  FROM public.festival_licence_tiers
  WHERE key = 'community';

  IF community_stages IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Community Festival Licence must allow one active stage';
  END IF;
  IF community_acts IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'Community Festival Licence must allow six acts per day';
  END IF;

  IF to_regprocedure('public._festival_active_licence_max_stages(uuid,timestamptz)') IS NULL
     OR to_regprocedure('public._festival_active_licence_max_acts_per_day(uuid,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'Festival licence operating-limit helpers are incomplete';
  END IF;

  SELECT pg_get_functiondef(
    'public.materialize_festival_edition_foundations(uuid,uuid)'::regprocedure
  ) INTO materializer_definition;

  IF position('_festival_active_licence_max_stages' IN materializer_definition) = 0
     OR position('least' IN lower(materializer_definition)) = 0 THEN
    RAISE EXCEPTION 'Festival stage projection is not capped by the active licence';
  END IF;

  IF to_regprocedure(
    'public._simplified_festival_run_readiness_pre_operating_ceiling(uuid,uuid)'
  ) IS NULL THEN
    RAISE EXCEPTION 'Festival readiness base boundary is missing';
  END IF;

  SELECT pg_get_functiondef(
    'public._simplified_festival_run_readiness(uuid,uuid)'::regprocedure
  ) INTO readiness_definition;

  IF position('_festival_active_licence_max_stages' IN readiness_definition) = 0
     OR position('_festival_active_licence_max_acts_per_day' IN readiness_definition) = 0
     OR position('festival_licence_stage_limit_exceeded' IN readiness_definition) = 0
     OR position('festival_licence_act_limit_exceeded' IN readiness_definition) = 0
     OR position('licensedStageLimit' IN readiness_definition) = 0
     OR position('licensedActsPerDay' IN readiness_definition) = 0 THEN
    RAISE EXCEPTION 'Run Festival does not enforce or report licence operating ceilings';
  END IF;
END;
$$;
