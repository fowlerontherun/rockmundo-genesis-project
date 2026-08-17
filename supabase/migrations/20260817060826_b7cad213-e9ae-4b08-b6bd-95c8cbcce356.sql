
-- =========================================================
-- Festival edition settlement engine
-- =========================================================

CREATE TABLE IF NOT EXISTS public.festival_settlement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL,
  line_kind text NOT NULL CHECK (line_kind IN ('revenue','cost')),
  category text NOT NULL,
  gross_amount_minor bigint NOT NULL DEFAULT 0,
  net_amount_minor bigint NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  cash_state text NOT NULL DEFAULT 'due'
    CHECK (cash_state IN ('due','received','paid','receivable','payable','already_posted','not_applicable','written_off','cancelled')),
  source_type text NOT NULL DEFAULT 'system',
  source_id uuid,
  counterparty_type text,
  counterparty_id uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.festival_settlement_lines TO authenticated;
GRANT ALL ON public.festival_settlement_lines TO service_role;
ALTER TABLE public.festival_settlement_lines ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.festival_settlement_posting_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES public.festival_edition_settlements(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending',
  expected_items integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  failed_items integer NOT NULL DEFAULT 0,
  failed_line_id uuid,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.festival_settlement_posting_batches TO authenticated;
GRANT ALL ON public.festival_settlement_posting_batches TO service_role;
ALTER TABLE public.festival_settlement_posting_batches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS festival_settlement_lines_settlement_idx ON public.festival_settlement_lines(settlement_id);
CREATE INDEX IF NOT EXISTS festival_settlement_batches_settlement_idx ON public.festival_settlement_posting_batches(settlement_id);

CREATE POLICY "Festival owners read settlement lines" ON public.festival_settlement_lines
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.festival_edition_settlements s
    JOIN public.festival_editions_v2 e ON e.id = s.edition_id
    JOIN public.festival_companies fc ON fc.id = e.festival_company_id
    WHERE s.id = festival_settlement_lines.settlement_id
      AND (fc.owner_profile_id = public._caller_profile_id() OR public.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "Festival owners read posting batches" ON public.festival_settlement_posting_batches
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.festival_edition_settlements s
    JOIN public.festival_editions_v2 e ON e.id = s.edition_id
    JOIN public.festival_companies fc ON fc.id = e.festival_company_id
    WHERE s.id = festival_settlement_posting_batches.settlement_id
      AND (fc.owner_profile_id = public._caller_profile_id() OR public.has_role(auth.uid(),'admin'))
  )
);

CREATE TRIGGER festival_settlement_lines_updated_at BEFORE UPDATE ON public.festival_settlement_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER festival_settlement_batches_updated_at BEFORE UPDATE ON public.festival_settlement_posting_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- Authorisation helper
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public._festival_edition_authorised(p_edition_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.festival_editions_v2 e
    JOIN public.festival_companies fc ON fc.id = e.festival_company_id
    WHERE e.id = p_edition_id
      AND (fc.owner_profile_id = public._caller_profile_id() OR public.has_role(auth.uid(),'admin'))
  );
$$;

CREATE OR REPLACE FUNCTION public._festival_settlement_company(p_settlement_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fc.company_id
  FROM public.festival_edition_settlements s
  JOIN public.festival_editions_v2 e ON e.id = s.edition_id
  JOIN public.festival_companies fc ON fc.id = e.festival_company_id
  WHERE s.id = p_settlement_id;
$$;

-- ---------------------------------------------------------
-- Aggregate projection
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public._festival_settlement_aggregate(p_settlement_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; agg record;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT
    COALESCE(SUM(CASE WHEN line_kind='revenue' AND cash_state <> 'cancelled' THEN net_amount_minor ELSE 0 END),0) AS revenue,
    COALESCE(SUM(CASE WHEN line_kind='cost' AND cash_state <> 'cancelled' THEN net_amount_minor ELSE 0 END),0) AS costs,
    COALESCE(SUM(CASE WHEN category='tax' THEN net_amount_minor ELSE 0 END),0) AS tax,
    COALESCE(SUM(CASE WHEN category='refunds' THEN net_amount_minor ELSE 0 END),0) AS refunds,
    COALESCE(SUM(CASE WHEN cash_state='received' THEN net_amount_minor WHEN cash_state='paid' THEN -net_amount_minor ELSE 0 END),0) AS cash_posted,
    COALESCE(SUM(CASE WHEN cash_state='receivable' THEN net_amount_minor ELSE 0 END),0) AS unpaid_receivables,
    COALESCE(SUM(CASE WHEN cash_state='payable' THEN net_amount_minor ELSE 0 END),0) AS unpaid_payables
  INTO agg FROM public.festival_settlement_lines WHERE settlement_id = p_settlement_id;

  RETURN jsonb_build_object(
    'id', s.id,
    'state', s.status::text,
    'settlement_version', COALESCE(s.settlement_version,1),
    'currency_code', COALESCE(s.currency_code,'USD'),
    'gross_revenue_minor', agg.revenue,
    'total_costs_minor', agg.costs,
    'tax_minor', agg.tax,
    'refunds_minor', agg.refunds,
    'net_profit_loss_minor', agg.revenue - agg.costs,
    'cash_posted_minor', agg.cash_posted,
    'amount_posted_to_company_minor', agg.cash_posted,
    'unpaid_receivables_minor', agg.unpaid_receivables,
    'unpaid_payables_minor', agg.unpaid_payables,
    'reconciliation_status', CASE WHEN agg.unpaid_receivables = 0 AND agg.unpaid_payables = 0 THEN 'reconciled' ELSE 'outstanding' END
  );
END; $$;

-- ---------------------------------------------------------
-- Readiness
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_festival_edition_settlement_readiness(p_festival_company_id uuid, p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rt record; e record; blockers text[] := ARRAY[]::text[]; exists_settlement boolean;
BEGIN
  IF NOT public._festival_edition_authorised(p_edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  SELECT * INTO e FROM public.festival_editions_v2 WHERE id = p_edition_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_edition_not_found'; END IF;
  SELECT * INTO rt FROM public.festival_edition_runtimes WHERE edition_id = p_edition_id ORDER BY created_at DESC LIMIT 1;
  SELECT EXISTS(SELECT 1 FROM public.festival_edition_settlements WHERE edition_id = p_edition_id AND status <> 'cancelled') INTO exists_settlement;

  IF rt.id IS NULL THEN blockers := blockers || 'runtime_not_prepared';
  ELSIF rt.state NOT IN ('completed','closing') THEN blockers := blockers || 'runtime_not_complete';
  END IF;

  RETURN jsonb_build_object(
    'runtimeState', COALESCE(rt.state,'not_prepared'),
    'runtimeId', rt.id,
    'runtimeDigest', CASE WHEN rt.id IS NULL THEN NULL ELSE md5(rt.id::text || ':' || rt.version::text || ':' || rt.state) END,
    'settlementExists', exists_settlement,
    'eligible', array_length(blockers,1) IS NULL AND NOT exists_settlement,
    'blockers', to_jsonb(blockers)
  );
END; $$;

-- ---------------------------------------------------------
-- Line generation
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public._festival_generate_settlement_lines(p_settlement_id uuid, p_edition_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_currency text; v_count integer := 0;
BEGIN
  SELECT e.festival_company_id INTO v_company FROM public.festival_editions_v2 e WHERE e.id = p_edition_id;
  SELECT COALESCE(currency_code,'USD') INTO v_currency FROM public.festival_edition_settlements WHERE id = p_settlement_id;

  -- Ticket revenue (net of fees and tax)
  INSERT INTO public.festival_settlement_lines (settlement_id, edition_id, line_kind, category, gross_amount_minor, net_amount_minor, currency_code, source_type, source_id)
  SELECT p_settlement_id, p_edition_id, 'revenue', 'ticket_sales',
         COALESCE(SUM(ts.total_minor),0), COALESCE(SUM(ts.subtotal_minor),0), v_currency, 'festival_ticket_sales', NULL
  FROM public.festival_ticket_sales ts
  JOIN public.festival_launches l ON l.id = ts.festival_launch_id
  WHERE l.festival_company_id = v_company AND ts.status = 'completed'
  HAVING COALESCE(SUM(ts.subtotal_minor),0) > 0;

  INSERT INTO public.festival_settlement_lines (settlement_id, edition_id, line_kind, category, gross_amount_minor, net_amount_minor, currency_code, source_type)
  SELECT p_settlement_id, p_edition_id, 'cost', 'tax', COALESCE(SUM(ts.tax_minor),0), COALESCE(SUM(ts.tax_minor),0), v_currency, 'festival_ticket_sales'
  FROM public.festival_ticket_sales ts
  JOIN public.festival_launches l ON l.id = ts.festival_launch_id
  WHERE l.festival_company_id = v_company AND ts.status = 'completed'
  HAVING COALESCE(SUM(ts.tax_minor),0) > 0;

  -- Expense ledger entries recorded for this edition
  INSERT INTO public.festival_settlement_lines (settlement_id, edition_id, line_kind, category, gross_amount_minor, net_amount_minor, currency_code, source_type, source_id, counterparty_type, counterparty_id)
  SELECT p_settlement_id, p_edition_id,
         CASE WHEN el.direction = 'in' THEN 'revenue' ELSE 'cost' END,
         COALESCE(el.category,'operations'), ABS(el.amount_cents), ABS(el.amount_cents),
         COALESCE(el.currency_code, v_currency), 'festival_expense_ledger', el.id, el.counterparty_type, el.counterparty_id
  FROM public.festival_expense_ledger el
  WHERE el.edition_id = p_edition_id;

  -- Supplier commitments
  INSERT INTO public.festival_settlement_lines (settlement_id, edition_id, line_kind, category, gross_amount_minor, net_amount_minor, currency_code, source_type, source_id, counterparty_type, counterparty_id)
  SELECT p_settlement_id, p_edition_id, 'cost', 'suppliers', sc.total_commitment_minor, sc.total_commitment_minor,
         COALESCE(sc.currency_code, v_currency), 'festival_supplier_contracts', sc.id, 'company', sc.supplier_company_id
  FROM public.festival_supplier_contracts sc
  JOIN public.festival_operations_plans op ON op.id = sc.festival_operations_plan_id
  WHERE op.festival_company_id = v_company AND sc.status NOT IN ('cancelled','draft') AND COALESCE(sc.total_commitment_minor,0) > 0;

  -- Artist fees from active contracts
  INSERT INTO public.festival_settlement_lines (settlement_id, edition_id, line_kind, category, gross_amount_minor, net_amount_minor, currency_code, source_type, source_id, counterparty_type, counterparty_id)
  SELECT p_settlement_id, p_edition_id, 'cost', 'artist_fees',
         GREATEST(COALESCE((c.terms_snapshot->>'fee_minor')::bigint, (c.terms_snapshot->>'guarantee_minor')::bigint, 0),0),
         GREATEST(COALESCE((c.terms_snapshot->>'fee_minor')::bigint, (c.terms_snapshot->>'guarantee_minor')::bigint, 0),0),
         v_currency, 'festival_contracts', c.id, 'band', c.band_id
  FROM public.festival_contracts c
  WHERE c.edition_id = p_edition_id
    AND c.status IN ('active','fulfilled')
    AND COALESCE((c.terms_snapshot->>'fee_minor')::bigint, (c.terms_snapshot->>'guarantee_minor')::bigint, 0) > 0;

  SELECT COUNT(*) INTO v_count FROM public.festival_settlement_lines WHERE settlement_id = p_settlement_id;
  RETURN v_count;
END; $$;

-- ---------------------------------------------------------
-- Prepare
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_festival_edition_settlement(
  p_edition_id uuid, p_expected_runtime_digest text, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settlement public.festival_edition_settlements%ROWTYPE; v_readiness jsonb; v_edition record;
BEGIN
  IF NOT public._festival_edition_authorised(p_edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  SELECT * INTO v_edition FROM public.festival_editions_v2 WHERE id = p_edition_id;

  SELECT * INTO v_settlement FROM public.festival_edition_settlements
  WHERE edition_id = p_edition_id AND idempotency_key = p_idempotency_key LIMIT 1;
  IF FOUND THEN RETURN public._festival_settlement_aggregate(v_settlement.id); END IF;

  v_readiness := public.get_festival_edition_settlement_readiness(v_edition.festival_company_id, p_edition_id);
  IF p_expected_runtime_digest IS NOT NULL AND COALESCE(v_readiness->>'runtimeDigest','') <> p_expected_runtime_digest THEN
    RAISE EXCEPTION 'festival_settlement_stale';
  END IF;
  IF jsonb_array_length(v_readiness->'blockers') > 0 THEN RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;

  INSERT INTO public.festival_edition_settlements (edition_id, festival_id, status, settlement_version, currency_code,
      readiness_snapshot, input_snapshot, input_hash, calculation_config_version, started_by_profile_id, idempotency_key, locked_at)
  VALUES (p_edition_id, v_edition.festival_company_id, 'locked', 1, 'USD', v_readiness, jsonb_build_object('editionId', p_edition_id),
      md5(p_edition_id::text || COALESCE(p_expected_runtime_digest,'')), 'v1', public._caller_profile_id(), p_idempotency_key, now())
  RETURNING * INTO v_settlement;

  PERFORM public._festival_generate_settlement_lines(v_settlement.id, p_edition_id);

  INSERT INTO public.festival_settlement_events (settlement_id, edition_id, event_type, to_status, actor_profile_id, authority, idempotency_key)
  VALUES (v_settlement.id, p_edition_id, 'prepared', 'locked', public._caller_profile_id(), 'owner', p_idempotency_key);

  RETURN public._festival_settlement_aggregate(v_settlement.id);
END; $$;

-- ---------------------------------------------------------
-- Approve
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_festival_edition_settlement(p_settlement_id uuid, p_expected_version integer, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  IF s.settlement_version <> p_expected_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;

  IF s.status = 'locked' THEN
    UPDATE public.festival_edition_settlements
      SET status = 'settling_revenue', settlement_version = settlement_version + 1, last_completed_phase = 'approved', updated_at = now()
      WHERE id = p_settlement_id;
    INSERT INTO public.festival_settlement_events (settlement_id, edition_id, event_type, from_status, to_status, actor_profile_id, authority, idempotency_key)
    VALUES (p_settlement_id, s.edition_id, 'approved', 'locked', 'settling_revenue', public._caller_profile_id(), 'owner', p_idempotency_key);
  END IF;
  RETURN public._festival_settlement_aggregate(p_settlement_id);
END; $$;

-- ---------------------------------------------------------
-- Posting
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public._festival_posting_result(p_batch_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.festival_settlement_posting_batches%ROWTYPE; v_pending integer;
BEGIN
  SELECT * INTO b FROM public.festival_settlement_posting_batches WHERE id = p_batch_id;
  SELECT COUNT(*) INTO v_pending FROM public.festival_settlement_lines WHERE settlement_id = b.settlement_id AND cash_state = 'due';
  RETURN jsonb_build_object(
    'state', b.state, 'settlementId', b.settlement_id, 'postingBatchId', b.id,
    'completedItems', b.completed_items, 'expectedItems', b.expected_items,
    'pendingItems', v_pending, 'failedItems', b.failed_items)
    || CASE WHEN b.failed_line_id IS NOT NULL THEN jsonb_build_object('failedLineId', b.failed_line_id) ELSE '{}'::jsonb END
    || CASE WHEN b.error_code IS NOT NULL THEN jsonb_build_object('errorCode', b.error_code) ELSE '{}'::jsonb END;
END; $$;

CREATE OR REPLACE FUNCTION public.start_festival_edition_settlement_posting(p_settlement_id uuid, p_expected_version integer, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; b public.festival_settlement_posting_batches%ROWTYPE; v_expected integer;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  IF s.settlement_version <> p_expected_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;

  SELECT * INTO b FROM public.festival_settlement_posting_batches WHERE settlement_id = p_settlement_id ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND b.state IN ('posting','completed') THEN RETURN public._festival_posting_result(b.id); END IF;

  SELECT COUNT(*) INTO v_expected FROM public.festival_settlement_lines WHERE settlement_id = p_settlement_id AND cash_state = 'due';
  INSERT INTO public.festival_settlement_posting_batches (settlement_id, state, expected_items)
  VALUES (p_settlement_id, 'posting', v_expected) RETURNING * INTO b;

  UPDATE public.festival_edition_settlements SET status = 'settling_revenue', last_completed_phase = 'posting_started', updated_at = now()
  WHERE id = p_settlement_id;
  RETURN public._festival_posting_result(b.id);
END; $$;

CREATE OR REPLACE FUNCTION public.post_next_festival_edition_settlement_item(p_settlement_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; b public.festival_settlement_posting_batches%ROWTYPE;
        ln public.festival_settlement_lines%ROWTYPE; v_company uuid; v_balance numeric; v_delta numeric;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;

  SELECT * INTO b FROM public.festival_settlement_posting_batches WHERE settlement_id = p_settlement_id ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;

  SELECT * INTO ln FROM public.festival_settlement_lines
  WHERE settlement_id = p_settlement_id AND cash_state = 'due' ORDER BY line_kind DESC, created_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN public._festival_posting_result(b.id); END IF;

  v_company := public._festival_settlement_company(p_settlement_id);
  SELECT balance INTO v_balance FROM public.companies WHERE id = v_company FOR UPDATE;
  v_delta := ln.net_amount_minor / 100.0;

  IF ln.line_kind = 'revenue' THEN
    UPDATE public.companies SET balance = COALESCE(balance,0) + v_delta, updated_at = now() WHERE id = v_company;
    UPDATE public.festival_settlement_lines SET cash_state = 'received', posted_at = now() WHERE id = ln.id;
  ELSIF COALESCE(v_balance,0) >= v_delta THEN
    UPDATE public.companies SET balance = COALESCE(balance,0) - v_delta, updated_at = now() WHERE id = v_company;
    UPDATE public.festival_settlement_lines SET cash_state = 'paid', posted_at = now() WHERE id = ln.id;
  ELSE
    UPDATE public.festival_settlement_lines SET cash_state = 'payable' WHERE id = ln.id;
  END IF;

  UPDATE public.festival_settlement_posting_batches
    SET completed_items = completed_items + 1, updated_at = now() WHERE id = b.id;

  INSERT INTO public.festival_settlement_transactions (settlement_id, edition_id, entity_type, entity_id, category, direction,
      gross_amount_cents, net_amount_cents, currency_code, status, idempotency_key, completed_at)
  VALUES (p_settlement_id, s.edition_id, ln.source_type, ln.source_id, ln.category,
      CASE WHEN ln.line_kind='revenue' THEN 'inbound' ELSE 'outbound' END,
      ln.gross_amount_minor, ln.net_amount_minor, ln.currency_code, 'applied',
      p_idempotency_key || ':' || ln.id::text, now())
  ON CONFLICT DO NOTHING;

  RETURN public._festival_posting_result(b.id);
END; $$;

CREATE OR REPLACE FUNCTION public.finalise_festival_edition_settlement_posting(p_settlement_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; b public.festival_settlement_posting_batches%ROWTYPE; v_pending integer;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  SELECT * INTO b FROM public.festival_settlement_posting_batches WHERE settlement_id = p_settlement_id ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;
  SELECT COUNT(*) INTO v_pending FROM public.festival_settlement_lines WHERE settlement_id = p_settlement_id AND cash_state = 'due';
  IF v_pending > 0 THEN RETURN public._festival_posting_result(b.id); END IF;

  UPDATE public.festival_settlement_posting_batches SET state = 'completed', updated_at = now() WHERE id = b.id;
  UPDATE public.festival_edition_settlements
    SET status = 'applying_effects', revenue_settled_at = now(), contracts_settled_at = now(),
        last_completed_phase = 'posting_complete', settlement_version = settlement_version + 1, updated_at = now()
    WHERE id = p_settlement_id;
  INSERT INTO public.festival_settlement_events (settlement_id, edition_id, event_type, to_status, actor_profile_id, authority, idempotency_key)
  VALUES (p_settlement_id, s.edition_id, 'posting_finalised', 'applying_effects', public._caller_profile_id(), 'owner', p_idempotency_key);
  RETURN public._festival_posting_result(b.id);
END; $$;

-- ---------------------------------------------------------
-- Outcomes / effects
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_festival_edition_outcomes(p_settlement_id uuid, p_expected_version integer, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  IF s.settlement_version <> p_expected_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;

  INSERT INTO public.festival_effect_applications (settlement_id, effect_type, entity_type, entity_id, proposed_value, approved_value,
      before_value, after_value, application_status, source_outcome_id, idempotency_key, applied_at)
  SELECT p_settlement_id, 'performance_result', 'band', o.band_id, o.overall_score, o.overall_score, 0, o.overall_score,
      'applied'::festival_settlement_application_status, o.id, p_idempotency_key || ':' || o.id::text, now()
  FROM public.festival_performance_outcomes o
  WHERE o.edition_id = s.edition_id AND o.invalidated_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.festival_effect_applications ea WHERE ea.settlement_id = p_settlement_id AND ea.source_outcome_id = o.id);

  UPDATE public.festival_edition_settlements
    SET effects_applied_at = now(), status = 'reconciling', last_completed_phase = 'effects_applied',
        settlement_version = settlement_version + 1, updated_at = now()
    WHERE id = p_settlement_id;
  RETURN public._festival_settlement_aggregate(p_settlement_id);
END; $$;

CREATE OR REPLACE FUNCTION public.get_festival_settlement_effect_progress(p_settlement_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; v_status jsonb; v_type jsonb; v_total integer; v_outcomes integer; v_dead integer; v_remaining integer;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;

  SELECT COALESCE(jsonb_object_agg(k, c), '{}'::jsonb) INTO v_status FROM (
    SELECT application_status::text AS k, COUNT(*)::int AS c FROM public.festival_effect_applications
    WHERE settlement_id = p_settlement_id GROUP BY 1) q;
  SELECT COALESCE(jsonb_object_agg(k, c), '{}'::jsonb) INTO v_type FROM (
    SELECT effect_type AS k, COUNT(*)::int AS c FROM public.festival_effect_applications
    WHERE settlement_id = p_settlement_id GROUP BY 1) q;
  SELECT COUNT(*) INTO v_total FROM public.festival_effect_applications WHERE settlement_id = p_settlement_id;
  SELECT COUNT(*) INTO v_dead FROM public.festival_effect_applications WHERE settlement_id = p_settlement_id AND application_status = 'failed';
  SELECT COUNT(*) INTO v_outcomes FROM public.festival_performance_outcomes WHERE edition_id = s.edition_id AND invalidated_at IS NULL;
  SELECT COUNT(*) INTO v_remaining FROM public.festival_effect_applications
    WHERE settlement_id = p_settlement_id AND application_status IN ('pending','blocked');

  RETURN jsonb_build_object(
    'settlementId', p_settlement_id, 'state', s.status::text,
    'outcomeCount', v_outcomes, 'effectTotal', v_total,
    'countsByStatus', v_status, 'countsByEffectType', v_type,
    'lastFailure', NULL, 'deadLetterCount', v_dead,
    'requiredEffectsRemaining', v_remaining,
    'taxReconciled', true,
    'finalisationEligible', v_remaining = 0 AND v_dead = 0 AND s.effects_applied_at IS NOT NULL,
    'finalisationBlockers', to_jsonb(
      CASE WHEN s.effects_applied_at IS NULL THEN ARRAY['effects_not_applied']
           WHEN v_remaining > 0 THEN ARRAY['effects_pending']
           WHEN v_dead > 0 THEN ARRAY['effects_failed']
           ELSE ARRAY[]::text[] END)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.resume_festival_settlement_effects(p_settlement_id uuid, p_effect_ids uuid[], p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  UPDATE public.festival_effect_applications
    SET application_status = 'pending', failure_code = NULL, failure_reason = NULL
    WHERE settlement_id = p_settlement_id AND application_status = 'failed'
      AND (p_effect_ids IS NULL OR id = ANY(p_effect_ids));
  INSERT INTO public.festival_settlement_events (settlement_id, edition_id, event_type, actor_profile_id, authority, reason)
  VALUES (p_settlement_id, s.edition_id, 'effects_resumed', public._caller_profile_id(), 'owner', p_reason);
  RETURN public.get_festival_settlement_effect_progress(p_settlement_id);
END; $$;

-- ---------------------------------------------------------
-- Public history + finalisation
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_festival_edition_history(p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; fc record; v_attendance integer; v_score numeric; v_net bigint; v_completed timestamptz;
BEGIN
  SELECT * INTO e FROM public.festival_editions_v2 WHERE id = p_edition_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO fc FROM public.festival_companies WHERE id = e.festival_company_id;
  SELECT COALESCE(MAX(admitted),0) INTO v_attendance FROM public.festival_edition_runtimes WHERE edition_id = p_edition_id;
  SELECT ROUND(AVG(overall_score)::numeric, 2) INTO v_score FROM public.festival_performance_outcomes WHERE edition_id = p_edition_id AND invalidated_at IS NULL;
  SELECT COALESCE(SUM(CASE WHEN line_kind='revenue' THEN net_amount_minor ELSE -net_amount_minor END),0) INTO v_net
    FROM public.festival_settlement_lines fl
    JOIN public.festival_edition_settlements fs ON fs.id = fl.settlement_id
    WHERE fs.edition_id = p_edition_id;
  SELECT COALESCE(MAX(completed_at), e.completed_at, e.updated_at) INTO v_completed
    FROM public.festival_edition_settlements WHERE edition_id = p_edition_id;

  RETURN jsonb_build_object(
    'festivalName', COALESCE(fc.public_name, e.name, 'Festival'),
    'editionYear', e.edition_year,
    'dates', jsonb_build_object('startsOn', e.starts_on, 'endsOn', e.ends_on),
    'location', jsonb_build_object('countryCode', e.country_code, 'cityId', e.city_id),
    'lineup', COALESCE((SELECT jsonb_agg(jsonb_build_object('bandId', c.band_id, 'status', c.status)) FROM public.festival_contracts c WHERE c.edition_id = p_edition_id), '[]'::jsonb),
    'headliners', '[]'::jsonb,
    'publishedSchedule', '[]'::jsonb,
    'attendance', v_attendance,
    'audienceScore', v_score,
    'profitabilityBand', CASE WHEN v_net > 0 THEN 'profitable' WHEN v_net = 0 THEN 'break_even' ELSE 'loss' END,
    'completedAt', COALESCE(v_completed, now()),
    'achievements', '[]'::jsonb,
    'highlights', '[]'::jsonb,
    'reputationChange', 0,
    'fameChange', 0
  );
END; $$;

CREATE OR REPLACE FUNCTION public.finalise_festival_edition_settlement(p_settlement_id uuid, p_expected_version integer, p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; v_progress jsonb;
BEGIN
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  IF s.status <> 'completed' AND s.settlement_version <> p_expected_version THEN RAISE EXCEPTION 'festival_settlement_stale'; END IF;

  IF s.status <> 'completed' THEN
    v_progress := public.get_festival_settlement_effect_progress(p_settlement_id);
    IF NOT (v_progress->>'finalisationEligible')::boolean THEN RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;

    UPDATE public.festival_edition_settlements
      SET status = 'completed', completed_at = now(), reconciled_at = now(),
          last_completed_phase = 'finalised', settlement_version = settlement_version + 1, updated_at = now()
      WHERE id = p_settlement_id;

    INSERT INTO public.festival_edition_financial_results (edition_id, settlement_id, total_ticket_revenue_cents,
        operations_costs_cents, performer_costs_cents, tax_cents, gross_profit_cents, net_profit_cents, cash_result_cents,
        unpaid_obligations_cents, currency_code, calculation_snapshot)
    SELECT s.edition_id, p_settlement_id,
      COALESCE(SUM(CASE WHEN category='ticket_sales' THEN net_amount_minor ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_kind='cost' AND category NOT IN ('artist_fees','tax') THEN net_amount_minor ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN category='artist_fees' THEN net_amount_minor ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN category='tax' THEN net_amount_minor ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN line_kind='revenue' THEN net_amount_minor ELSE -net_amount_minor END),0),
      COALESCE(SUM(CASE WHEN line_kind='revenue' THEN net_amount_minor ELSE -net_amount_minor END),0),
      COALESCE(SUM(CASE WHEN cash_state='received' THEN net_amount_minor WHEN cash_state='paid' THEN -net_amount_minor ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN cash_state IN ('payable','receivable') THEN net_amount_minor ELSE 0 END),0),
      'USD', jsonb_build_object('source','festival_settlement_lines')
    FROM public.festival_settlement_lines WHERE settlement_id = p_settlement_id
    ON CONFLICT DO NOTHING;

    UPDATE public.festival_editions_v2 SET status = 'completed', completed_at = now(), updated_at = now()
      WHERE id = s.edition_id AND status <> 'completed';

    INSERT INTO public.festival_settlement_events (settlement_id, edition_id, event_type, to_status, actor_profile_id, authority, idempotency_key)
    VALUES (p_settlement_id, s.edition_id, 'finalised', 'completed', public._caller_profile_id(), 'owner', p_idempotency_key);
  END IF;

  RETURN jsonb_build_object(
    'settlement', public._festival_settlement_aggregate(p_settlement_id),
    'outcomes', COALESCE((SELECT jsonb_agg(jsonb_build_object('outcome_type','performance','subject_id', o.band_id, 'final_score', o.overall_score))
                          FROM public.festival_performance_outcomes o WHERE o.edition_id = s.edition_id AND o.invalidated_at IS NULL), '[]'::jsonb),
    'achievements', '[]'::jsonb,
    'licenceProgress', NULL,
    'publicHistory', public.get_public_festival_edition_history(s.edition_id)
  );
END; $$;

-- ---------------------------------------------------------
-- Settlement report
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_festival_edition_settlement(p_festival_company_id uuid, p_edition_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.festival_edition_settlements%ROWTYPE; b public.festival_settlement_posting_batches%ROWTYPE; v_pending integer;
BEGIN
  IF NOT public._festival_edition_authorised(p_edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  SELECT * INTO s FROM public.festival_edition_settlements WHERE edition_id = p_edition_id AND status <> 'cancelled'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO b FROM public.festival_settlement_posting_batches WHERE settlement_id = s.id ORDER BY created_at DESC LIMIT 1;
  SELECT COUNT(*) INTO v_pending FROM public.festival_settlement_lines WHERE settlement_id = s.id AND cash_state = 'due';

  RETURN jsonb_build_object(
    'settlement', public._festival_settlement_aggregate(s.id),
    'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'line_kind', l.line_kind, 'category', l.category,
        'net_amount_minor', l.net_amount_minor, 'currency_code', l.currency_code, 'cash_state', l.cash_state,
        'source_type', l.source_type) ORDER BY l.created_at)
      FROM public.festival_settlement_lines l WHERE l.settlement_id = s.id), '[]'::jsonb),
    'outcomes', COALESCE((SELECT jsonb_agg(jsonb_build_object('outcome_type','performance','subject_id', o.band_id, 'final_score', o.overall_score))
      FROM public.festival_performance_outcomes o WHERE o.edition_id = s.edition_id AND o.invalidated_at IS NULL), '[]'::jsonb),
    'batch', CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('id', b.id, 'state', b.state,
        'completed_items', b.completed_items, 'expected_items', b.expected_items,
        'pending_items', v_pending, 'failed_items', b.failed_items) END,
    'audit', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ev.id, 'action', ev.event_type,
        'status', COALESCE(ev.to_status::text,'info'), 'created_at', ev.created_at) ORDER BY ev.created_at DESC)
      FROM public.festival_settlement_events ev WHERE ev.settlement_id = s.id), '[]'::jsonb)
  );
END; $$;

-- ---------------------------------------------------------
-- Line cash operations
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public._festival_settlement_line_op(p_line_id uuid, p_from text[], p_to text, p_apply_cash boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ln public.festival_settlement_lines%ROWTYPE; s public.festival_edition_settlements%ROWTYPE; v_company uuid; v_balance numeric; v_delta numeric;
BEGIN
  SELECT * INTO ln FROM public.festival_settlement_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_settlement_failed'; END IF;
  SELECT * INTO s FROM public.festival_edition_settlements WHERE id = ln.settlement_id;
  IF NOT public._festival_edition_authorised(s.edition_id) THEN RAISE EXCEPTION 'festival_settlement_forbidden'; END IF;
  IF NOT (ln.cash_state = ANY(p_from)) THEN RAISE EXCEPTION 'festival_settlement_not_ready'; END IF;

  IF p_apply_cash THEN
    v_company := public._festival_settlement_company(ln.settlement_id);
    v_delta := ln.net_amount_minor / 100.0;
    SELECT balance INTO v_balance FROM public.companies WHERE id = v_company FOR UPDATE;
    IF p_to = 'received' THEN
      UPDATE public.companies SET balance = COALESCE(balance,0) + v_delta, updated_at = now() WHERE id = v_company;
    ELSE
      IF COALESCE(v_balance,0) < v_delta THEN RAISE EXCEPTION 'festival_settlement_insufficient_funds'; END IF;
      UPDATE public.companies SET balance = COALESCE(balance,0) - v_delta, updated_at = now() WHERE id = v_company;
    END IF;
  END IF;

  UPDATE public.festival_settlement_lines SET cash_state = p_to, posted_at = COALESCE(posted_at, now()) WHERE id = p_line_id;
  RETURN public._festival_settlement_aggregate(ln.settlement_id);
END; $$;

CREATE OR REPLACE FUNCTION public.receive_festival_settlement_receivable(p_line_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._festival_settlement_line_op(p_line_id, ARRAY['receivable','due'], 'received', true);
$$;

CREATE OR REPLACE FUNCTION public.pay_festival_settlement_payable(p_line_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._festival_settlement_line_op(p_line_id, ARRAY['payable','due'], 'paid', true);
$$;

CREATE OR REPLACE FUNCTION public.write_off_festival_settlement_receivable(p_line_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._festival_settlement_line_op(p_line_id, ARRAY['receivable','due'], 'written_off', false);
$$;

CREATE OR REPLACE FUNCTION public.cancel_festival_settlement_payable(p_line_id uuid, p_idempotency_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public._festival_settlement_line_op(p_line_id, ARRAY['payable','due'], 'cancelled', false);
$$;

GRANT EXECUTE ON FUNCTION public.get_festival_edition_settlement_readiness(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_settlement(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_festival_edition_settlement(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_festival_edition_settlement(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_festival_edition_settlement_posting(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_next_festival_edition_settlement_item(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalise_festival_edition_settlement_posting(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_festival_edition_outcomes(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_festival_settlement_effect_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_festival_settlement_effects(uuid,uuid[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalise_festival_edition_settlement(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_festival_settlement_receivable(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_festival_settlement_payable(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_off_festival_settlement_receivable(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_festival_settlement_payable(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_festival_edition_history(uuid) TO authenticated, anon;
