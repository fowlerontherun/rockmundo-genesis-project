-- Forward-only live repair: withhold personal income tax at the earning source.
-- Deliberately does not back-tax existing balances, gifts, refunds or transfers.
-- Finance amounts are cents; the legacy profiles.cash/city_treasury are whole dollars.

CREATE TABLE IF NOT EXISTS public.player_income_tax_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  source_kind text NOT NULL CHECK (source_kind IN ('band_weekly_pay','mayor_salary','company_wage','company_dividend')),
  source_key text NOT NULL UNIQUE,
  city_id uuid NOT NULL REFERENCES public.cities(id),
  tax_period text NOT NULL,
  gross_minor bigint NOT NULL CHECK (gross_minor > 0),
  tax_minor bigint NOT NULL CHECK (tax_minor >= 0),
  net_minor bigint NOT NULL CHECK (net_minor >= 0),
  base_tax_rate numeric(6,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc',now()),
  CONSTRAINT player_income_tax_amounts_balance CHECK (gross_minor = tax_minor + net_minor)
);

CREATE INDEX IF NOT EXISTS player_income_tax_receipts_profile_period_idx
  ON public.player_income_tax_receipts(profile_id,tax_period);
ALTER TABLE public.player_income_tax_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players view own income tax" ON public.player_income_tax_receipts;
CREATE POLICY "Players view own income tax" ON public.player_income_tax_receipts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=profile_id AND p.user_id=auth.uid())
  );
REVOKE ALL ON public.player_income_tax_receipts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.player_income_tax_receipts TO authenticated;
GRANT ALL ON public.player_income_tax_receipts TO service_role;

-- Marginal monthly bands: base city rate up to $10k, base+5 points to $50k,
-- and base+10 points above $50k. All rates are capped at 50%.
CREATE OR REPLACE FUNCTION public.calculate_player_income_tax_minor(
  p_monthly_gross_minor bigint,p_city_base_rate numeric
) RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path TO '' AS $tax$
  SELECT CASE WHEN p_monthly_gross_minor <= 0 THEN 0::bigint ELSE
    round(
      (least(p_monthly_gross_minor,1000000)::numeric * greatest(0,least(50,coalesce(p_city_base_rate,10))) / 100)
      + (least(greatest(p_monthly_gross_minor - 1000000,0),4000000)::numeric
          * greatest(0,least(50,coalesce(p_city_base_rate,10)+5)) / 100)
      + (greatest(p_monthly_gross_minor - 5000000,0)::numeric
          * greatest(0,least(50,coalesce(p_city_base_rate,10)+10)) / 100)
    )::bigint END;
$tax$;
REVOKE ALL ON FUNCTION public.calculate_player_income_tax_minor(bigint,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_player_income_tax_minor(bigint,numeric) TO service_role;

-- Called only by trusted payment routines. Lock the player to serialize taxes
-- from multiple income sources, and record the unique receipt before remitting.
CREATE OR REPLACE FUNCTION public.withhold_player_income_tax(
  p_profile_id uuid,p_gross_minor bigint,p_source_kind text,p_source_key text,p_source_city_id uuid DEFAULT NULL
) RETURNS TABLE(tax_minor bigint,net_minor bigint,receipt_id uuid,withholding_city_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $tax$
DECLARE
  v_current_city uuid;
  v_city uuid;
  v_rate numeric;
  v_period text := to_char(timezone('utc',now()),'YYYY-MM');
  v_previous bigint;
  v_tax bigint;
  v_receipt uuid;
BEGIN
  IF p_gross_minor IS NULL OR p_gross_minor <= 0 OR p_source_key IS NULL OR length(p_source_key)=0
     OR p_source_kind NOT IN ('band_weekly_pay','mayor_salary','company_wage','company_dividend') THEN
    RAISE EXCEPTION 'INVALID_TAXABLE_EARNING';
  END IF;

  SELECT p.current_city_id INTO v_current_city FROM public.profiles p
   WHERE p.id=p_profile_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_PROFILE_NOT_FOUND'; END IF;
  v_city := coalesce(v_current_city,p_source_city_id);
  IF v_city IS NULL THEN RAISE EXCEPTION 'TAX_CITY_REQUIRED'; END IF;
  IF EXISTS (SELECT 1 FROM public.player_income_tax_receipts r WHERE r.source_key=p_source_key) THEN
    RAISE EXCEPTION 'DUPLICATE_TAXABLE_EARNING: %',p_source_key;
  END IF;

  SELECT l.income_tax_rate INTO v_rate FROM public.city_laws l
   WHERE l.city_id=v_city AND l.effective_from<=now()
     AND (l.effective_until IS NULL OR l.effective_until>now())
   ORDER BY l.effective_from DESC,l.id DESC LIMIT 1;
  IF v_rate IS NULL THEN
    SELECT t.tax_rate_pct INTO v_rate FROM public.city_treasury t WHERE t.city_id=v_city;
  END IF;
  v_rate := greatest(0,least(50,coalesce(v_rate,10)));

  SELECT coalesce(sum(r.gross_minor),0)::bigint INTO v_previous
   FROM public.player_income_tax_receipts r
   WHERE r.profile_id=p_profile_id AND r.tax_period=v_period;

  -- Whole-dollar withholding to match city treasury and legacy player cash.
  v_tax := least(p_gross_minor,
    greatest(0,round((
      public.calculate_player_income_tax_minor(v_previous+p_gross_minor,v_rate)
      - public.calculate_player_income_tax_minor(v_previous,v_rate)
    )::numeric / 100)::bigint * 100));

  INSERT INTO public.player_income_tax_receipts
    (profile_id,source_kind,source_key,city_id,tax_period,gross_minor,tax_minor,net_minor,base_tax_rate)
   VALUES (p_profile_id,p_source_kind,p_source_key,v_city,v_period,p_gross_minor,v_tax,p_gross_minor-v_tax,v_rate)
   RETURNING id INTO v_receipt;

  IF v_tax>0 THEN
    PERFORM public.credit_city_treasury(v_city,v_tax::numeric/100,'personal_income_tax',
      'Income tax withheld on '||p_source_kind,v_receipt);
  END IF;

  INSERT INTO public.tax_period_summaries
    (owner_type,owner_id,tax_jurisdiction,tax_period,taxable_income_minor,tax_withheld_minor,tax_paid_minor)
   VALUES ('player'::public.financial_owner_type,p_profile_id,'city:'||v_city::text,v_period,p_gross_minor,v_tax,v_tax)
  ON CONFLICT (owner_type,owner_id,tax_period) DO UPDATE SET
    taxable_income_minor=public.tax_period_summaries.taxable_income_minor+EXCLUDED.taxable_income_minor,
    tax_withheld_minor=public.tax_period_summaries.tax_withheld_minor+EXCLUDED.tax_withheld_minor,
    tax_paid_minor=public.tax_period_summaries.tax_paid_minor+EXCLUDED.tax_paid_minor,
    tax_jurisdiction=CASE WHEN public.tax_period_summaries.tax_jurisdiction=EXCLUDED.tax_jurisdiction
        THEN EXCLUDED.tax_jurisdiction ELSE 'multiple cities' END,
    last_calculated_at=now(),updated_at=now();

  tax_minor:=v_tax;
  net_minor:=p_gross_minor-v_tax;
  receipt_id:=v_receipt;
  withholding_city_id:=v_city;
  RETURN NEXT;
END;
$tax$;
CREATE OR REPLACE FUNCTION public.process_weekly_band_payroll()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_week date := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
  v_band public.bands%ROWTYPE;
  v_band_id uuid;
  v_available bigint;
  v_count integer;
  v_each bigint;
  v_total bigint;
  v_member record;
  v_withholding record;
  v_paid integer := 0;
  v_sum bigint := 0;
  v_failures jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Payroll cannot be called by a signed-in user' USING ERRCODE = '42501';
  END IF;

  FOR v_band_id IN
    SELECT b.id FROM public.bands b
    WHERE b.status = 'active'::public.band_status AND COALESCE(b.weekly_pay_percent,0) > 0
    ORDER BY b.id
  LOOP
    BEGIN
      SELECT * INTO v_band FROM public.bands WHERE id = v_band_id FOR UPDATE;
      IF v_band.status <> 'active'::public.band_status OR COALESCE(v_band.weekly_pay_percent,0) <= 0 THEN CONTINUE; END IF;
      IF EXISTS (SELECT 1 FROM public.band_weekly_payroll_settlements s
                 WHERE s.band_id = v_band_id AND s.week_start = v_week) THEN CONTINUE; END IF;

      -- Spendable = treasury minus money reserved for bookings, never more than the shown balance.
      SELECT LEAST(COALESCE(v_band.band_balance,0)::bigint,
                   (t.balance_minor - COALESCE(t.reserved_balance_minor,0)) / 100)
        INTO v_available
      FROM public.band_treasuries t
      WHERE t.band_id = v_band_id AND t.is_primary IS TRUE FOR UPDATE;
      IF v_available IS NULL OR v_available <= 0 THEN CONTINUE; END IF;

      SELECT count(DISTINCT bm.profile_id) INTO v_count
      FROM public.band_members bm
      JOIN public.profiles p ON p.id = bm.profile_id AND p.died_at IS NULL AND p.deleted_at IS NULL
      WHERE bm.band_id = v_band_id
        AND COALESCE(bm.member_status,'active') = 'active'
        AND NOT COALESCE(bm.is_touring_member,false);
      IF v_count = 0 THEN CONTINUE; END IF;

      v_each := floor(floor(v_available * v_band.weekly_pay_percent / 100) / v_count)::bigint;
      IF v_each <= 0 THEN CONTINUE; END IF;
      v_total := v_each * v_count;

      INSERT INTO public.band_weekly_payroll_settlements(band_id, week_start, member_count, amount_each, amount_total)
      VALUES (v_band_id, v_week, v_count, v_each, v_total);

      -- Band expense row; the earnings trigger deducts it from the band balance.
      INSERT INTO public.band_earnings(band_id, amount, source, description, earned_by_user_id, metadata)
      VALUES (v_band_id, -v_total::integer, 'weekly_pay',
        format('Weekly pay: %s%% of balance — $%s × %s members', v_band.weekly_pay_percent, v_each, v_count),
        v_band.leader_id, jsonb_build_object('week_start', v_week));

      FOR v_member IN
        SELECT DISTINCT ON (bm.profile_id) bm.profile_id, p.user_id
        FROM public.band_members bm
        JOIN public.profiles p ON p.id = bm.profile_id AND p.died_at IS NULL AND p.deleted_at IS NULL
        WHERE bm.band_id = v_band_id
          AND COALESCE(bm.member_status,'active') = 'active'
          AND NOT COALESCE(bm.is_touring_member,false)
        ORDER BY bm.profile_id
      LOOP
        SELECT * INTO v_withholding FROM public.withhold_player_income_tax(
          v_member.profile_id, v_each * 100, 'band_weekly_pay',
          'band-weekly:'||v_band_id::text||':'||v_week::text||':'||v_member.profile_id::text, NULL);
        UPDATE public.profiles SET cash = COALESCE(cash,0) + (v_withholding.net_minor / 100)
          WHERE id = v_member.profile_id;
        INSERT INTO public.activity_feed(user_id, profile_id, activity_type, message, earnings, metadata)
        VALUES (v_member.user_id, v_member.profile_id, 'band_pay',
          format('Received $%s weekly pay from %s after $%s income tax',
            v_withholding.net_minor/100, v_band.name, v_withholding.tax_minor/100),
          v_withholding.net_minor/100,
          jsonb_build_object('band_id',v_band_id,'week_start',v_week,
            'gross_pay',v_each,'income_tax',v_withholding.tax_minor/100,
            'tax_receipt_id',v_withholding.receipt_id));
      END LOOP;

      v_paid := v_paid + 1;
      v_sum := v_sum + v_total;
    EXCEPTION WHEN OTHERS THEN
      v_failures := v_failures || jsonb_build_object('band_id', v_band_id, 'error', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('week_start', v_week, 'paid_bands', v_paid, 'total_paid', v_sum, 'failures', v_failures);
END;
$function$;


CREATE OR REPLACE FUNCTION public.pay_company_dividends(p_company_id uuid, p_total numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c record;
  total_shares integer;
  per_share numeric;
  s record;
  payout numeric;
  v_dividend_id uuid;
  v_company_city uuid;
  v_gross_minor bigint;
  v_withholding record;
BEGIN
  SELECT id, owner_id, balance, shares_outstanding, headquarters_city_id INTO c
    FROM public.companies WHERE id = p_company_id FOR UPDATE;
  IF p_total IS NULL OR p_total <= 0 THEN RAISE EXCEPTION 'Dividend must be positive'; END IF;
  v_company_city := c.headquarters_city_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Company not found'; END IF;
  IF c.owner_id <> auth.uid() THEN RAISE EXCEPTION 'Only the owner can declare dividends'; END IF;
  IF c.balance < p_total THEN RAISE EXCEPTION 'Insufficient company balance'; END IF;

  SELECT COALESCE(SUM(shares), 0) INTO total_shares FROM public.company_shares WHERE company_id = p_company_id;
  IF total_shares = 0 THEN RAISE EXCEPTION 'No outstanding shareholders'; END IF;

  per_share := ROUND(p_total / total_shares, 4);
  UPDATE public.companies SET balance = balance - p_total WHERE id = p_company_id;

  INSERT INTO public.company_dividends (company_id, total_amount, per_share)
  VALUES (p_company_id, p_total, per_share) RETURNING id INTO v_dividend_id;

  FOR s IN SELECT cs.holder_profile_id, cs.shares, p.user_id
             FROM public.company_shares cs JOIN public.profiles p ON p.id = cs.holder_profile_id
            WHERE cs.company_id = p_company_id
  LOOP
    payout := ROUND(per_share * s.shares, 2);
    -- Legacy player cash is whole dollars; calculate personal withholding on that amount.
    v_gross_minor := round(payout)::bigint * 100;
    IF v_gross_minor > 0 THEN
      SELECT * INTO v_withholding FROM public.withhold_player_income_tax(
        s.holder_profile_id,v_gross_minor,'company_dividend',
        'dividend:'||v_dividend_id::text||':'||s.holder_profile_id::text,v_company_city);
      UPDATE public.profiles SET cash = COALESCE(cash,0)+(v_withholding.net_minor/100)
        WHERE id=s.holder_profile_id;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('total',p_total,'per_share',per_share,'shares',total_shares,'dividend_id',v_dividend_id,'income_tax_withheld',true);
END; $function$;
CREATE OR REPLACE FUNCTION public.process_company_employment_payroll(p_week_start date DEFAULT (date_trunc('week'::text, (now() - '7 days'::interval)))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  contract public.company_employment_contracts;
  payroll_id uuid;
  bonus_due bigint;
  total_due bigint;
  transaction_id uuid;
  tax_transaction_id uuid;
  company_city_id uuid;
  v_withholding record;
  failure_code text;
  paid_count integer := 0;
  unpaid_count integer := 0;
  skipped_count integer := 0;
begin
  if p_week_start is null
    or p_week_start <> date_trunc('week', p_week_start::timestamp)::date
    or p_week_start > date_trunc('week', timezone('utc', now()))::date then
    raise exception 'INVALID_PAYROLL_WEEK';
  end if;

  for contract in
    select *
    from public.company_employment_contracts
    where status in ('trial', 'active', 'suspended_unpaid', 'disputed')
      and starts_at < p_week_start + 7
      and (ends_at is null or ends_at >= p_week_start)
    order by id
    for update skip locked
  loop
    select coalesce(sum(bonus_due_minor), 0) into bonus_due
    from public.company_employment_task_evidence
    where contract_id = contract.id and payroll_week = p_week_start;
    total_due := contract.weekly_salary_minor + bonus_due;
    payroll_id := null;

    insert into public.company_employment_payroll (
      contract_id, week_start, salary_due_minor, bonus_due_minor,
      total_due_minor, paid_minor, status, failure_reason
    ) values (
      contract.id, p_week_start, contract.weekly_salary_minor, bonus_due,
      total_due, 0, 'unpaid', 'processing'
    ) on conflict (contract_id, week_start) do nothing
    returning id into payroll_id;

    if payroll_id is null then
      skipped_count := skipped_count + 1;
      continue;
    end if;

    begin
      transaction_id := null;
      tax_transaction_id := null;
      if total_due > 0 then
        select headquarters_city_id into company_city_id from public.companies
          where id=contract.company_id;
        select * into v_withholding from public.withhold_player_income_tax(
          contract.employee_profile_id,total_due,'company_wage',
          'employment-payroll:'||contract.id::text||':'||p_week_start::text,company_city_id);
        if v_withholding.net_minor > 0 then
          transaction_id := public.finance_transfer(
            'company'::public.financial_owner_type,
            contract.company_id,
            'player'::public.financial_owner_type,
            contract.employee_profile_id,
            v_withholding.net_minor,
            'wage_payment'::public.financial_transaction_category,
            'Employment payroll (net of income tax)',
            'employment-payroll:' || contract.id::text || ':' || p_week_start::text,
            'employment_contract',
            contract.id,
            null,
            jsonb_build_object(
              'week_start',p_week_start,'salary_minor',contract.weekly_salary_minor,
              'bonus_minor',bonus_due,'gross_minor',total_due,
              'income_tax_minor',v_withholding.tax_minor,
              'tax_receipt_id',v_withholding.receipt_id
            )
          );
          update public.financial_transactions
          set tax_amount_minor=v_withholding.tax_minor
          where id=transaction_id;
        end if;
        if v_withholding.tax_minor > 0 then
          tax_transaction_id := public.finance_transfer(
            'company'::public.financial_owner_type,contract.company_id,
            'city'::public.financial_owner_type,v_withholding.withholding_city_id,
            v_withholding.tax_minor,'tax_placeholder'::public.financial_transaction_category,
            'Employment income tax remittance',
            'employment-payroll-tax:'||contract.id::text||':'||p_week_start::text,
            'employment_contract',contract.id,null,
            jsonb_build_object('week_start',p_week_start,'tax_receipt_id',v_withholding.receipt_id)
          );
        end if;
      end if;

      update public.company_employment_payroll
      set paid_minor = total_due,
          status = 'paid',
          payment_transaction_id = transaction_id,
          failure_reason = null,
          processed_at = timezone('utc', now())
      where id = payroll_id;

      update public.company_employment_contracts
      set consecutive_unpaid_weeks = 0,
          status = case
            when status = 'suspended_unpaid' then 'active'
            when status = 'trial' and trial_ends_at is not null and trial_ends_at <= timezone('utc', now()) then 'active'
            else status
          end,
          updated_at = timezone('utc', now())
      where id = contract.id;

      update public.company_employees
      set total_earned = coalesce(total_earned, 0) + (total_due::numeric / 100),
          status = 'active',
          updated_at = timezone('utc', now())
      where id = contract.employment_id;

      insert into public.social_contract_events (
        contract_id, event_type, actor_kind, contract_version, evidence, idempotency_key
      ) values (
        contract.social_contract_id, 'employment_payroll_paid', 'system', 1,
        jsonb_build_object('week_start', p_week_start, 'amount_minor', total_due, 'transaction_id', transaction_id),
        'employment-payroll:' || p_week_start::text
      ) on conflict do nothing;

      paid_count := paid_count + 1;
    exception when others then
      failure_code := case
        when sqlerrm ilike '%insufficient%' then 'insufficient_company_funds'
        when sqlerrm ilike '%account%' then 'company_finance_account_unavailable'
        else 'payroll_transfer_failed'
      end;

      update public.company_employment_payroll
      set status = 'unpaid',
          paid_minor = 0,
          payment_transaction_id = null,
          failure_reason = failure_code,
          processed_at = timezone('utc', now())
      where id = payroll_id;

      update public.company_employment_contracts
      set consecutive_unpaid_weeks = consecutive_unpaid_weeks + 1,
          status = case when status = 'disputed' then 'disputed' else 'suspended_unpaid' end,
          updated_at = timezone('utc', now())
      where id = contract.id;

      update public.company_employees
      set status = 'suspended_unpaid', updated_at = timezone('utc', now())
      where id = contract.employment_id;

      insert into public.social_contract_events (
        contract_id, event_type, actor_kind, contract_version, evidence, idempotency_key
      ) values (
        contract.social_contract_id, 'employment_non_payment', 'system', 1,
        jsonb_build_object('week_start', p_week_start, 'amount_minor', total_due, 'failure_code', failure_code),
        'employment-non-payment:' || p_week_start::text
      ) on conflict do nothing;

      unpaid_count := unpaid_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'week_start', p_week_start,
    'paid_contracts', paid_count,
    'unpaid_contracts', unpaid_count,
    'skipped_contracts', skipped_count
  );
end;
$function$;


REVOKE ALL ON FUNCTION public.withhold_player_income_tax(uuid,bigint,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.withhold_player_income_tax(uuid,bigint,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.pay_mayor_salary_atomic(p_mayor_id uuid,p_week_of date,p_amount bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $tax$
DECLARE v_profile_id uuid; v_city_id uuid; v_withholding record;
BEGIN
  SELECT profile_id,city_id INTO v_profile_id,v_city_id FROM public.city_mayors
   WHERE id=p_mayor_id AND is_current=true FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'INVALID_MAYOR_SALARY'; END IF;

  INSERT INTO public.mayor_salary_payments(mayor_id,profile_id,city_id,amount,week_of)
   VALUES(p_mayor_id,v_profile_id,v_city_id,p_amount,p_week_of)
   ON CONFLICT(mayor_id,week_of) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT * INTO v_withholding FROM public.withhold_player_income_tax(
    v_profile_id,p_amount,'mayor_salary','mayor:'||p_mayor_id||':'||p_week_of,v_city_id);
  UPDATE public.profiles SET cash=coalesce(cash,0)+(v_withholding.net_minor/100)
   WHERE id=v_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mayor profile % not found',v_profile_id; END IF;
  RETURN true;
END;
$tax$;
