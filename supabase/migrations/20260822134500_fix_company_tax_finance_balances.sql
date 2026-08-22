-- Fix company taxation and company cash settlement.
-- Corporate tax is assessed once per closed calendar month on operating profit,
-- while owner/inter-company cash movements remain non-operating.

CREATE TABLE IF NOT EXISTS public.company_fund_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transfer_kind text NOT NULL CHECK (transfer_kind IN ('deposit','withdrawal','intercompany')),
  source_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  destination_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  idempotency_key text NOT NULL,
  request_signature text,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','succeeded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_user_id, idempotency_key)
);

ALTER TABLE public.company_fund_transfer_requests
  ADD COLUMN IF NOT EXISTS request_signature text;

UPDATE public.company_fund_transfer_requests
   SET request_signature = concat_ws('|', transfer_kind, source_company_id::text, coalesce(destination_company_id::text,''), amount::text)
 WHERE request_signature IS NULL;

ALTER TABLE public.company_fund_transfer_requests
  ALTER COLUMN request_signature SET NOT NULL;

ALTER TABLE public.company_fund_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS company_city_tax_payment_period_unique
  ON public.company_city_tax_payments(company_id, city_id, period_start, period_end);

CREATE UNIQUE INDEX IF NOT EXISTS company_demand_transaction_unique
  ON public.company_transactions(company_id, related_entity_type, related_entity_id)
  WHERE related_entity_type = 'company_demand' AND related_entity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.transfer_company_funds(
  p_transfer_kind text,
  p_company_id uuid,
  p_amount numeric,
  p_destination_company_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_profile public.profiles%ROWTYPE;
  v_source public.companies%ROWTYPE;
  v_destination public.companies%ROWTYPE;
  v_request public.company_fund_transfer_requests%ROWTYPE;
  v_signature text;
  v_amount numeric;
  v_minimum_balance numeric := 10000;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE='P0001'; END IF;
  IF p_transfer_kind NOT IN ('deposit','withdrawal','intercompany') THEN RAISE EXCEPTION 'invalid_transfer_kind' USING ERRCODE='P0001'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid_transfer_amount' USING ERRCODE='P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE='P0001'; END IF;
  IF p_transfer_kind='intercompany' AND (p_destination_company_id IS NULL OR p_destination_company_id=p_company_id) THEN RAISE EXCEPTION 'invalid_destination_company' USING ERRCODE='P0001'; END IF;

  v_amount := CASE WHEN p_transfer_kind='intercompany' THEN round(p_amount,2) ELSE round(p_amount,0) END;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'invalid_transfer_amount' USING ERRCODE='P0001'; END IF;
  v_signature := concat_ws('|',p_transfer_kind,p_company_id::text,coalesce(p_destination_company_id::text,''),v_amount::text);

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_idempotency_key,0));
  SELECT * INTO v_request
    FROM public.company_fund_transfer_requests
   WHERE actor_user_id=v_user_id AND idempotency_key=p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_request.request_signature <> v_signature THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='P0001'; END IF;
    IF v_request.status='succeeded' THEN RETURN v_request.result || jsonb_build_object('idempotent',true); END IF;
    RAISE EXCEPTION 'company_transfer_in_progress' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO v_profile FROM public.profiles
   WHERE id=v_profile_id AND user_id=v_user_id AND died_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_eligible' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_source FROM public.companies WHERE id=p_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'company_not_found' USING ERRCODE='P0001'; END IF;
  IF v_source.owner_id <> v_user_id THEN RAISE EXCEPTION 'company_not_owned' USING ERRCODE='P0001'; END IF;
  IF v_source.status <> 'active' OR COALESCE(v_source.is_bankrupt,false) THEN RAISE EXCEPTION 'company_not_active' USING ERRCODE='P0001'; END IF;

  IF p_transfer_kind='intercompany' THEN
    SELECT * INTO v_destination FROM public.companies WHERE id=p_destination_company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'destination_company_not_found' USING ERRCODE='P0001'; END IF;
    IF v_destination.owner_id <> v_user_id THEN RAISE EXCEPTION 'destination_company_not_owned' USING ERRCODE='P0001'; END IF;
    IF v_destination.status <> 'active' OR COALESCE(v_destination.is_bankrupt,false) THEN RAISE EXCEPTION 'destination_company_not_active' USING ERRCODE='P0001'; END IF;
  END IF;

  IF p_transfer_kind='deposit' AND COALESCE(v_profile.cash,0) < v_amount THEN RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE='P0001'; END IF;
  IF p_transfer_kind IN ('withdrawal','intercompany') AND COALESCE(v_source.balance,0)-v_amount < v_minimum_balance THEN RAISE EXCEPTION 'minimum_company_balance_required' USING ERRCODE='P0001'; END IF;

  INSERT INTO public.company_fund_transfer_requests(actor_user_id,actor_profile_id,transfer_kind,source_company_id,destination_company_id,amount,idempotency_key,request_signature)
  VALUES(v_user_id,v_profile.id,p_transfer_kind,p_company_id,p_destination_company_id,v_amount,p_idempotency_key,v_signature)
  RETURNING * INTO v_request;

  IF p_transfer_kind='deposit' THEN
    UPDATE public.profiles SET cash=cash-v_amount::bigint, updated_at=now() WHERE id=v_profile.id;
    UPDATE public.companies SET balance=balance+v_amount, negative_balance_since=NULL, updated_at=now() WHERE id=v_source.id;
    INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category,related_entity_id,related_entity_type)
    VALUES(v_source.id,'investment',v_amount,'Owner deposit','owner_transfer',v_profile.id,'profile');
  ELSIF p_transfer_kind='withdrawal' THEN
    UPDATE public.companies SET balance=balance-v_amount, updated_at=now() WHERE id=v_source.id;
    UPDATE public.profiles SET cash=cash+v_amount::bigint, updated_at=now() WHERE id=v_profile.id;
    INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category,related_entity_id,related_entity_type)
    VALUES(v_source.id,'dividend',-v_amount,'Owner withdrawal','owner_transfer',v_profile.id,'profile');
  ELSE
    UPDATE public.companies SET balance=balance-v_amount, updated_at=now() WHERE id=v_source.id;
    UPDATE public.companies SET balance=balance+v_amount, negative_balance_since=NULL, updated_at=now() WHERE id=v_destination.id;
    INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category,related_entity_id,related_entity_type) VALUES
      (v_source.id,'transfer_out',-v_amount,'Transfer to '||v_destination.name,'owner_transfer',v_destination.id,'company'),
      (v_destination.id,'transfer_in',v_amount,'Transfer from '||v_source.name,'owner_transfer',v_source.id,'company');
  END IF;

  SELECT jsonb_build_object(
    'transferKind',p_transfer_kind,
    'sourceCompanyId',v_source.id,
    'destinationCompanyId',CASE WHEN p_transfer_kind='intercompany' THEN v_destination.id ELSE NULL END,
    'amount',v_amount,
    'personalCash',(SELECT cash FROM public.profiles WHERE id=v_profile.id),
    'sourceBalance',(SELECT balance FROM public.companies WHERE id=v_source.id),
    'destinationBalance',CASE WHEN p_transfer_kind='intercompany' THEN (SELECT balance FROM public.companies WHERE id=v_destination.id) ELSE NULL END,
    'financialTransactionId',NULL,
    'idempotent',false
  ) INTO v_result;

  UPDATE public.company_fund_transfer_requests SET status='succeeded',result=v_result,updated_at=now() WHERE id=v_request.id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_company_funds(text,uuid,numeric,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_company_funds(text,uuid,numeric,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pay_company_tax(p_tax_record_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tax public.company_tax_records%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_total numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_tax FROM public.company_tax_records WHERE id=p_tax_record_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'tax_record_not_found' USING ERRCODE='P0001'; END IF;
  IF v_tax.status='paid' THEN RAISE EXCEPTION 'tax_already_paid' USING ERRCODE='P0001'; END IF;

  SELECT * INTO v_company FROM public.companies WHERE id=v_tax.company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'company_not_found' USING ERRCODE='P0001'; END IF;
  IF v_company.owner_id <> v_user_id THEN RAISE EXCEPTION 'company_not_owned' USING ERRCODE='P0001'; END IF;

  v_total := COALESCE(v_tax.tax_amount,0)+COALESCE(v_tax.penalty_amount,0);
  IF v_total <= 0 THEN RAISE EXCEPTION 'invalid_tax_amount' USING ERRCODE='P0001'; END IF;
  IF COALESCE(v_company.balance,0) < v_total THEN RAISE EXCEPTION 'insufficient_company_funds' USING ERRCODE='P0001'; END IF;

  UPDATE public.companies SET balance=balance-v_total, updated_at=now() WHERE id=v_company.id;
  UPDATE public.company_tax_records SET status='paid', paid_at=now() WHERE id=v_tax.id;
  INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category,related_entity_id,related_entity_type)
  VALUES(v_company.id,'expense',-v_total,'Corporate tax payment ('||v_tax.tax_period||')','tax',v_tax.id,'company_tax_record');

  RETURN jsonb_build_object('success',true,'companyId',v_company.id,'taxRecordId',v_tax.id,'amount',v_total,'balance',(SELECT balance FROM public.companies WHERE id=v_company.id));
END;
$$;

REVOKE ALL ON FUNCTION public.pay_company_tax(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_company_tax(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.generate_pending_company_taxes();
CREATE FUNCTION public.generate_pending_company_taxes()
RETURNS TABLE (billed_company_id uuid, billed_amount numeric, billed_period text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_company record;
  v_period text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_revenue numeric;
  v_expenses numeric;
  v_taxable numeric;
  v_rate numeric;
  v_reputation_discount numeric;
  v_tax numeric;
  v_due timestamptz;
BEGIN
  v_period_start := date_trunc('month',now() AT TIME ZONE 'UTC') - interval '1 month';
  v_period_end := date_trunc('month',now() AT TIME ZONE 'UTC');
  v_period := to_char(v_period_start,'YYYY-MM');
  v_due := now()+interval '7 days';

  FOR v_company IN
    SELECT c.id AS cid,c.reputation_score AS rep FROM public.companies c
     WHERE COALESCE(c.is_bankrupt,false)=false AND c.status='active'
  LOOP
    IF EXISTS (SELECT 1 FROM public.company_tax_records ctr WHERE ctr.company_id=v_company.cid AND ctr.tax_period=v_period) THEN
      CONTINUE;
    END IF;

    SELECT
      COALESCE(SUM(CASE WHEN ct.transaction_type='income' AND COALESCE(ct.category,'') <> 'tax' THEN GREATEST(ct.amount,0) ELSE 0 END),0),
      COALESCE(SUM(CASE WHEN ct.transaction_type IN ('expense','salary') AND COALESCE(ct.category,'') <> 'tax' THEN ABS(ct.amount) ELSE 0 END),0)
      INTO v_revenue,v_expenses
      FROM public.company_transactions ct
     WHERE ct.company_id=v_company.cid
       AND ct.created_at>=v_period_start AND ct.created_at<v_period_end;

    v_taxable := GREATEST(v_revenue-v_expenses,0);
    IF v_taxable<=0 THEN CONTINUE; END IF;

    v_rate := CASE WHEN v_taxable<50000 THEN 0.10 WHEN v_taxable<250000 THEN 0.15 WHEN v_taxable<1000000 THEN 0.20 ELSE 0.25 END;
    v_reputation_discount := LEAST(GREATEST(COALESCE(v_company.rep,0),0)/20.0*0.01,0.10);
    v_rate := GREATEST(v_rate*(1-v_reputation_discount),0.05);
    v_tax := ROUND(v_taxable*v_rate,2);

    INSERT INTO public.company_tax_records(company_id,tax_period,gross_revenue,deductible_expenses,taxable_income,tax_rate,tax_amount,tax_type,penalty_amount,status,due_date)
    VALUES(v_company.cid,v_period,v_revenue,v_expenses,v_taxable,v_rate,v_tax,'corporate',0,'pending',v_due);

    billed_company_id:=v_company.cid; billed_amount:=v_tax; billed_period:=v_period; RETURN NEXT;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_pending_company_taxes() TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.resolve_company_demand(target_date date DEFAULT ((now() AT TIME ZONE 'utc'))::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  processed integer:=0;
  r record;
  city_pop integer;
  base_customers integer;
  price_mult numeric;
  staff_mult numeric;
  law_mult numeric;
  type_weight numeric;
  rev numeric;
  sales_tax numeric;
  combined_tax numeric;
  v_tax_amount numeric;
  sku_avg_price numeric;
  behavior text;
  fallback_price numeric;
  net_rev numeric;
  v_demand_id uuid;
  v_old_net numeric:=0;
  v_old_tax numeric:=0;
  v_tax_delta numeric;
  v_treasury_delta bigint;
BEGIN
  FOR r IN
    SELECT c.id,c.headquarters_city_id,c.company_type,c.reputation_score,s.quality_score,s.price_tier,s.capacity,s.sold_out_behavior
      FROM public.companies c JOIN public.company_storefront s ON s.company_id=c.id
     WHERE c.is_bankrupt=false AND c.status='active' AND s.is_public=true
  LOOP
    SELECT COALESCE(population,50000) INTO city_pop FROM public.cities WHERE id=r.headquarters_city_id;
    IF city_pop IS NULL THEN city_pop:=50000; END IF;
    SELECT COALESCE(demand_weight,1.0) INTO type_weight FROM public.company_type_definitions WHERE type_key=r.company_type;
    IF type_weight IS NULL THEN type_weight:=1.0; END IF;

    price_mult:=CASE r.price_tier WHEN 1 THEN 1.6 WHEN 2 THEN 1.3 WHEN 3 THEN 1.0 WHEN 4 THEN 0.75 WHEN 5 THEN 0.5 ELSE 1.0 END;
    staff_mult:=public.apply_player_staff_bonus(r.id);
    law_mult:=public.mayor_company_modifier(r.headquarters_city_id);
    base_customers:=GREATEST(0,FLOOR((city_pop/10000.0)*((COALESCE(r.reputation_score,50)+COALESCE(r.quality_score,50))/100.0)*price_mult*staff_mult*law_mult*type_weight))::int;
    base_customers:=LEAST(base_customers,COALESCE(r.capacity,100)*10);

    behavior:=COALESCE(r.sold_out_behavior,'hide');
    SELECT CASE WHEN SUM(CASE WHEN stock>0 OR behavior<>'hide' THEN GREATEST(stock,1) ELSE 0 END)>0
      THEN SUM(unit_price*CASE WHEN stock>0 OR behavior<>'hide' THEN GREATEST(stock,1) ELSE 0 END)/NULLIF(SUM(CASE WHEN stock>0 OR behavior<>'hide' THEN GREATEST(stock,1) ELSE 0 END),0) END
      INTO sku_avg_price
      FROM public.company_inventory WHERE company_id=r.id AND is_active=true;
    fallback_price:=CASE r.price_tier WHEN 1 THEN 18 WHEN 2 THEN 12 WHEN 3 THEN 8 WHEN 4 THEN 5 WHEN 5 THEN 3 ELSE 8 END;
    IF sku_avg_price IS NULL OR sku_avg_price<=0 THEN sku_avg_price:=fallback_price; END IF;
    rev:=ROUND(base_customers*sku_avg_price,2);

    sales_tax:=0;
    IF r.headquarters_city_id IS NOT NULL THEN
      SELECT COALESCE(cl.sales_tax_rate,0) INTO sales_tax FROM public.city_laws cl
       WHERE cl.city_id=r.headquarters_city_id AND cl.effective_from<=now() AND (cl.effective_until IS NULL OR cl.effective_until>now())
       ORDER BY cl.effective_from DESC LIMIT 1;
      sales_tax:=COALESCE(sales_tax,0);
    END IF;
    combined_tax:=LEAST(GREATEST(sales_tax,0),0.95);
    v_tax_amount:=ROUND(rev*combined_tax,2);
    net_rev:=rev-v_tax_amount;

    SELECT dl.id,COALESCE(dl.net_revenue,0),COALESCE(dl.tax_amount,0) INTO v_demand_id,v_old_net,v_old_tax
      FROM public.company_demand_log dl WHERE dl.company_id=r.id AND dl.resolved_for=target_date;
    IF NOT FOUND THEN v_demand_id:=NULL; v_old_net:=0; v_old_tax:=0; END IF;

    INSERT INTO public.company_demand_log(company_id,resolved_for,customers,revenue,demand_score,avg_unit_price,base_tax_rate,sales_tax_rate,combined_tax_rate,tax_amount,net_revenue)
    VALUES(r.id,target_date,base_customers,rev,(COALESCE(r.reputation_score,50)+COALESCE(r.quality_score,50))*price_mult*staff_mult*law_mult*type_weight,sku_avg_price,0,sales_tax,combined_tax,v_tax_amount,net_rev)
    ON CONFLICT(company_id,resolved_for) DO UPDATE SET customers=EXCLUDED.customers,revenue=EXCLUDED.revenue,demand_score=EXCLUDED.demand_score,avg_unit_price=EXCLUDED.avg_unit_price,base_tax_rate=0,sales_tax_rate=EXCLUDED.sales_tax_rate,combined_tax_rate=EXCLUDED.combined_tax_rate,tax_amount=EXCLUDED.tax_amount,net_revenue=EXCLUDED.net_revenue
    RETURNING id INTO v_demand_id;

    UPDATE public.companies SET balance=balance+(net_rev-v_old_net),updated_at=now() WHERE id=r.id;

    UPDATE public.company_transactions SET amount=net_rev,description='Daily trading revenue',category='revenue',created_at=(target_date::timestamptz+interval '12 hours')
     WHERE company_id=r.id AND related_entity_type='company_demand' AND related_entity_id=v_demand_id;
    IF NOT FOUND THEN
      INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category,related_entity_id,related_entity_type,created_at)
      VALUES(r.id,'income',net_rev,'Daily trading revenue','revenue',v_demand_id,'company_demand',target_date::timestamptz+interval '12 hours');
    END IF;

    IF r.headquarters_city_id IS NOT NULL THEN
      INSERT INTO public.company_city_tax_payments(company_id,city_id,amount,tax_rate,period_start,period_end)
      VALUES(r.id,r.headquarters_city_id,v_tax_amount,combined_tax,target_date,target_date)
      ON CONFLICT(company_id,city_id,period_start,period_end) DO UPDATE SET amount=EXCLUDED.amount,tax_rate=EXCLUDED.tax_rate,paid_at=now();

      v_tax_delta:=v_tax_amount-v_old_tax;
      v_treasury_delta:=ROUND(v_tax_delta)::bigint;
      IF v_treasury_delta<>0 THEN
        UPDATE public.city_treasury SET balance=balance+v_treasury_delta,total_tax_collected=total_tax_collected+v_treasury_delta,updated_at=now()
         WHERE city_id=r.headquarters_city_id;
        INSERT INTO public.city_treasury_ledger(city_id,entry_type,amount,description)
        VALUES(r.headquarters_city_id,'tax',v_treasury_delta,'Sales tax @ '||ROUND(combined_tax*100,2)||'%');
      END IF;
    END IF;
    processed:=processed+1;
  END LOOP;
  RETURN processed;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_company_weekly_finances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  r record;
  v_week_start date:=(date_trunc('week',now()-interval '7 days'))::date;
  v_week_end date:=v_week_start+6;
  v_revenue numeric; v_wages numeric; v_ops numeric; v_total numeric; v_net numeric;
  v_unpaid numeric; v_count integer:=0;
BEGIN
  FOR r IN SELECT id,balance,weekly_operating_costs FROM public.companies WHERE status='active' AND is_bankrupt=false
  LOOP
    IF EXISTS(SELECT 1 FROM public.company_weekly_finance_records WHERE company_id=r.id AND week_start=v_week_start) THEN CONTINUE; END IF;
    SELECT COALESCE(SUM(COALESCE(net_revenue,revenue)),0) INTO v_revenue FROM public.company_demand_log WHERE company_id=r.id AND resolved_for BETWEEN v_week_start AND v_week_end;
    SELECT COALESCE(SUM(salary),0) INTO v_wages FROM public.company_employees WHERE company_id=r.id AND status='active';
    v_ops:=COALESCE(r.weekly_operating_costs,0); v_total:=v_wages+v_ops; v_net:=v_revenue-v_total; v_unpaid:=0;
    IF COALESCE(r.balance,0)<v_total THEN v_unpaid:=v_total-GREATEST(0,COALESCE(r.balance,0)); END IF;
    UPDATE public.companies SET balance=COALESCE(balance,0)-(v_total-v_unpaid),negative_balance_since=CASE WHEN COALESCE(balance,0)-(v_total-v_unpaid)<0 THEN COALESCE(negative_balance_since,now()) ELSE NULL END,updated_at=now() WHERE id=r.id;
    INSERT INTO public.company_weekly_finance_records(company_id,week_start,week_end,gross_revenue,staff_wage_costs,total_costs,net_profit,balance_after,unpaid_amount,processing_status)
    SELECT r.id,v_week_start,v_week_end,v_revenue,v_wages,v_total,v_net,(SELECT balance FROM public.companies WHERE id=r.id),v_unpaid,CASE WHEN v_unpaid>0 THEN 'partial' ELSE 'processed' END;
    IF v_total-v_unpaid>0 THEN INSERT INTO public.company_transactions(company_id,transaction_type,amount,description,category) VALUES(r.id,'expense',v_total-v_unpaid,'Weekly wages and operating costs','operations'); END IF;
    v_count:=v_count+1;
  END LOOP;
  RETURN v_count;
END;
$$;

NOTIFY pgrst,'reload schema';