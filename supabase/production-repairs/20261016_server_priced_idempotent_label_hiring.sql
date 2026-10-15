-- Production-compatible replacement for 20261012225000 label-hire RPC.
-- Contract: p_request_id is a required stable UUID supplied once per user intent.
-- Staff starting skill and salary are sourced only from the database. All inserts/debits commit atomically.
CREATE TABLE IF NOT EXISTS public.label_staff_hire_requests (
  actor_user_id uuid NOT NULL,
  request_id uuid NOT NULL,
  label_id uuid NOT NULL REFERENCES public.labels(id),
  staff_id uuid NOT NULL REFERENCES public.label_staff(id),
  employee_name text NOT NULL,
  employee_role text NOT NULL,
  specialty_genre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(actor_user_id, request_id)
);
ALTER TABLE public.label_staff_hire_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.label_staff_hire_requests FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hire_label_staff_atomic(
  p_label_id uuid,
  p_name text,
  p_role text,
  p_skill_level numeric,
  p_specialty_genre text,
  p_salary_monthly numeric,
  p_request_id uuid
)
RETURNS public.label_staff
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, pg_temp
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_specialty text := nullif(btrim(coalesce(p_specialty_genre, '')), '');
  v_cost numeric;
  v_company_id uuid;
  v_existing public.label_staff_hire_requests%ROWTYPE;
  v_hired public.label_staff%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'authenticated_hire_request_id_required';
  END IF;
  IF char_length(v_name) NOT BETWEEN 2 AND 120
    OR char_length(coalesce(v_specialty,'')) > 120 THEN
    RAISE EXCEPTION 'invalid_label_staff_name_or_specialty';
  END IF;

  -- The client supplied numeric values are compatibility inputs only.
  -- They must never influence the price or power of the hired staff.
  v_cost := CASE p_role
    WHEN 'a_and_r' THEN 4000
    WHEN 'marketing' THEN 3500
    WHEN 'promoter' THEN 3000
    WHEN 'accountant' THEN 3500
    WHEN 'legal' THEN 5000
    WHEN 'producer' THEN 4500
    WHEN 'manager' THEN 3500
    ELSE NULL
  END;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'invalid_label_staff_role'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || p_request_id::text,0));
  SELECT * INTO v_existing FROM public.label_staff_hire_requests
  WHERE actor_user_id=v_actor AND request_id=p_request_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.label_id IS DISTINCT FROM p_label_id
      OR v_existing.employee_name IS DISTINCT FROM v_name
      OR v_existing.employee_role IS DISTINCT FROM p_role
      OR v_existing.specialty_genre IS DISTINCT FROM v_specialty THEN
      RAISE EXCEPTION 'label_hire_idempotency_conflict';
    END IF;
    SELECT * INTO v_hired FROM public.label_staff WHERE id=v_existing.staff_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'label_hire_staff_missing'; END IF;
    RETURN v_hired;
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.labels WHERE id=p_label_id FOR UPDATE;
  IF NOT FOUND OR v_company_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id=v_company_id AND owner_id=v_actor
  ) THEN RAISE EXCEPTION 'label_company_owner_required'; END IF;

  PERFORM public.deduct_company_balance(
    v_company_id, v_cost, 'Hire label employee: ' || v_name,
    'staff', 'label-staff-' || p_request_id::text
  );
  INSERT INTO public.label_staff(label_id,name,role,skill_level,specialty_genre,salary_monthly)
  VALUES (p_label_id,v_name,p_role,1,v_specialty,v_cost)
  RETURNING * INTO v_hired;
  INSERT INTO public.label_staff_hire_requests(
    actor_user_id,request_id,label_id,staff_id,employee_name,employee_role,specialty_genre
  ) VALUES (v_actor,p_request_id,p_label_id,v_hired.id,v_name,p_role,v_specialty);
  RETURN v_hired;
END
$fn$;

REVOKE ALL ON FUNCTION public.hire_label_staff_atomic(uuid,text,text,numeric,text,numeric,uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.hire_label_staff_atomic(uuid,text,text,numeric,text,numeric,uuid)
TO authenticated;
