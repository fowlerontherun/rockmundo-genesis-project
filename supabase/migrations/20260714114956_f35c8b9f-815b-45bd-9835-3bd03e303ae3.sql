
CREATE OR REPLACE FUNCTION public.link_label_to_company(p_label_id uuid, p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_label_owner uuid;
  v_company_owner uuid;
  v_current_company uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id, company_id INTO v_label_owner, v_current_company
  FROM public.labels WHERE id = p_label_id;

  IF v_label_owner IS NULL THEN
    RAISE EXCEPTION 'Label not found';
  END IF;

  IF v_current_company IS NOT NULL THEN
    RAISE EXCEPTION 'Label is already linked to a company';
  END IF;

  -- Verify label owner matches an active profile of the caller
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_label_owner AND p.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'You do not own this label';
  END IF;

  -- Verify caller owns the company
  SELECT owner_id INTO v_company_owner FROM public.companies WHERE id = p_company_id;
  IF v_company_owner IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_company_owner AND p.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'You do not own this company';
  END IF;

  UPDATE public.labels SET company_id = p_company_id WHERE id = p_label_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_label_to_company(uuid, uuid) TO authenticated;
