-- Non-destructive structural regression checks for gig crew career authority.
-- Run after the crew_gig_settlement_and_progression migration.
BEGIN;

DO $checks$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='band_crew_members' AND column_name='career_xp'
  ) THEN RAISE EXCEPTION 'Missing durable crew XP'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='gig_crew_settlements'
  ) THEN RAISE EXCEPTION 'Missing settlement ledger'; END IF;

  IF (SELECT count(*) FROM pg_trigger t
      WHERE t.tgrelid='public.gigs'::regclass AND NOT t.tgisinternal
        AND t.tgname IN ('trg_prepare_crew_on_gig_start','trg_settle_crew_on_gig_completion')) <> 2
  THEN RAISE EXCEPTION 'Gig start / completion triggers are missing'; END IF;

  IF public.crew_role_key('Front of House Engineer') <> 'sound_engineer'
     OR public.crew_role_key('Road Crew Chief') <> 'stage_manager'
     OR public.crew_role_key('Backline Technician') <> 'guitar_technician'
  THEN RAISE EXCEPTION 'Role canonicalisation is broken'; END IF;

  IF has_table_privilege('authenticated','public.band_crew_members','UPDATE')
     OR has_table_privilege('authenticated','public.crew_catalog','UPDATE')
     OR has_table_privilege('authenticated','public.gig_crew_assignments','INSERT')
     OR has_function_privilege('authenticated','public.process_gig_preparation_costs_and_rewards(uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public._settle_completed_gig_crew(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Direct unauthorised crew mutation path is still exposed'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.gig_crew_settlements'::regclass
      AND conname='gig_crew_settlements_once'
  ) THEN RAISE EXCEPTION 'Idempotent crew settlement key is missing'; END IF;
END $checks$;

ROLLBACK;
