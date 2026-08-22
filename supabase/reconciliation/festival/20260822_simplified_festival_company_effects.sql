-- Automatic, idempotent company effects for a completed simplified Festival.
CREATE OR REPLACE FUNCTION public._apply_simplified_festival_company_effects(p_result_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_result public.festival_simplified_edition_results%ROWTYPE;
  v_festival_company public.festival_companies%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_transaction_id uuid;
  v_balance_before_minor bigint;
  v_balance_after_minor bigint;
  v_reputation_before integer;
  v_reputation_after integer;
BEGIN
  SELECT * INTO v_result
  FROM public.festival_simplified_edition_results
  WHERE id = p_result_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_SIMPLIFIED_RESULT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_result.settlement_applied_at IS NOT NULL THEN
    RETURN v_result.company_transaction_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.company_transactions transaction
    WHERE transaction.related_entity_type = 'festival_simplified_result'
      AND transaction.related_entity_id = v_result.id
      AND transaction.category = 'festival_settlement'
  ) THEN
    RAISE EXCEPTION 'FESTIVAL_SIMPLIFIED_SETTLEMENT_INCONSISTENT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_festival_company
  FROM public.festival_companies
  WHERE id = v_result.festival_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_COMPANY_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = v_festival_company.company_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FESTIVAL_UNDERLYING_COMPANY_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_balance_before_minor := round(v_company.balance * 100)::bigint;
  v_balance_after_minor := v_balance_before_minor + v_result.net_profit_minor;
  v_reputation_before := coalesce(v_company.reputation_score, 0);
  v_reputation_after := greatest(0, v_reputation_before + v_result.reputation_change);

  UPDATE public.companies
  SET balance = v_balance_after_minor::numeric / 100,
      reputation_score = v_reputation_after,
      updated_at = now()
  WHERE id = v_company.id;

  UPDATE public.festival_companies
  SET updated_at = now()
  WHERE id = v_result.festival_company_id;

  INSERT INTO public.company_transactions(
    company_id, transaction_type, amount, description,
    related_entity_id, related_entity_type, category
  ) VALUES (
    v_company.id,
    CASE WHEN v_result.net_profit_minor < 0 THEN 'expense' ELSE 'income' END,
    abs(v_result.net_profit_minor)::numeric / 100,
    CASE
      WHEN v_result.net_profit_minor < 0 THEN 'Festival annual result: operating loss'
      WHEN v_result.net_profit_minor > 0 THEN 'Festival annual result: net profit'
      ELSE 'Festival annual result: break even'
    END,
    v_result.id, 'festival_simplified_result', 'festival_settlement'
  )
  RETURNING id INTO v_transaction_id;

  UPDATE public.festival_simplified_edition_results
  SET settlement_applied_at = now(),
      company_transaction_id = v_transaction_id,
      company_balance_before_minor = v_balance_before_minor,
      company_balance_after_minor = v_balance_after_minor,
      company_reputation_before = v_reputation_before,
      company_reputation_after = v_reputation_after,
      result_snapshot = result_snapshot || jsonb_build_object(
        'settlementApplied', true,
        'companyTransactionId', v_transaction_id,
        'companyBalanceBeforeMinor', v_balance_before_minor,
        'companyBalanceAfterMinor', v_balance_after_minor,
        'companyReputationBefore', v_reputation_before,
        'companyReputationAfter', v_reputation_after
      )
  WHERE id = v_result.id;

  RETURN v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public._apply_simplified_festival_company_effects(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._apply_simplified_festival_company_effects(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public._festival_apply_simplified_company_effects_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
  PERFORM public._apply_simplified_festival_company_effects(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._festival_apply_simplified_company_effects_trigger()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS festival_apply_simplified_company_effects
  ON public.festival_simplified_edition_results;
CREATE TRIGGER festival_apply_simplified_company_effects
AFTER INSERT ON public.festival_simplified_edition_results
FOR EACH ROW
EXECUTE FUNCTION public._festival_apply_simplified_company_effects_trigger();

DO $$
DECLARE
  v_result_id uuid;
BEGIN
  FOR v_result_id IN
    SELECT id FROM public.festival_simplified_edition_results
    WHERE settlement_applied_at IS NULL
    ORDER BY completed_at, id
  LOOP
    PERFORM public._apply_simplified_festival_company_effects(v_result_id);
  END LOOP;
END;
$$;
