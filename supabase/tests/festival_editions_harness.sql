BEGIN;
DO $$
DECLARE
  v_count integer;
  v_private_cols text[] := ARRAY['budget_cents','treasury_allocation_cents','lifecycle_metadata','legacy_metadata','created_by'];
BEGIN
  IF to_regclass('public.festival_editions') IS NULL THEN RAISE EXCEPTION 'festival_editions missing'; END IF;
  IF to_regclass('public.festival_edition_lifecycle_events') IS NULL THEN RAISE EXCEPTION 'lifecycle events missing'; END IF;
  IF to_regclass('public.festival_legacy_mappings') IS NULL THEN RAISE EXCEPTION 'legacy mappings missing'; END IF;
  IF to_regclass('public.festival_edition_creation_requests') IS NULL THEN RAISE EXCEPTION 'creation idempotency table missing'; END IF;
  IF to_regclass('public.festival_edition_transition_requests') IS NULL THEN RAISE EXCEPTION 'transition idempotency table missing'; END IF;
  IF to_regtype('public.festival_edition_status') IS NULL THEN RAISE EXCEPTION 'festival_edition_status enum missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='transition_festival_edition') THEN RAISE EXCEPTION 'transition RPC missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='create_festival_edition') THEN RAISE EXCEPTION 'create RPC missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_festival_edition_planning' AND oid::regprocedure::text LIKE '%jsonb%') THEN RAISE EXCEPTION 'planning patch RPC missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='festival_editions_festival_number_key') THEN RAISE EXCEPTION 'edition uniqueness missing'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='public_festival_editions' AND column_name = ANY(v_private_cols)) THEN RAISE EXCEPTION 'public view exposes private columns'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='festival_editions' AND cmd IN ('INSERT','UPDATE','DELETE')) THEN RAISE EXCEPTION 'direct client edition writes should not have policies'; END IF;
  SELECT count(*) INTO v_count FROM (SELECT legacy_source, legacy_id FROM public.festival_legacy_mappings GROUP BY 1,2 HAVING count(*) > 1) dupes;
  IF v_count <> 0 THEN RAISE EXCEPTION 'duplicate legacy source mappings found'; END IF;
END $$;

-- Fixture behaviour checks use existing schema functions/constraints without keeping data.
DO $$
DECLARE
  v_festival uuid;
  v_edition uuid;
BEGIN
  SELECT id INTO v_festival FROM public.festivals LIMIT 1;
  IF v_festival IS NULL THEN RAISE NOTICE 'No festival fixtures are present; behavioural RPC checks skipped after catalogue assertions'; RETURN; END IF;
  SELECT id INTO v_edition FROM public.festival_editions WHERE festival_id=v_festival ORDER BY edition_number DESC LIMIT 1;
  IF v_edition IS NULL THEN RAISE EXCEPTION 'festival brand lacks a canonical edition'; END IF;
  PERFORM public.validate_festival_edition_transition('concept','live');
  IF public.validate_festival_edition_transition('concept','live') THEN RAISE EXCEPTION 'concept must not transition directly to live'; END IF;
  IF public.validate_festival_edition_transition('completed','live') THEN RAISE EXCEPTION 'completed must not return to live'; END IF;
  IF public.validate_festival_edition_transition('announced','announced') THEN RAISE EXCEPTION 'no-op transitions must not be lifecycle-valid'; END IF;
  IF NOT public.validate_festival_edition_transition('announced','on_sale') THEN RAISE EXCEPTION 'announced should transition to on_sale'; END IF;
END $$;
ROLLBACK;
