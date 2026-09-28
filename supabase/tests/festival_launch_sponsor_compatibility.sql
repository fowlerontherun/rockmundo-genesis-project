-- Guard against reintroducing the launch deadlock between the simplified
-- automatic sponsorship model and the unfinished explicit sponsor workflow.
-- Run after applying all festival sponsorship migrations.
BEGIN;
DO $$
DECLARE
  v_guard text;
  v_trigger_count integer;
BEGIN
  SELECT pg_get_functiondef('public.festival_require_main_sponsor_at_launch()'::regprocedure)
    INTO v_guard;

  IF position('FOR UPDATE' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'launch guard must serialize with sponsorship plan mutations';
  END IF;
  IF position('IF NOT v_has_contracts THEN' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'launch guard blocks festivals using automatic sponsorship only';
  END IF;
  IF position('festival_sponsor_slot_readiness' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'explicit sponsor contracts bypass sponsor-slot readiness';
  END IF;
  IF position('festival_sponsor_slots_not_ready_for_launch' IN v_guard) = 0 THEN
    RAISE EXCEPTION 'explicit sponsor contract failure has no stable error code';
  END IF;

  SELECT count(*) INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'festival_launches'
    AND t.tgname = 'festival_require_main_sponsor_at_launch_trigger'
    AND NOT t.tgisinternal
    AND t.tgenabled <> 'D';
  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'expected one enabled launch sponsor guard, found %', v_trigger_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'festival_sponsor_slot_readiness'
  ) THEN
    RAISE EXCEPTION 'sponsor slot readiness view missing';
  END IF;
END;
$$;
ROLLBACK;
