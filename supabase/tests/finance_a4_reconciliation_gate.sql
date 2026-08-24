-- Finance backlog A4: release-gate reconciliation assertions.
-- This harness is intentionally fixture-independent: it fails only when the
-- migrated database contains internally inconsistent finance state.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.band_treasuries
    WHERE balance_minor < 0
       OR reserved_balance_minor < 0
       OR reserved_balance_minor > balance_minor
  ) THEN
    RAISE EXCEPTION 'finance_a4: invalid band treasury balance/reservation state';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_payments bp
    WHERE bp.refunded_amount_minor < 0
       OR bp.refunded_amount_minor > bp.amount_minor
       OR (bp.refund_id IS NULL) <> (bp.refunded_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'finance_a4: inconsistent booking refund projection';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.booking_refunds br
    JOIN public.booking_payments bp ON bp.id = br.booking_payment_id
    WHERE br.booking_type <> bp.booking_type
       OR br.booking_id <> bp.booking_id
       OR br.payment_source <> bp.payment_source
       OR br.amount_minor <> bp.amount_minor
       OR br.currency_code <> bp.currency_code
  ) THEN
    RAISE EXCEPTION 'finance_a4: booking refund does not reconcile to original payer/payment';
  END IF;

  IF EXISTS (
    SELECT schedule_id, attempt_number
    FROM public.financial_obligation_attempts
    WHERE schedule_id IS NOT NULL
    GROUP BY schedule_id, attempt_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'finance_a4: duplicate obligation attempt number';
  END IF;

  IF EXISTS (
    SELECT obligation_id, schedule_id
    FROM public.debt_records
    WHERE status = 'open' AND schedule_id IS NOT NULL
    GROUP BY obligation_id, schedule_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'finance_a4: duplicate open debt for obligation schedule';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financial_obligations o
    WHERE o.outstanding_balance_minor < 0
       OR o.missed_payment_count < 0
  ) THEN
    RAISE EXCEPTION 'finance_a4: invalid obligation aggregate state';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.loan_schedule_lines l
    WHERE l.amount_paid_minor < 0
       OR l.principal_paid_minor < 0
       OR l.interest_paid_minor < 0
       OR l.fee_paid_minor < 0
       OR l.amount_paid_minor > l.total_due_minor
       OR l.principal_paid_minor > l.scheduled_principal_minor
       OR l.interest_paid_minor > l.scheduled_interest_minor
       OR l.fee_paid_minor > l.scheduled_fee_minor
       OR l.amount_paid_minor < (
         l.principal_paid_minor + l.interest_paid_minor + l.fee_paid_minor
       )
  ) THEN
    RAISE EXCEPTION 'finance_a4: invalid loan schedule payment projection';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.loan_contracts c
    WHERE c.outstanding_principal_minor <> COALESCE((
      SELECT sum(l.scheduled_principal_minor - l.principal_paid_minor)
      FROM public.loan_schedule_lines l
      WHERE l.loan_contract_id = c.id
        AND l.schedule_version = c.contract_version
    ), c.outstanding_principal_minor)
  ) THEN
    RAISE EXCEPTION 'finance_a4: loan principal does not reconcile to active schedule';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.banking_provider_reconciliation r
    WHERE r.receivable_difference_minor <> 0
       OR r.interest_income_difference_minor <> 0
       OR r.fee_income_difference_minor < 0
       OR r.settlement_clearing_minor <> 0
  ) THEN
    RAISE EXCEPTION 'finance_a4: banking provider ledger reconciliation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financial_obligation_schedule s
    JOIN public.financial_obligations o ON o.id = s.obligation_id
    JOIN public.mortgage_contracts c
      ON o.obligation_type = 'mortgage'
     AND o.linked_asset_type = 'mortgage_contract'
     AND o.linked_asset_id = c.id
    WHERE s.source_schedule_type = 'mortgage_schedule_line'
      AND s.status <> 'cancelled'
      AND s.source_schedule_version < COALESCE((
        SELECT max(msl.schedule_version)
        FROM public.mortgage_schedule_lines msl
        WHERE msl.mortgage_contract_id = c.id
      ), s.source_schedule_version)
      AND s.status <> 'paid'
  ) THEN
    RAISE EXCEPTION 'finance_a4: stale active mortgage obligation schedule version';
  END IF;
END;
$$;

SELECT 'finance_a4_reconciliation_gate_ok' AS result;
