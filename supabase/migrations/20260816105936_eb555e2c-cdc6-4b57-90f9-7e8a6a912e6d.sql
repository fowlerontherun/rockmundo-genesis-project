-- allow flexible employee role labels
ALTER TABLE public.company_employees DROP CONSTRAINT IF EXISTS company_employees_role_check;

ALTER TABLE public.company_employees
  ADD COLUMN IF NOT EXISTS vacancy_id uuid REFERENCES public.company_vacancies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shifts_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS company_reviews_unique_reviewer
  ON public.company_reviews (company_id, reviewer_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS company_shift_claims_unique
  ON public.company_shift_claims (shift_id, profile_id);

-- ============ APPLY ============
CREATE OR REPLACE FUNCTION public.apply_to_company_vacancy(p_vacancy_id uuid, p_message text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_vac public.company_vacancies;
  v_score integer := 50;
  v_id uuid;
  v_skill text;
  v_needed integer;
  v_have integer;
  v_total integer := 0;
  v_met integer := 0;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  SELECT * INTO v_vac FROM public.company_vacancies WHERE id = p_vacancy_id;
  IF v_vac.id IS NULL THEN RAISE EXCEPTION 'Vacancy not found'; END IF;
  IF v_vac.status NOT IN ('open','advertised','published','active') THEN
    RAISE EXCEPTION 'This vacancy is not accepting applications';
  END IF;
  IF v_vac.closes_at IS NOT NULL AND v_vac.closes_at < now() THEN
    RAISE EXCEPTION 'This vacancy has closed';
  END IF;
  IF COALESCE(v_vac.positions_filled,0) >= COALESCE(v_vac.positions_available,1) THEN
    RAISE EXCEPTION 'All positions have been filled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_job_applications
    WHERE vacancy_id = p_vacancy_id AND applicant_profile_id = v_profile
      AND status IN ('pending','application_submitted','shortlisted','offer_made')
  ) THEN RAISE EXCEPTION 'You already have an open application for this role'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_employees
    WHERE company_id = v_vac.company_id AND profile_id = v_profile AND status = 'active'
  ) THEN RAISE EXCEPTION 'You already work for this company'; END IF;

  FOR v_skill, v_needed IN
    SELECT key, GREATEST(0, (value)::text::numeric::int)
    FROM jsonb_each(COALESCE(v_vac.minimum_skill_levels,'{}'::jsonb))
  LOOP
    v_total := v_total + 1;
    SELECT COALESCE(MAX(current_level),0) INTO v_have
      FROM public.skill_progress WHERE profile_id = v_profile AND skill_slug = v_skill;
    IF v_have >= v_needed THEN v_met := v_met + 1; END IF;
  END LOOP;
  IF v_total > 0 THEN v_score := 20 + ((v_met::numeric / v_total) * 80)::int; END IF;

  INSERT INTO public.company_job_applications (vacancy_id, applicant_profile_id, status, suitability_score, message)
  VALUES (p_vacancy_id, v_profile, 'pending', v_score, p_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============ WITHDRAW ============
CREATE OR REPLACE FUNCTION public.withdraw_company_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_profile uuid := public.current_profile_id(); v_status text;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  SELECT status INTO v_status FROM public.company_job_applications
   WHERE id = p_application_id AND applicant_profile_id = v_profile;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_status NOT IN ('pending','application_submitted','shortlisted','offer_made') THEN
    RAISE EXCEPTION 'This application can no longer be withdrawn';
  END IF;
  UPDATE public.company_job_applications
     SET status = 'withdrawn', updated_at = now()
   WHERE id = p_application_id;
END;
$$;

-- ============ RESPOND TO OFFER ============
CREATE OR REPLACE FUNCTION public.respond_to_company_offer(p_application_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_app public.company_job_applications;
  v_vac public.company_vacancies;
  v_emp_id uuid;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  SELECT * INTO v_app FROM public.company_job_applications
   WHERE id = p_application_id AND applicant_profile_id = v_profile;
  IF v_app.id IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF v_app.status <> 'offer_made' THEN RAISE EXCEPTION 'There is no open offer on this application'; END IF;
  IF v_app.offer_expires_at IS NOT NULL AND v_app.offer_expires_at < now() THEN
    UPDATE public.company_job_applications SET status='expired', updated_at=now() WHERE id=p_application_id;
    RAISE EXCEPTION 'This offer has expired';
  END IF;

  SELECT * INTO v_vac FROM public.company_vacancies WHERE id = v_app.vacancy_id;

  IF NOT p_accept THEN
    UPDATE public.company_job_applications SET status='declined', updated_at=now() WHERE id=p_application_id;
    RETURN jsonb_build_object('accepted', false);
  END IF;

  IF COALESCE(v_vac.positions_filled,0) >= COALESCE(v_vac.positions_available,1) THEN
    RAISE EXCEPTION 'All positions have already been filled';
  END IF;

  INSERT INTO public.company_employees (company_id, profile_id, role, salary, status, vacancy_id)
  VALUES (v_vac.company_id, v_profile, COALESCE(NULLIF(v_vac.staff_category,''), lower(replace(COALESCE(v_vac.job_title,'staff'),' ','_'))), COALESCE(v_vac.weekly_wage,0), 'active', v_vac.id)
  RETURNING id INTO v_emp_id;

  UPDATE public.company_vacancies
     SET positions_filled = COALESCE(positions_filled,0) + 1,
         status = CASE WHEN COALESCE(positions_filled,0) + 1 >= COALESCE(positions_available,1) THEN 'filled' ELSE status END,
         updated_at = now()
   WHERE id = v_vac.id;

  UPDATE public.company_job_applications
     SET status='hired', employment_id = v_emp_id, updated_at = now()
   WHERE id = p_application_id;

  RETURN jsonb_build_object('accepted', true, 'employment_id', v_emp_id);
END;
$$;

-- ============ RESIGN ============
CREATE OR REPLACE FUNCTION public.resign_company_employment(p_employee_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_profile uuid := public.current_profile_id(); v_emp public.company_employees;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  SELECT * INTO v_emp FROM public.company_employees WHERE id = p_employee_id;
  IF v_emp.id IS NULL THEN RAISE EXCEPTION 'Employment record not found'; END IF;
  IF v_emp.profile_id <> v_profile AND NOT public.is_company_owner(v_emp.company_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  UPDATE public.company_employees SET status='terminated', updated_at=now() WHERE id=p_employee_id;
  IF v_emp.vacancy_id IS NOT NULL THEN
    UPDATE public.company_vacancies
       SET positions_filled = GREATEST(0, COALESCE(positions_filled,0) - 1),
           status = CASE WHEN status='filled' THEN 'open' ELSE status END,
           updated_at = now()
     WHERE id = v_emp.vacancy_id;
  END IF;
END;
$$;

-- ============ EMPLOYEE ROSTER ============
CREATE OR REPLACE FUNCTION public.get_company_employee_roster(p_company_id uuid)
RETURNS TABLE (
  id uuid, profile_id uuid, display_name text, username text,
  role text, salary numeric, status text, performance_rating integer,
  shifts_completed integer, total_earned numeric, hired_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.profile_id,
         COALESCE(p.display_name, p.username, 'Unknown'), p.username,
         e.role, e.salary, e.status, e.performance_rating,
         e.shifts_completed, e.total_earned, e.hired_at
  FROM public.company_employees e
  LEFT JOIN public.profiles p ON p.id = e.profile_id
  WHERE e.company_id = p_company_id
    AND (public.is_company_owner(p_company_id) OR e.profile_id = public.current_profile_id())
  ORDER BY e.status, e.hired_at DESC;
$$;

-- ============ REVIEWS ============
CREATE OR REPLACE FUNCTION public.submit_company_review(p_company_id uuid, p_rating integer, p_comment text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_profile uuid := public.current_profile_id();
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'Rating must be between 1 and 5'; END IF;
  IF public.is_company_owner(p_company_id) THEN RAISE EXCEPTION 'You cannot review your own company'; END IF;

  INSERT INTO public.company_reviews (company_id, reviewer_profile_id, rating, comment)
  VALUES (p_company_id, v_profile, p_rating, NULLIF(p_comment,''))
  ON CONFLICT (company_id, reviewer_profile_id)
  DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now();

  UPDATE public.company_storefront s
     SET rating_avg = agg.avg_rating, rating_count = agg.cnt, updated_at = now()
    FROM (SELECT AVG(rating)::numeric(4,2) avg_rating, COUNT(*) cnt
            FROM public.company_reviews WHERE company_id = p_company_id) agg
   WHERE s.company_id = p_company_id;
END;
$$;

-- ============ SHIFT WORK ============
CREATE OR REPLACE FUNCTION public.claim_company_shift(p_shift_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_shift public.company_shifts;
  v_level integer := 0;
  v_claim uuid;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  SELECT * INTO v_shift FROM public.company_shifts WHERE id = p_shift_id FOR UPDATE;
  IF v_shift.id IS NULL THEN RAISE EXCEPTION 'Shift not found'; END IF;
  IF v_shift.status <> 'open' THEN RAISE EXCEPTION 'This shift is no longer open'; END IF;
  IF v_shift.expires_at IS NOT NULL AND v_shift.expires_at < now() THEN RAISE EXCEPTION 'This shift has expired'; END IF;
  IF COALESCE(v_shift.slots_filled,0) >= COALESCE(v_shift.slots_total,1) THEN RAISE EXCEPTION 'This shift is fully staffed'; END IF;
  IF v_shift.required_skill IS NOT NULL THEN
    SELECT COALESCE(MAX(current_level),0) INTO v_level FROM public.skill_progress
      WHERE profile_id = v_profile AND skill_slug = v_shift.required_skill;
    IF v_level < COALESCE(v_shift.min_skill_level,0) THEN
      RAISE EXCEPTION 'You need % level % to claim this shift', v_shift.required_skill, v_shift.min_skill_level;
    END IF;
  END IF;

  INSERT INTO public.company_shift_claims (shift_id, profile_id, status)
  VALUES (p_shift_id, v_profile, 'claimed')
  ON CONFLICT (shift_id, profile_id) DO NOTHING
  RETURNING id INTO v_claim;
  IF v_claim IS NULL THEN RAISE EXCEPTION 'You already claimed this shift'; END IF;

  UPDATE public.company_shifts
     SET slots_filled = COALESCE(slots_filled,0) + 1,
         status = CASE WHEN COALESCE(slots_filled,0) + 1 >= COALESCE(slots_total,1) THEN 'full' ELSE 'open' END,
         updated_at = now()
   WHERE id = p_shift_id;
  RETURN v_claim;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_company_shift(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
  v_claim public.company_shift_claims;
  v_shift public.company_shifts;
  v_pay numeric;
  v_balance numeric;
BEGIN
  IF v_profile IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  SELECT * INTO v_claim FROM public.company_shift_claims WHERE id = p_claim_id FOR UPDATE;
  IF v_claim.id IS NULL OR v_claim.profile_id <> v_profile THEN RAISE EXCEPTION 'Shift claim not found'; END IF;
  IF v_claim.status <> 'claimed' THEN RAISE EXCEPTION 'This shift has already been settled'; END IF;

  SELECT * INTO v_shift FROM public.company_shifts WHERE id = v_claim.shift_id;
  v_pay := ROUND(COALESCE(v_shift.wage_per_hour,25) * COALESCE(v_shift.duration_hours,4), 2);

  SELECT balance INTO v_balance FROM public.companies WHERE id = v_shift.company_id FOR UPDATE;
  IF COALESCE(v_balance,0) < v_pay THEN
    UPDATE public.company_shift_claims SET status='unpaid', completed_at=now() WHERE id=p_claim_id;
    RAISE EXCEPTION 'The company cannot cover this shift wage right now';
  END IF;

  UPDATE public.companies SET balance = balance - v_pay, updated_at = now() WHERE id = v_shift.company_id;
  INSERT INTO public.company_transactions (company_id, transaction_type, amount, description, category, related_entity_id, related_entity_type)
  VALUES (v_shift.company_id, 'expense', v_pay, 'Shift wage: ' || COALESCE(v_shift.role,'staff'), 'wages', p_claim_id, 'shift_claim');

  UPDATE public.profiles SET cash = COALESCE(cash,0) + v_pay WHERE id = v_profile;

  UPDATE public.company_shift_claims
     SET status='completed', completed_at = now(), paid_amount = v_pay
   WHERE id = p_claim_id;

  UPDATE public.company_shifts SET status = CASE WHEN COALESCE(slots_filled,0) >= COALESCE(slots_total,1) THEN 'completed' ELSE status END, updated_at = now()
   WHERE id = v_shift.id;

  UPDATE public.company_employees
     SET shifts_completed = shifts_completed + 1, total_earned = total_earned + v_pay, updated_at = now()
   WHERE company_id = v_shift.company_id AND profile_id = v_profile AND status='active';

  RETURN jsonb_build_object('paid', v_pay);
END;
$$;

-- ============ AUTOMATION: SHIFT GENERATION (all business types) ============
CREATE OR REPLACE FUNCTION public.generate_company_shifts()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; v_created integer := 0; v_open integer; v_target integer;
BEGIN
  UPDATE public.company_shifts
     SET status='expired', updated_at=now()
   WHERE status IN ('open','full') AND expires_at IS NOT NULL AND expires_at < now();

  FOR r IN
    SELECT c.id, c.company_type, c.balance, COALESCE(d.demand_weight,1.0) AS w,
           COALESCE(s.capacity,100) AS capacity
      FROM public.companies c
      LEFT JOIN public.company_type_definitions d ON d.type_key = c.company_type
      LEFT JOIN public.company_storefront s ON s.company_id = c.id
     WHERE c.status='active' AND c.is_bankrupt = false
       AND COALESCE(d.supports_shifts, true) = true
  LOOP
    SELECT COUNT(*) INTO v_open FROM public.company_shifts
      WHERE company_id = r.id AND status='open' AND (expires_at IS NULL OR expires_at > now());
    v_target := GREATEST(2, LEAST(6, CEIL(r.w * 3)::int));
    IF v_open >= v_target THEN CONTINUE; END IF;

    INSERT INTO public.company_shifts (company_id, role, description, wage_per_hour, duration_hours, slots_total, status, starts_at, expires_at)
    SELECT r.id, 'staff',
           'Auto-generated operational shift',
           ROUND(20 + (r.w * 10) + (random() * 15), 2),
           (ARRAY[3,4,6])[1 + floor(random()*3)::int],
           1 + floor(random()*2)::int,
           'open',
           date_trunc('hour', now()) + ((1 + floor(random()*10))::int * interval '1 hour'),
           now() + interval '2 days'
      FROM generate_series(1, v_target - v_open);
    v_created := v_created + (v_target - v_open);
  END LOOP;
  RETURN v_created;
END;
$$;

-- ============ AUTOMATION: DAILY KPI SNAPSHOT ============
CREATE OR REPLACE FUNCTION public.snapshot_company_kpis()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  INSERT INTO public.company_kpis (
    company_id, metric_date, total_subsidiaries, total_employees,
    total_contracts_active, total_contracts_completed,
    customer_satisfaction_avg, reputation_avg, market_share_estimate,
    growth_rate_monthly, liquidity_ratio
  )
  SELECT c.id, CURRENT_DATE,
    (SELECT COUNT(*) FROM public.companies s WHERE s.parent_company_id = c.id),
    (SELECT COUNT(*) FROM public.company_employees e WHERE e.company_id = c.id AND e.status='active'),
    0, COALESCE(c.total_contracts_won,0),
    COALESCE((SELECT AVG(rating)*20 FROM public.company_reviews r WHERE r.company_id = c.id), 0),
    COALESCE(c.reputation_score,0),
    COALESCE((SELECT market_share FROM public.company_storefront s WHERE s.company_id = c.id), 0),
    0,
    CASE WHEN COALESCE(c.weekly_operating_costs,0) > 0
         THEN ROUND(COALESCE(c.balance,0) / c.weekly_operating_costs, 2) ELSE 0 END
  FROM public.companies c
  WHERE c.status='active' AND c.is_bankrupt = false
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============ AUTOMATION: WEEKLY FINANCE ============
CREATE OR REPLACE FUNCTION public.process_company_weekly_finances()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
  v_week_start date := (date_trunc('week', now() - interval '7 days'))::date;
  v_week_end date := v_week_start + 6;
  v_revenue numeric; v_wages numeric; v_ops numeric; v_total numeric; v_net numeric;
  v_unpaid numeric; v_count integer := 0;
BEGIN
  FOR r IN SELECT id, balance, weekly_operating_costs FROM public.companies
            WHERE status='active' AND is_bankrupt = false
  LOOP
    IF EXISTS (SELECT 1 FROM public.company_weekly_finance_records
                WHERE company_id = r.id AND week_start = v_week_start) THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(COALESCE(net_revenue, revenue)),0) INTO v_revenue
      FROM public.company_demand_log
     WHERE company_id = r.id AND resolved_for BETWEEN v_week_start AND v_week_end;

    SELECT COALESCE(SUM(salary),0) INTO v_wages
      FROM public.company_employees WHERE company_id = r.id AND status='active';

    v_ops := COALESCE(r.weekly_operating_costs,0);
    v_total := v_wages + v_ops;
    v_net := v_revenue - v_total;
    v_unpaid := 0;

    IF COALESCE(r.balance,0) + v_revenue < v_total THEN
      v_unpaid := v_total - GREATEST(0, COALESCE(r.balance,0) + v_revenue);
    END IF;

    UPDATE public.companies
       SET balance = COALESCE(balance,0) + v_revenue - (v_total - v_unpaid),
           negative_balance_since = CASE
             WHEN COALESCE(balance,0) + v_revenue - (v_total - v_unpaid) < 0
               THEN COALESCE(negative_balance_since, now()) ELSE NULL END,
           updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.company_weekly_finance_records (
      company_id, week_start, week_end, gross_revenue, staff_wage_costs,
      total_costs, net_profit, balance_after, unpaid_amount, processing_status
    )
    SELECT r.id, v_week_start, v_week_end, v_revenue, v_wages, v_total, v_net,
           (SELECT balance FROM public.companies WHERE id = r.id), v_unpaid,
           CASE WHEN v_unpaid > 0 THEN 'partial' ELSE 'processed' END;

    IF v_revenue > 0 THEN
      INSERT INTO public.company_transactions (company_id, transaction_type, amount, description, category)
      VALUES (r.id, 'income', v_revenue, 'Weekly trading revenue', 'revenue');
    END IF;
    IF v_total - v_unpaid > 0 THEN
      INSERT INTO public.company_transactions (company_id, transaction_type, amount, description, category)
      VALUES (r.id, 'expense', v_total - v_unpaid, 'Weekly wages and operating costs', 'operations');
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_to_company_vacancy(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_company_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_company_offer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resign_company_employment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_employee_roster(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_company_review(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_company_shift(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_company_shift(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_company_shifts() TO service_role;
GRANT EXECUTE ON FUNCTION public.snapshot_company_kpis() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_company_weekly_finances() TO service_role;

SELECT cron.schedule('generate-company-shifts-daily', '0 5 * * *', 'SELECT public.generate_company_shifts();')
  WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='generate-company-shifts-daily');
SELECT cron.schedule('resolve-company-demand-daily', '15 2 * * *', 'SELECT public.resolve_company_demand(CURRENT_DATE - 1);')
  WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='resolve-company-demand-daily');
SELECT cron.schedule('snapshot-company-kpis-daily', '30 2 * * *', 'SELECT public.snapshot_company_kpis();')
  WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='snapshot-company-kpis-daily');
SELECT cron.schedule('process-company-weekly-finances', '0 4 * * 1', 'SELECT public.process_company_weekly_finances();')
  WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='process-company-weekly-finances');