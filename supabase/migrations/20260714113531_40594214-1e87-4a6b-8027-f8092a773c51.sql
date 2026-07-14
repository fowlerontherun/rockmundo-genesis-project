
CREATE OR REPLACE FUNCTION public.manage_company_vacancy(
  p_action text,
  p_company_id uuid DEFAULT NULL,
  p_vacancy_id uuid DEFAULT NULL,
  p_job_title text DEFAULT NULL,
  p_staff_category text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_positions_available integer DEFAULT 1,
  p_weekly_wage numeric DEFAULT 0,
  p_employment_type text DEFAULT 'full_time',
  p_is_permanent boolean DEFAULT true,
  p_required_skills jsonb DEFAULT '{}'::jsonb,
  p_preferred_skills jsonb DEFAULT '{}'::jsonb,
  p_minimum_skill_levels jsonb DEFAULT '{}'::jsonb,
  p_location_city_id uuid DEFAULT NULL,
  p_expected_activity_level text DEFAULT 'regular',
  p_closes_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_id uuid;
  v_company uuid;
BEGIN
  IF p_action IN ('save_draft','publish') THEN
    IF p_company_id IS NULL THEN
      RAISE EXCEPTION 'company_id required';
    END IF;
    SELECT owner_id INTO v_owner FROM public.companies WHERE id = p_company_id;
    IF v_owner IS NULL OR v_owner <> auth.uid() THEN
      RAISE EXCEPTION 'Not authorised to manage this company';
    END IF;
    IF p_job_title IS NULL OR length(trim(p_job_title)) = 0 THEN
      RAISE EXCEPTION 'Job title required';
    END IF;

    INSERT INTO public.company_vacancies (
      company_id, job_title, description, staff_category, employment_type,
      is_permanent, positions_available, weekly_wage, required_skills,
      preferred_skills, minimum_skill_levels, location_city_id,
      expected_activity_level, closes_at, status
    ) VALUES (
      p_company_id, p_job_title, p_description, coalesce(p_staff_category,'general'),
      coalesce(p_employment_type,'full_time'), coalesce(p_is_permanent,true),
      greatest(1, coalesce(p_positions_available,1)), coalesce(p_weekly_wage,0),
      coalesce(p_required_skills,'{}'::jsonb), coalesce(p_preferred_skills,'{}'::jsonb),
      coalesce(p_minimum_skill_levels,'{}'::jsonb), p_location_city_id,
      coalesce(p_expected_activity_level,'regular'), p_closes_at,
      CASE WHEN p_action = 'publish' THEN 'open' ELSE 'draft' END
    ) RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  IF p_vacancy_id IS NULL THEN
    RAISE EXCEPTION 'vacancy_id required';
  END IF;
  SELECT c.owner_id, v.company_id INTO v_owner, v_company
  FROM public.company_vacancies v
  JOIN public.companies c ON c.id = v.company_id
  WHERE v.id = p_vacancy_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF p_action = 'close' THEN
    UPDATE public.company_vacancies SET status='closed', updated_at=now() WHERE id = p_vacancy_id;
  ELSIF p_action = 'cancel' THEN
    UPDATE public.company_vacancies SET status='cancelled', updated_at=now() WHERE id = p_vacancy_id;
  ELSIF p_action = 'reopen' THEN
    UPDATE public.company_vacancies SET status='open', updated_at=now() WHERE id = p_vacancy_id;
  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;
  RETURN p_vacancy_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.manage_company_vacancy(text,uuid,uuid,text,text,text,integer,numeric,text,boolean,jsonb,jsonb,jsonb,uuid,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_company_application(
  p_application_id uuid,
  p_action text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT c.owner_id INTO v_owner
  FROM public.company_job_applications a
  JOIN public.company_vacancies v ON v.id = a.vacancy_id
  JOIN public.companies c ON c.id = v.company_id
  WHERE a.id = p_application_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF p_action = 'offer' THEN
    UPDATE public.company_job_applications
      SET status='offered', offer_expires_at = now() + interval '3 days', updated_at=now()
      WHERE id = p_application_id;
  ELSIF p_action = 'reject' THEN
    UPDATE public.company_job_applications
      SET status='rejected', updated_at=now()
      WHERE id = p_application_id;
  ELSE
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_company_application(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_company_employee(
  p_employee_id uuid,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT c.owner_id INTO v_owner
  FROM public.company_employees e
  JOIN public.companies c ON c.id = e.company_id
  WHERE e.id = p_employee_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  UPDATE public.company_employees
    SET status='dismissed', updated_at=now()
    WHERE id = p_employee_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.dismiss_company_employee(uuid,text) TO authenticated;
