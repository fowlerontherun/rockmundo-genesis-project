
ALTER TABLE public.company_vacancies
  ADD COLUMN IF NOT EXISTS advertised_until timestamptz,
  ADD COLUMN IF NOT EXISTS advertising_daily_spend numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_advertising_spend numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_company_vacancies_advertised_until
  ON public.company_vacancies (advertised_until DESC)
  WHERE advertised_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.advertise_company_vacancy(
  p_vacancy_id uuid,
  p_days integer DEFAULT 7,
  p_daily_spend numeric DEFAULT 100
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_company_id uuid;
  v_balance numeric;
  v_total numeric;
  v_now timestamptz := now();
  v_current_until timestamptz;
  v_new_until timestamptz;
BEGIN
  IF p_vacancy_id IS NULL THEN
    RAISE EXCEPTION 'vacancy_id required';
  END IF;
  IF coalesce(p_days,0) < 1 OR p_days > 60 THEN
    RAISE EXCEPTION 'Days must be between 1 and 60';
  END IF;
  IF coalesce(p_daily_spend,0) < 10 THEN
    RAISE EXCEPTION 'Daily spend must be at least $10';
  END IF;

  SELECT c.owner_id, v.company_id, c.balance, v.advertised_until
    INTO v_owner, v_company_id, v_balance, v_current_until
  FROM public.company_vacancies v
  JOIN public.companies c ON c.id = v.company_id
  WHERE v.id = p_vacancy_id
  FOR UPDATE;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorised to advertise this vacancy';
  END IF;

  v_total := round(p_days::numeric * p_daily_spend::numeric, 2);
  IF coalesce(v_balance,0) < v_total THEN
    RAISE EXCEPTION 'Insufficient company balance ($% required)', v_total;
  END IF;

  IF v_current_until IS NULL OR v_current_until < v_now THEN
    v_new_until := v_now + make_interval(days => p_days);
  ELSE
    v_new_until := v_current_until + make_interval(days => p_days);
  END IF;

  UPDATE public.companies
    SET balance = balance - v_total, updated_at = v_now
    WHERE id = v_company_id;

  UPDATE public.company_vacancies
    SET advertised_until = v_new_until,
        advertising_daily_spend = p_daily_spend,
        total_advertising_spend = coalesce(total_advertising_spend,0) + v_total,
        status = CASE WHEN status = 'draft' THEN 'open' ELSE status END,
        updated_at = v_now
    WHERE id = p_vacancy_id;

  INSERT INTO public.company_transactions (company_id, transaction_type, amount, description, category, created_at)
  VALUES (v_company_id, 'expense', -v_total, 'Vacancy advertising: ' || p_days || ' days @ $' || p_daily_spend || '/day', 'marketing', v_now);

  RETURN p_vacancy_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advertise_company_vacancy(uuid, integer, numeric) TO authenticated;
