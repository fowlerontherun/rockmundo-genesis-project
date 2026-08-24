\set ON_ERROR_STOP on

DO $$
DECLARE
  v_unbalanced integer := 0;
BEGIN
  IF to_regclass('public.finance_journal_entries') IS NOT NULL
     AND to_regclass('public.finance_journal_lines') IS NOT NULL THEN
    EXECUTE $q$
      SELECT count(*)
      FROM (
        SELECT journal_entry_id
        FROM public.finance_journal_lines
        GROUP BY journal_entry_id
        HAVING COALESCE(sum(amount_minor), 0) <> 0
      ) x
    $q$ INTO v_unbalanced;

    IF v_unbalanced > 0 THEN
      RAISE EXCEPTION 'finance reconciliation failed: % unbalanced journal entries', v_unbalanced;
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  v_duplicates integer := 0;
BEGIN
  IF to_regclass('public.band_contribution_events') IS NOT NULL THEN
    SELECT count(*) INTO v_duplicates
    FROM (
      SELECT idempotency_key
      FROM public.band_contribution_events
      WHERE idempotency_key IS NOT NULL
      GROUP BY idempotency_key
      HAVING count(*) > 1
    ) x;

    IF v_duplicates > 0 THEN
      RAISE EXCEPTION 'finance reconciliation failed: % duplicate band contribution idempotency keys', v_duplicates;
    END IF;
  END IF;
END $$;

SELECT 'finance reconciliation checks passed' AS result;
