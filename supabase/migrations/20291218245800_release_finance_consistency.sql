-- Recorded-release costs and sale values are integer cents. Treasury balances
-- (bands.band_balance and labels.balance) and ledger amounts are dollars.
ALTER TABLE public.bands ALTER COLUMN band_balance TYPE numeric(14,2) USING band_balance::numeric;
ALTER TABLE public.band_earnings ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric;
ALTER TABLE public.labels ALTER COLUMN balance TYPE numeric(14,2) USING balance::numeric;
ALTER TABLE public.label_financial_transactions ALTER COLUMN amount TYPE numeric(14,2) USING amount::numeric;

ALTER TABLE public.release_sales
  ADD COLUMN IF NOT EXISTS manufacturing_revenue_share integer NOT NULL DEFAULT 0
  CHECK (manufacturing_revenue_share >= 0);

COMMENT ON COLUMN public.release_sales.manufacturing_revenue_share IS
  'Manufacturer revenue share withheld from this sale, in minor units (cents).';
COMMENT ON COLUMN public.releases.total_cost IS
  'Cumulative manufacturing plus territory setup cost in minor units (cents).';

CREATE OR REPLACE FUNCTION public.charge_band_release_cost(
  p_band_id uuid, p_amount_minor integer, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_amount_major numeric(14,2); v_balance numeric;
BEGIN
  IF p_amount_minor <= 0 THEN RAISE EXCEPTION 'Release charge must be positive'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM band_members bm JOIN profiles p ON p.id = bm.profile_id
    WHERE bm.band_id = p_band_id AND p.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Not authorized for band'; END IF;
  v_amount_major := p_amount_minor / 100.0;
  SELECT band_balance INTO v_balance FROM bands WHERE id = p_band_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_amount_major THEN RAISE EXCEPTION 'Insufficient band balance'; END IF;
  -- band_earnings is the canonical treasury journal; its existing trigger syncs band_balance.
  INSERT INTO band_earnings(band_id, amount, source, description, earned_by_user_id, metadata)
  VALUES (p_band_id, -v_amount_major, 'release', p_description, auth.uid(),
          p_metadata || jsonb_build_object('amount_minor', p_amount_minor, 'amount_major', v_amount_major));
  RETURN v_amount_major;
END $$;

CREATE OR REPLACE FUNCTION public.purchase_release_format(
  p_release_id uuid, p_format_type text, p_quantity integer, p_retail_price integer,
  p_manufacturing_cost_minor integer, p_release_date timestamptz,
  p_vinyl_color text DEFAULT NULL, p_is_limited_edition boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_release releases%ROWTYPE; v_contract artist_label_contracts%ROWTYPE;
  v_format_id uuid; v_amount numeric(14,2); v_label_balance numeric;
BEGIN
  IF p_quantity <= 0 OR p_manufacturing_cost_minor <= 0 THEN RAISE EXCEPTION 'Invalid manufacturing order'; END IF;
  SELECT * INTO v_release FROM releases WHERE id = p_release_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM band_members bm JOIN profiles p ON p.id=bm.profile_id WHERE bm.band_id=v_release.band_id AND p.user_id=auth.uid())
    THEN RAISE EXCEPTION 'Not authorized for release'; END IF;
  v_amount := p_manufacturing_cost_minor / 100.0;
  IF v_release.label_contract_id IS NOT NULL THEN
    SELECT * INTO v_contract FROM artist_label_contracts WHERE id=v_release.label_contract_id AND status='active';
  END IF;
  IF FOUND AND v_contract.manufacturing_covered THEN
    SELECT balance INTO v_label_balance FROM labels WHERE id=v_contract.label_id FOR UPDATE;
    IF v_label_balance IS NULL OR v_label_balance < v_amount THEN RAISE EXCEPTION 'Insufficient label balance'; END IF;
    UPDATE labels SET balance=balance-v_amount WHERE id=v_contract.label_id;
    INSERT INTO label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id)
    VALUES(v_contract.label_id,'expense',v_amount,'Additional manufacturing for "'||v_release.title||'"',v_contract.id);
  ELSE
    PERFORM charge_band_release_cost(v_release.band_id,p_manufacturing_cost_minor,
      'Release manufacturing: additional '||upper(p_format_type)||' format for '||v_release.title,
      jsonb_build_object('release_id',p_release_id,'cost_kind','manufacturing','operation','add_format'));
  END IF;
  INSERT INTO release_formats(release_id,format_type,quantity,retail_price,manufacturing_cost,manufacturing_status,release_date,vinyl_color,is_limited_edition)
  VALUES(p_release_id,p_format_type,p_quantity,p_retail_price,p_manufacturing_cost_minor,'manufacturing',p_release_date,p_vinyl_color,p_is_limited_edition)
  RETURNING id INTO v_format_id;
  UPDATE releases SET total_cost=coalesce(total_cost,0)+p_manufacturing_cost_minor WHERE id=p_release_id;
  RETURN v_format_id;
END $$;

CREATE OR REPLACE FUNCTION public.reorder_release_stock(
  p_release_id uuid, p_format_id uuid, p_quantity integer,
  p_manufacturing_cost_minor integer, p_release_date timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_release releases%ROWTYPE; v_format release_formats%ROWTYPE;
  v_contract artist_label_contracts%ROWTYPE; v_amount numeric(14,2); v_label_balance numeric;
BEGIN
  IF p_quantity <= 0 OR p_manufacturing_cost_minor <= 0 THEN RAISE EXCEPTION 'Invalid manufacturing order'; END IF;
  SELECT * INTO v_release FROM releases WHERE id=p_release_id FOR UPDATE;
  SELECT * INTO v_format FROM release_formats WHERE id=p_format_id AND release_id=p_release_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release format not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM band_members bm JOIN profiles p ON p.id=bm.profile_id WHERE bm.band_id=v_release.band_id AND p.user_id=auth.uid())
    THEN RAISE EXCEPTION 'Not authorized for release'; END IF;
  v_amount := p_manufacturing_cost_minor / 100.0;
  IF v_release.label_contract_id IS NOT NULL THEN SELECT * INTO v_contract FROM artist_label_contracts WHERE id=v_release.label_contract_id AND status='active'; END IF;
  IF FOUND AND v_contract.manufacturing_covered THEN
    SELECT balance INTO v_label_balance FROM labels WHERE id=v_contract.label_id FOR UPDATE;
    IF v_label_balance IS NULL OR v_label_balance < v_amount THEN RAISE EXCEPTION 'Insufficient label balance'; END IF;
    UPDATE labels SET balance=balance-v_amount WHERE id=v_contract.label_id;
    INSERT INTO label_financial_transactions(label_id,transaction_type,amount,description,related_contract_id)
    VALUES(v_contract.label_id,'expense',v_amount,'Stock reorder for "'||v_release.title||'"',v_contract.id);
  ELSE
    PERFORM charge_band_release_cost(v_release.band_id,p_manufacturing_cost_minor,
      'Release manufacturing: '||upper(v_format.format_type)||' stock reorder for '||v_release.title,
      jsonb_build_object('release_id',p_release_id,'format_id',p_format_id,'cost_kind','manufacturing','operation','reorder'));
  END IF;
  UPDATE release_formats SET quantity=coalesce(quantity,0)+p_quantity,
    manufacturing_cost=coalesce(manufacturing_cost,0)+p_manufacturing_cost_minor,
    manufacturing_status='manufacturing',release_date=p_release_date WHERE id=p_format_id;
  UPDATE releases SET total_cost=coalesce(total_cost,0)+p_manufacturing_cost_minor WHERE id=p_release_id;
END $$;

-- Read-only audit: deliberately requires an administrator/service role. It only
-- flags legacy ledger rows whose absolute dollar deduction is approximately the
-- release's expected cent total (i.e. 100x the correct dollar charge).
CREATE OR REPLACE FUNCTION public.audit_release_currency_overcharges()
RETURNS TABLE(release_id uuid,band_id uuid,release_title text,recorded_total_cost_minor bigint,
 expected_charge_dollars numeric,actual_ledger_deduction numeric,suspected_overcharge numeric,confidence text,reason text)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT r.id,r.band_id,r.title,r.total_cost::bigint,r.total_cost/100.0,abs(be.amount),
    abs(be.amount)-(r.total_cost/100.0),'high',
    'Legacy release ledger deduction is approximately 100x expected major-unit charge'
  FROM releases r JOIN band_earnings be ON be.band_id=r.band_id
    AND be.source='release' AND be.description LIKE 'Release manufacturing:%'
    AND be.created_at BETWEEN r.created_at-interval '5 minutes' AND r.created_at+interval '5 minutes'
  WHERE r.total_cost>0 AND abs(abs(be.amount)-r.total_cost)<=greatest(1,r.total_cost*.01);
$$;
REVOKE ALL ON FUNCTION public.audit_release_currency_overcharges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_release_currency_overcharges() TO service_role;
GRANT EXECUTE ON FUNCTION public.charge_band_release_cost(uuid,integer,text,jsonb),
 public.purchase_release_format(uuid,text,integer,integer,integer,timestamptz,text,boolean),
 public.reorder_release_stock(uuid,uuid,integer,integer,timestamptz) TO authenticated;

DROP FUNCTION IF EXISTS public.get_release_sales_breakdown(uuid,date);
CREATE FUNCTION public.get_release_sales_breakdown(p_release_id uuid,p_sale_date date DEFAULT NULL)
RETURNS TABLE(format_type text,units bigint,gross_cents bigint,tax_cents bigint,dist_cents bigint,manufacturer_cents bigint,net_cents bigint,sale_rows bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT rf.format_type::text,coalesce(sum(rs.quantity_sold),0)::bigint,
  coalesce(sum(rs.total_amount),0)::bigint,coalesce(sum(rs.sales_tax_amount),0)::bigint,
  coalesce(sum(rs.distribution_fee),0)::bigint,coalesce(sum(rs.manufacturing_revenue_share),0)::bigint,
  coalesce(sum(rs.net_revenue),0)::bigint,count(rs.id)::bigint
 FROM release_formats rf LEFT JOIN release_sales rs ON rs.release_format_id=rf.id
  AND (p_sale_date IS NULL OR (rs.sale_date AT TIME ZONE 'UTC')::date=p_sale_date)
 WHERE rf.release_id=p_release_id GROUP BY rf.format_type
 HAVING coalesce(sum(rs.quantity_sold),0)>0 OR p_sale_date IS NULL ORDER BY 3 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_release_sales_breakdown(uuid,date) TO authenticated,anon;
