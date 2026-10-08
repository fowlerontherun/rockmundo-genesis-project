-- Complete company recruitment and real-player employment lifecycle.

ALTER TABLE public.company_vacancies
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time',
  ADD COLUMN IF NOT EXISTS expected_activity_level text NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS offer_expiry_days integer NOT NULL DEFAULT 7 CHECK (offer_expiry_days BETWEEN 1 AND 30),
  ADD COLUMN IF NOT EXISTS last_published_at timestamptz;

ALTER TABLE public.company_job_applications
  ADD COLUMN IF NOT EXISTS offer_start_date date,
  ADD COLUMN IF NOT EXISTS offer_contract_end_date date,
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_wage numeric,
  ADD COLUMN IF NOT EXISTS suitability_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.company_employees
  ADD COLUMN IF NOT EXISTS vacancy_id uuid REFERENCES public.company_vacancies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.company_job_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS dismissal_reason_private text;

ALTER TABLE public.company_vacancies DROP CONSTRAINT IF EXISTS company_vacancies_status_check;
ALTER TABLE public.company_vacancies ADD CONSTRAINT company_vacancies_status_check
  CHECK (status IN ('draft','open','closed','filled','cancelled','expired'));
ALTER TABLE public.company_vacancies DROP CONSTRAINT IF EXISTS company_vacancies_employment_type_check;
ALTER TABLE public.company_vacancies ADD CONSTRAINT company_vacancies_employment_type_check
  CHECK (employment_type IN ('full_time','part_time','contract','temporary'));

ALTER TABLE public.company_job_applications DROP CONSTRAINT IF EXISTS company_job_applications_status_check;
ALTER TABLE public.company_job_applications ADD CONSTRAINT company_job_applications_status_check
  CHECK (status IN ('pending','withdrawn','rejected','offer_made','offer_declined','offer_expired','hired','cancelled_vacancy_closed','application_submitted','application_withdrawn','application_rejected','employed','resigned','dismissed','contract_completed','suspended_unpaid'));

ALTER TABLE public.company_employees DROP CONSTRAINT IF EXISTS company_employees_status_check;
ALTER TABLE public.company_employees ADD CONSTRAINT company_employees_status_check
  CHECK (status IN ('active','on_leave','terminated','inactive'));

ALTER TABLE public.company_employees DROP CONSTRAINT IF EXISTS company_employees_contract_status_check;
ALTER TABLE public.company_employees ADD CONSTRAINT company_employees_contract_status_check
  CHECK (contract_status IN ('offered','active','suspended_unpaid','resigned','dismissed','contract_completed','terminated','inactive','application_submitted','application_withdrawn','application_rejected','offer_made','offer_declined','employed'));

CREATE INDEX IF NOT EXISTS idx_company_vacancies_company_status ON public.company_vacancies(company_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_applications_offer_expiry ON public.company_job_applications(status, offer_expires_at) WHERE status = 'offer_made';
CREATE UNIQUE INDEX IF NOT EXISTS company_job_applications_one_active_lifecycle_idx
  ON public.company_job_applications(vacancy_id, applicant_profile_id)
  WHERE status IN ('pending','application_submitted','offer_made');
CREATE UNIQUE INDEX IF NOT EXISTS company_employees_one_active_player_role_idx
  ON public.company_employees(company_id, profile_id, COALESCE(job_title,''))
  WHERE employee_type = 'player' AND status = 'active' AND contract_status IN ('active','employed','suspended_unpaid');

CREATE OR REPLACE FUNCTION public.is_company_manager(p_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id AND c.owner_id = auth.uid())
     OR EXISTS (SELECT 1 FROM public.company_employees ce JOIN public.profiles p ON p.id = ce.profile_id WHERE ce.company_id = p_company_id AND p.user_id = auth.uid() AND ce.status = 'active' AND ce.contract_status IN ('active','employed') AND ce.staff_category IN ('manager','assistant_manager'));
$$;

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.calculate_company_job_suitability(p_profile_id uuid, p_vacancy_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v record; p record; score integer := 50; reasons text[] := ARRAY[]::text[]; rating text; missing text[] := ARRAY[]::text[]; skill_count int;
BEGIN
  SELECT * INTO v FROM public.company_vacancies WHERE id = p_vacancy_id;
  SELECT * INTO p FROM public.profiles WHERE id = p_profile_id;
  IF v.id IS NULL OR p.id IS NULL THEN RETURN jsonb_build_object('score',0,'rating','Poor match','reasons',jsonb_build_array('Missing player or vacancy'),'missingRequirements',jsonb_build_array()); END IF;
  IF v.location_city_id IS NOT NULL AND p.current_city_id = v.location_city_id THEN score := score + 10; reasons := reasons || 'Already in the company city';
  ELSIF v.location_city_id IS NOT NULL THEN score := score - 10; reasons := reasons || 'Would need to travel or relocate'; END IF;
  skill_count := (SELECT count(*) FROM jsonb_object_keys(COALESCE(v.required_skills,'{}'::jsonb)));
  IF skill_count = 0 THEN score := score + 10; reasons := reasons || 'No mandatory skill gaps'; ELSE score := score + LEAST(20, skill_count * 5); reasons := reasons || 'Required skills are listed for review'; END IF;
  IF EXISTS (SELECT 1 FROM public.company_employees WHERE profile_id = p_profile_id AND status = 'active' AND contract_status IN ('active','employed') AND employment_type IN ('full_time','permanent')) AND v.employment_type IN ('full_time','permanent') THEN
    score := score - 30; reasons := reasons || 'Conflicts with an active full-time company job'; missing := missing || 'No conflicting full-time employment';
  END IF;
  score := GREATEST(0, LEAST(100, score + LEAST(15, COALESCE(p.fame,0) / 100)));
  rating := CASE WHEN score >= 85 THEN 'Excellent match' WHEN score >= 70 THEN 'Good match' WHEN score >= 45 THEN 'Partial match' ELSE 'Poor match' END;
  RETURN jsonb_build_object('score',score,'rating',rating,'reasons',to_jsonb(reasons),'missingRequirements',to_jsonb(missing));
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_company_vacancy(p_vacancy_id uuid DEFAULT NULL, p_company_id uuid DEFAULT NULL, p_action text DEFAULT 'save_draft', p_job_title text DEFAULT NULL, p_staff_category text DEFAULT 'specialist', p_description text DEFAULT NULL, p_positions_available integer DEFAULT 1, p_weekly_wage numeric DEFAULT 0, p_employment_type text DEFAULT 'full_time', p_is_permanent boolean DEFAULT true, p_contract_duration_weeks integer DEFAULT NULL, p_required_skills jsonb DEFAULT '{}'::jsonb, p_preferred_skills jsonb DEFAULT '{}'::jsonb, p_minimum_skill_levels jsonb DEFAULT '{}'::jsonb, p_location_city_id uuid DEFAULT NULL, p_expected_activity_level text DEFAULT 'regular', p_closes_at timestamptz DEFAULT NULL)
RETURNS public.company_vacancies LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.company_vacancies; target_company uuid := COALESCE(p_company_id, (SELECT company_id FROM public.company_vacancies WHERE id = p_vacancy_id));
BEGIN
  IF NOT public.is_company_manager(target_company) THEN RAISE EXCEPTION 'Not authorised to manage vacancies'; END IF;
  IF p_action IN ('save_draft','publish') THEN
    IF p_positions_available IS NULL OR p_positions_available < 1 THEN RAISE EXCEPTION 'Position count must be at least one'; END IF;
    IF p_weekly_wage IS NULL OR p_weekly_wage < 0 THEN RAISE EXCEPTION 'Weekly wage cannot be negative'; END IF;
    IF p_closes_at IS NOT NULL AND p_closes_at <= now() THEN RAISE EXCEPTION 'Closing date must be in the future'; END IF;
    IF p_action = 'publish' AND (COALESCE(trim(p_job_title),'') = '' OR p_weekly_wage <= 0 OR p_location_city_id IS NULL) THEN RAISE EXCEPTION 'Published vacancies require title, wage, and location'; END IF;
    IF p_vacancy_id IS NULL THEN
      INSERT INTO public.company_vacancies(company_id, job_title, staff_category, description, positions_available, weekly_wage, employment_type, is_permanent, contract_duration_weeks, required_skills, preferred_skills, minimum_skill_levels, location_city_id, expected_activity_level, closes_at, status, created_by, last_published_at)
      VALUES (target_company, p_job_title, p_staff_category, p_description, p_positions_available, p_weekly_wage, p_employment_type, p_is_permanent, p_contract_duration_weeks, p_required_skills, p_preferred_skills, p_minimum_skill_levels, p_location_city_id, p_expected_activity_level, p_closes_at, CASE WHEN p_action='publish' THEN 'open' ELSE 'draft' END, auth.uid(), CASE WHEN p_action='publish' THEN now() ELSE NULL END) RETURNING * INTO v;
    ELSE
      UPDATE public.company_vacancies SET job_title=p_job_title, staff_category=p_staff_category, description=p_description, positions_available=GREATEST(p_positions_available, positions_filled), weekly_wage=p_weekly_wage, employment_type=p_employment_type, is_permanent=p_is_permanent, contract_duration_weeks=p_contract_duration_weeks, required_skills=p_required_skills, preferred_skills=p_preferred_skills, minimum_skill_levels=p_minimum_skill_levels, location_city_id=p_location_city_id, expected_activity_level=p_expected_activity_level, closes_at=p_closes_at, status=CASE WHEN p_action='publish' THEN 'open' ELSE status END, last_published_at=CASE WHEN p_action='publish' THEN COALESCE(last_published_at, now()) ELSE last_published_at END, updated_at=now() WHERE id=p_vacancy_id AND status IN ('draft','open','closed') RETURNING * INTO v;
    END IF;
  ELSIF p_action IN ('close','cancel','reopen') THEN
    UPDATE public.company_vacancies SET status = CASE p_action WHEN 'close' THEN 'closed' WHEN 'cancel' THEN 'cancelled' ELSE 'open' END, updated_at=now() WHERE id=p_vacancy_id AND (p_action <> 'reopen' OR positions_filled < positions_available) RETURNING * INTO v;
    IF p_action IN ('close','cancel') THEN UPDATE public.company_job_applications SET status='cancelled_vacancy_closed', updated_at=now() WHERE vacancy_id=p_vacancy_id AND status IN ('pending','application_submitted'); END IF;
  ELSE RAISE EXCEPTION 'Unknown vacancy action'; END IF;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Vacancy action failed'; END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_to_company_vacancy(p_vacancy_id uuid, p_message text DEFAULT NULL)
RETURNS public.company_job_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.current_profile_id(); v record; app public.company_job_applications; fit jsonb; owner_user uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Profile not found'; END IF;
  SELECT v.*, c.status company_status, c.owner_id INTO v FROM public.company_vacancies v JOIN public.companies c ON c.id=v.company_id WHERE v.id=p_vacancy_id FOR UPDATE;
  IF v.id IS NULL OR v.status <> 'open' OR v.positions_filled >= v.positions_available THEN RAISE EXCEPTION 'Vacancy is not open'; END IF;
  IF v.closes_at IS NOT NULL AND v.closes_at <= now() THEN UPDATE public.company_vacancies SET status='expired' WHERE id=v.id; RAISE EXCEPTION 'Vacancy has expired'; END IF;
  IF v.company_status <> 'active' THEN RAISE EXCEPTION 'Company is not active'; END IF;
  IF v.owner_id = auth.uid() THEN RAISE EXCEPTION 'Company owners cannot apply to their own company'; END IF;
  IF EXISTS (SELECT 1 FROM public.company_job_applications WHERE vacancy_id=p_vacancy_id AND applicant_profile_id=me AND status IN ('pending','application_submitted','offer_made')) THEN RAISE EXCEPTION 'You already have an active application'; END IF;
  IF EXISTS (SELECT 1 FROM public.company_employees WHERE company_id=v.company_id AND profile_id=me AND status='active' AND contract_status IN ('active','employed')) THEN RAISE EXCEPTION 'You already work for this company'; END IF;
  fit := public.calculate_company_job_suitability(me, p_vacancy_id);
  INSERT INTO public.company_job_applications(vacancy_id, company_id, applicant_profile_id, message, suitability_score, suitability_snapshot, status)
  VALUES (p_vacancy_id, v.company_id, me, p_message, (fit->>'score')::int, fit, 'pending') RETURNING * INTO app;
  PERFORM public.create_notification(v.owner_id, NULL, 'company_recruitment', 'info', 'New job application', 'A player applied for ' || v.job_title, '/company/' || v.company_id, jsonb_build_object('application_id', app.id, 'vacancy_id', v.id));
  RETURN app;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_company_application(p_application_id uuid)
RETURNS public.company_job_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.current_profile_id(); app public.company_job_applications; owner_user uuid;
BEGIN
  UPDATE public.company_job_applications SET status='withdrawn', updated_at=now() WHERE id=p_application_id AND applicant_profile_id=me AND status IN ('pending','application_submitted') RETURNING * INTO app;
  IF app.id IS NULL THEN SELECT * INTO app FROM public.company_job_applications WHERE id=p_application_id AND applicant_profile_id=me; IF app.id IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF; END IF;
  SELECT owner_id INTO owner_user FROM public.companies WHERE id=app.company_id;
  PERFORM public.create_notification(owner_user, NULL, 'company_recruitment', 'info', 'Application withdrawn', 'An applicant withdrew their application.', '/company/' || app.company_id, jsonb_build_object('application_id', app.id));
  RETURN app;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_company_application(p_application_id uuid, p_action text, p_offer_expires_at timestamptz DEFAULT NULL)
RETURNS public.company_job_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE app public.company_job_applications; v record; applicant_user uuid;
BEGIN
  SELECT * INTO app FROM public.company_job_applications WHERE id=p_application_id FOR UPDATE;
  IF app.id IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF NOT public.is_company_manager(app.company_id) THEN RAISE EXCEPTION 'Not authorised to review applications'; END IF;
  SELECT * INTO v FROM public.company_vacancies WHERE id=app.vacancy_id FOR UPDATE;
  IF p_action = 'reject' THEN
    IF app.status NOT IN ('pending','application_submitted','offer_made') THEN RETURN app; END IF;
    UPDATE public.company_job_applications SET status='rejected', reviewed_by=auth.uid(), reviewed_at=now(), decided_at=now(), updated_at=now() WHERE id=app.id RETURNING * INTO app;
  ELSIF p_action = 'offer' THEN
    IF app.status NOT IN ('pending','application_submitted') THEN RAISE EXCEPTION 'Application is not pending'; END IF;
    IF v.status <> 'open' OR v.positions_filled >= v.positions_available THEN RAISE EXCEPTION 'Vacancy has no available positions'; END IF;
    UPDATE public.company_job_applications SET status='offer_made', reviewed_by=auth.uid(), reviewed_at=now(), offer_expires_at=COALESCE(p_offer_expires_at, now() + make_interval(days => v.offer_expiry_days)), offer_start_date=CURRENT_DATE, offer_contract_end_date=CASE WHEN v.is_permanent THEN NULL ELSE CURRENT_DATE + (COALESCE(v.contract_duration_weeks,12) * 7) END, offer_wage=v.weekly_wage, updated_at=now() WHERE id=app.id RETURNING * INTO app;
  ELSE RAISE EXCEPTION 'Unknown review action'; END IF;
  SELECT user_id INTO applicant_user FROM public.profiles WHERE id=app.applicant_profile_id;
  PERFORM public.create_notification(applicant_user, app.applicant_profile_id, 'company_recruitment', 'info', CASE WHEN p_action='offer' THEN 'Job offer received' ELSE 'Application rejected' END, CASE WHEN p_action='offer' THEN 'You have a company job offer to review.' ELSE 'Your company job application was rejected.' END, '/employment', jsonb_build_object('application_id', app.id));
  RETURN app;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_company_offer(p_application_id uuid, p_accept boolean)
RETURNS public.company_job_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.current_profile_id(); app public.company_job_applications; v record; emp_id uuid; owner_user uuid;
BEGIN
  SELECT * INTO app FROM public.company_job_applications WHERE id=p_application_id AND applicant_profile_id=me FOR UPDATE;
  IF app.id IS NULL THEN RAISE EXCEPTION 'Offer not found'; END IF;
  IF app.status = 'hired' THEN RETURN app; END IF;
  IF app.status <> 'offer_made' THEN RAISE EXCEPTION 'Offer is not active'; END IF;
  IF app.offer_expires_at IS NOT NULL AND app.offer_expires_at <= now() THEN UPDATE public.company_job_applications SET status='offer_expired', updated_at=now() WHERE id=app.id RETURNING * INTO app; RETURN app; END IF;
  SELECT * INTO v FROM public.company_vacancies WHERE id=app.vacancy_id FOR UPDATE;
  IF NOT p_accept THEN UPDATE public.company_job_applications SET status='offer_declined', decided_at=now(), updated_at=now() WHERE id=app.id RETURNING * INTO app; ELSE
    IF v.status <> 'open' OR v.positions_filled >= v.positions_available THEN RAISE EXCEPTION 'Vacancy is no longer available'; END IF;
    IF EXISTS (SELECT 1 FROM public.company_employees WHERE company_id=app.company_id AND profile_id=me AND status='active' AND contract_status IN ('active','employed')) THEN RAISE EXCEPTION 'Already employed by this company'; END IF;
    INSERT INTO public.company_employees(company_id, profile_id, role, employee_type, job_title, staff_category, weekly_wage, salary, employment_type, contract_status, status, skill_rating, activity_rating, suitability_rating, performance_contribution, start_date, contract_end_date, vacancy_id, application_id)
    VALUES (app.company_id, me, CASE WHEN v.staff_category IN ('manager','assistant_manager') THEN 'manager' ELSE 'technician' END, 'player', v.job_title, v.staff_category, COALESCE(app.offer_wage, v.weekly_wage), COALESCE(app.offer_wage, v.weekly_wage), CASE WHEN v.is_permanent THEN 'permanent' ELSE 'contract' END, 'active', 'active', app.suitability_score, 50, app.suitability_score, ROUND(app.suitability_score / 100.0, 2), COALESCE(app.offer_start_date, CURRENT_DATE), app.offer_contract_end_date, v.id, app.id)
    ON CONFLICT DO NOTHING RETURNING id INTO emp_id;
    IF emp_id IS NULL THEN SELECT id INTO emp_id FROM public.company_employees WHERE company_id=app.company_id AND profile_id=me AND status='active' LIMIT 1; END IF;
    UPDATE public.company_job_applications SET status='hired', employment_id=emp_id, decided_at=now(), updated_at=now() WHERE id=app.id RETURNING * INTO app;
    UPDATE public.company_vacancies SET positions_filled=LEAST(positions_available, positions_filled + 1), status=CASE WHEN positions_filled + 1 >= positions_available THEN 'filled' ELSE status END, updated_at=now() WHERE id=v.id;
  END IF;
  SELECT owner_id INTO owner_user FROM public.companies WHERE id=app.company_id;
  PERFORM public.create_notification(owner_user, NULL, 'company_recruitment', 'info', CASE WHEN p_accept THEN 'Job offer accepted' ELSE 'Job offer declined' END, 'A player responded to a company job offer.', '/company/' || app.company_id, jsonb_build_object('application_id', app.id));
  RETURN app;
END;
$$;

CREATE OR REPLACE FUNCTION public.resign_company_employment(p_employee_id uuid)
RETURNS public.company_employees LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.current_profile_id(); emp public.company_employees; owner_user uuid;
BEGIN
  UPDATE public.company_employees SET status='inactive', contract_status='resigned', ended_at=now(), end_date=CURRENT_DATE, end_reason='resigned', updated_at=now() WHERE id=p_employee_id AND profile_id=me AND status='active' RETURNING * INTO emp;
  IF emp.id IS NULL THEN RAISE EXCEPTION 'Active employment not found'; END IF;
  SELECT owner_id INTO owner_user FROM public.companies WHERE id=emp.company_id;
  PERFORM public.create_notification(owner_user, NULL, 'company_recruitment', 'info', 'Employee resigned', 'A real-player employee resigned.', '/company/' || emp.company_id, jsonb_build_object('employee_id', emp.id));
  RETURN emp;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_company_employee(p_employee_id uuid, p_reason text DEFAULT NULL)
RETURNS public.company_employees LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp public.company_employees; employee_user uuid; owner_profile uuid;
BEGIN
  SELECT * INTO emp FROM public.company_employees WHERE id=p_employee_id FOR UPDATE;
  IF emp.id IS NULL THEN RAISE EXCEPTION 'Employee not found'; END IF;
  IF NOT public.is_company_manager(emp.company_id) THEN RAISE EXCEPTION 'Not authorised to dismiss employees'; END IF;
  SELECT p.id INTO owner_profile FROM public.companies c JOIN public.profiles p ON p.user_id=c.owner_id WHERE c.id=emp.company_id LIMIT 1;
  IF emp.profile_id = owner_profile THEN RAISE EXCEPTION 'Company owner cannot be dismissed'; END IF;
  UPDATE public.company_employees SET status='inactive', contract_status='dismissed', ended_at=now(), end_date=CURRENT_DATE, end_reason='dismissed', dismissal_reason_private=left(p_reason, 500), updated_at=now() WHERE id=p_employee_id AND status='active' RETURNING * INTO emp;
  SELECT user_id INTO employee_user FROM public.profiles WHERE id=emp.profile_id;
  PERFORM public.create_notification(employee_user, emp.profile_id, 'company_recruitment', 'warning', 'Employment ended', 'Your company employment was ended.', '/employment', jsonb_build_object('employee_id', emp.id));
  RETURN emp;
END;
$$;

DROP POLICY IF EXISTS "Players apply to open company vacancies" ON public.company_job_applications;
DROP POLICY IF EXISTS "Applicants withdraw applications" ON public.company_job_applications;
CREATE POLICY "Applications are created through recruitment RPC" ON public.company_job_applications FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Applications are updated through recruitment RPC" ON public.company_job_applications FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Company owners manage vacancies" ON public.company_vacancies;
CREATE POLICY "Vacancies are managed through recruitment RPC" ON public.company_vacancies FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Vacancy updates are managed through recruitment RPC" ON public.company_vacancies FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Vacancy deletes are not client managed" ON public.company_vacancies FOR DELETE TO authenticated USING (false);
