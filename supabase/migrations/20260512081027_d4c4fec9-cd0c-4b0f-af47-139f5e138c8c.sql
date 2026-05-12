CREATE OR REPLACE FUNCTION public.credit_city_treasury(
  p_city_id uuid,
  p_amount numeric,
  p_type text,
  p_description text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount_int integer;
BEGIN
  IF p_city_id IS NULL OR p_amount IS NULL OR p_amount = 0 THEN
    RETURN;
  END IF;

  v_amount_int := GREATEST(-2147483647, LEAST(2147483647, ROUND(p_amount)::integer));

  INSERT INTO public.city_treasury (city_id, balance, total_tax_collected)
  VALUES (
    p_city_id,
    v_amount_int,
    GREATEST(v_amount_int, 0)
  )
  ON CONFLICT (city_id) DO UPDATE
  SET balance = public.city_treasury.balance + EXCLUDED.balance,
      total_tax_collected = public.city_treasury.total_tax_collected + GREATEST(v_amount_int, 0),
      updated_at = now();

  INSERT INTO public.city_treasury_ledger (city_id, amount, type, description, reference_id)
  VALUES (p_city_id, v_amount_int, COALESCE(p_type, 'tax'), p_description, p_reference_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_city_treasury(uuid, numeric, text, text, uuid) TO authenticated, service_role;

-- Ensure unique constraint on city_treasury.city_id for the upsert above
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'city_treasury_city_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.city_treasury ADD CONSTRAINT city_treasury_city_id_key UNIQUE (city_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END $$;