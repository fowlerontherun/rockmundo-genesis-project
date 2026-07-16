-- Festival editions release-gate harness. Intended for psql after migrations are applied.
DO $$
DECLARE
  v_count integer;
BEGIN
  IF to_regclass('public.festival_editions') IS NULL THEN RAISE EXCEPTION 'festival_editions missing'; END IF;
  IF to_regclass('public.festival_edition_lifecycle_events') IS NULL THEN RAISE EXCEPTION 'lifecycle events missing'; END IF;
  IF to_regclass('public.festival_legacy_mappings') IS NULL THEN RAISE EXCEPTION 'legacy mappings missing'; END IF;
  IF to_regtype('public.festival_edition_status') IS NULL THEN RAISE EXCEPTION 'festival_edition_status enum missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='transition_festival_edition') THEN RAISE EXCEPTION 'transition RPC missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='create_festival_edition') THEN RAISE EXCEPTION 'create RPC missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_festival_edition_planning') THEN RAISE EXCEPTION 'planning update RPC missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='festival_editions_festival_number_key') THEN RAISE EXCEPTION 'edition uniqueness missing'; END IF;
  SELECT count(*) INTO v_count FROM public.festivals f WHERE NOT EXISTS (SELECT 1 FROM public.festival_editions e WHERE e.festival_id=f.id);
  IF v_count <> 0 THEN RAISE EXCEPTION 'backfilled dedicated festivals missing editions: %', v_count; END IF;
  SELECT count(*) INTO v_count FROM (SELECT legacy_source, legacy_id FROM public.festival_legacy_mappings GROUP BY 1,2 HAVING count(*) > 1) dupes;
  IF v_count <> 0 THEN RAISE EXCEPTION 'duplicate legacy mappings found'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='festival_editions' AND cmd IN ('INSERT','UPDATE','DELETE')) THEN RAISE EXCEPTION 'direct client edition writes should not have policies'; END IF;
  RAISE NOTICE 'festival edition schema harness passed';
END $$;
