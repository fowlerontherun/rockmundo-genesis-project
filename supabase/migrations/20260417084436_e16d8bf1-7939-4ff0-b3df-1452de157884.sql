-- Party donations: members fund their party's treasury from personal cash
CREATE TABLE IF NOT EXISTS public.party_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.political_parties(id) ON DELETE CASCADE,
  donor_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_party_donations_party ON public.party_donations(party_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_party_donations_donor ON public.party_donations(donor_profile_id, created_at DESC);

ALTER TABLE public.party_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donations are publicly viewable"
  ON public.party_donations FOR SELECT USING (true);

CREATE POLICY "Donors insert own donations"
  ON public.party_donations FOR INSERT
  WITH CHECK (donor_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- No UPDATE / DELETE policies → table is append-only audit log.

-- Atomic donation RPC
CREATE OR REPLACE FUNCTION public.donate_to_party(
  p_party_id UUID,
  p_amount BIGINT,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_cash BIGINT;
  v_donation_id UUID;
  v_is_member BOOLEAN;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Donation amount must be positive';
  END IF;

  SELECT id, COALESCE(cash, 0) INTO v_profile_id, v_cash
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'No active profile';
  END IF;

  IF v_cash < p_amount THEN
    RAISE EXCEPTION 'Insufficient cash (have %, need %)', v_cash, p_amount;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.party_memberships
    WHERE party_id = p_party_id AND profile_id = v_profile_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'Only party members may donate to the treasury';
  END IF;

  UPDATE public.profiles
  SET cash = cash - p_amount
  WHERE id = v_profile_id;

  UPDATE public.political_parties
  SET treasury_balance = treasury_balance + p_amount
  WHERE id = p_party_id;

  INSERT INTO public.party_donations (party_id, donor_profile_id, amount, note)
  VALUES (p_party_id, v_profile_id, p_amount, p_note)
  RETURNING id INTO v_donation_id;

  RETURN v_donation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.donate_to_party(UUID, BIGINT, TEXT) TO authenticated;