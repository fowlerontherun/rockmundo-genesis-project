-- Read-only, fixture-free safety checks. Execute on a disposable DB after
-- applying the Festival rerun and artist-payment migrations.
DO $test$
DECLARE
  settlement_def text;
  trigger_def text;
  runtime_def text;
  owner_results_def text;
BEGIN
  IF to_regclass('public.festival_simplified_rerun_archives') IS NULL
    OR to_regclass('public.festival_simplified_artist_payouts') IS NULL
    OR to_regprocedure('public.prepare_premature_simplified_festival_rerun(uuid,uuid,uuid,text,text)') IS NULL
    OR to_regprocedure('public._pay_simplified_festival_artist_bookings(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Festival rerun archival or artist-payment support is missing';
  END IF;

  IF has_function_privilege('authenticated',
    'public.prepare_premature_simplified_festival_rerun(uuid,uuid,uuid,text,text)', 'EXECUTE')
    OR has_table_privilege('authenticated','public.festival_simplified_rerun_archives','INSERT')
    OR has_table_privilege('authenticated','public.festival_simplified_artist_payouts','INSERT') THEN
    RAISE EXCEPTION 'Festival rerun or artist-payment authority is exposed to browser clients';
  END IF;

  SELECT pg_get_functiondef(
    'public._complete_simplified_festival_settlement(uuid)'::regprocedure)
    INTO settlement_def;
  SELECT pg_get_functiondef(
    'public._festival_apply_simplified_company_effects_trigger()'::regprocedure)
    INTO trigger_def;
  SELECT pg_get_functiondef(
    'public.run_simplified_festival_edition(uuid,uuid,integer,uuid)'::regprocedure)
    INTO runtime_def;
  SELECT pg_get_functiondef(
    'public.get_festival_edition_results(uuid,uuid)'::regprocedure)
    INTO owner_results_def;

  IF settlement_def NOT LIKE '%artist_fees_minor%'
    OR trigger_def NOT LIKE '%_pay_simplified_festival_artist_bookings(NEW.id)%'
    OR runtime_def NOT LIKE '%1 grp,%'
    OR runtime_def NOT LIKE '%b.bill_rank * 100000 + b.rn%'
    OR owner_results_def NOT LIKE '%artistPayouts%' THEN
    RAISE EXCEPTION 'Festival financial, scheduling or results code lacks rerun corrections';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.festival_simplified_artist_payouts'::regclass
      AND contype='u'
      AND pg_get_constraintdef(oid) LIKE '%festival_edition_id, booking_id%'
  ) THEN
    RAISE EXCEPTION 'Artist booking payout uniqueness guard is missing';
  END IF;
END;
$test$;
