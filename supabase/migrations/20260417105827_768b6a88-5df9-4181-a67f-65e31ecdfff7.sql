CREATE OR REPLACE FUNCTION public.donate_to_party(p_party_id uuid, p_amount bigint, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id UUID;
  v_cash NUMERIC;
  v_dollars NUMERIC;
  v_donation_id UUID;
  v_is_member BOOLEAN;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be positive';
  END IF;

  -- p_amount is in cents; profiles.cash is stored in dollars
  v_dollars := p_amount::numeric / 100.0;

  SELECT id, COALESCE(cash, 0) INTO v_profile_id, v_cash
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'No active profile';
  END IF;

  IF v_cash < v_dollars THEN
    RAISE EXCEPTION 'Insufficient cash (have $%, need $%)', v_cash, v_dollars;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.party_memberships
    WHERE party_id = p_party_id AND profile_id = v_profile_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Only party members may donate to the treasury';
  END IF;

  UPDATE public.profiles
  SET cash = cash - v_dollars
  WHERE id = v_profile_id;

  UPDATE public.political_parties
  SET treasury_balance = treasury_balance + p_amount
  WHERE id = p_party_id;

  INSERT INTO public.party_donations (party_id, donor_profile_id, amount, note)
  VALUES (p_party_id, v_profile_id, p_amount, p_note)
  RETURNING id INTO v_donation_id;

  RETURN v_donation_id;
END;
$function$;