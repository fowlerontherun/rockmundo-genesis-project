-- Make company share gifts and paid issuance offers server-authoritative.
-- Free gifts complete immediately. Paid issuance requires explicit buyer acceptance.

CREATE TABLE IF NOT EXISTS public.company_share_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  issuer_user_id uuid NOT NULL,
  issuer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL,
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shares integer NOT NULL CHECK (shares > 0),
  price_per_share numeric NOT NULL DEFAULT 0 CHECK (price_per_share >= 0),
  total_price numeric NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  creation_idempotency_key text NOT NULL,
  creation_hash text NOT NULL,
  creation_result jsonb,
  response_idempotency_key text,
  response_hash text,
  response_result jsonb,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer_user_id, creation_idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_company_share_offers_recipient_status
  ON public.company_share_offers(recipient_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_share_offers_company_status
  ON public.company_share_offers(company_id, status, created_at DESC);

ALTER TABLE public.company_share_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View participating company share offers" ON public.company_share_offers;
CREATE POLICY "View participating company share offers"
ON public.company_share_offers
FOR SELECT
USING (
  issuer_user_id = auth.uid()
  OR recipient_user_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.propose_company_share_issuance(
  p_company_id uuid,
  p_recipient_profile_id uuid,
  p_shares integer,
  p_price_per_share numeric DEFAULT 0,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_company public.companies%ROWTYPE;
  v_recipient public.profiles%ROWTYPE;
  v_offer public.company_share_offers%ROWTYPE;
  v_hash text;
  v_total numeric;
  v_new_owner uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001'; END IF;
  IF p_shares IS NULL OR p_shares <= 0 THEN RAISE EXCEPTION 'shares_must_be_positive' USING ERRCODE = 'P0001'; END IF;
  IF p_price_per_share IS NULL OR p_price_per_share < 0 THEN RAISE EXCEPTION 'invalid_share_price' USING ERRCODE = 'P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = 'P0001';
  END IF;

  v_total := p_shares * p_price_per_share;
  v_hash := encode(digest(concat_ws('|', p_company_id, p_recipient_profile_id, p_shares, p_price_per_share), 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_offer
  FROM public.company_share_offers
  WHERE issuer_user_id = v_user_id
    AND creation_idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    IF v_offer.creation_hash <> v_hash THEN
      RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_offer.creation_result || jsonb_build_object('idempotent', true);
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'company_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_company.owner_id <> v_user_id THEN RAISE EXCEPTION 'company_not_owned' USING ERRCODE = 'P0001'; END IF;
  IF v_company.status <> 'active' OR coalesce(v_company.is_bankrupt, false) THEN
    RAISE EXCEPTION 'company_not_active' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_recipient
  FROM public.profiles
  WHERE id = p_recipient_profile_id
    AND died_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'recipient_profile_not_found' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.company_share_offers(
    company_id,
    issuer_user_id,
    issuer_profile_id,
    recipient_user_id,
    recipient_profile_id,
    shares,
    price_per_share,
    total_price,
    status,
    creation_idempotency_key,
    creation_hash
  ) VALUES (
    v_company.id,
    v_user_id,
    v_profile_id,
    v_recipient.user_id,
    v_recipient.id,
    p_shares,
    p_price_per_share,
    v_total,
    CASE WHEN v_total = 0 THEN 'accepted' ELSE 'pending' END,
    p_idempotency_key,
    v_hash
  ) RETURNING * INTO v_offer;

  IF v_total = 0 THEN
    INSERT INTO public.company_shareholders(company_id, user_id, shares)
    VALUES(v_company.id, v_recipient.user_id, p_shares)
    ON CONFLICT(company_id, user_id)
    DO UPDATE SET shares = public.company_shareholders.shares + EXCLUDED.shares,
                  updated_at = now();

    INSERT INTO public.company_share_transfers(
      company_id,
      from_user_id,
      to_user_id,
      shares,
      price_per_share,
      total_price,
      transfer_type
    ) VALUES (
      v_company.id,
      v_user_id,
      v_recipient.user_id,
      p_shares,
      0,
      0,
      'gift'
    );

    SELECT user_id INTO v_new_owner
    FROM public.company_shareholders
    WHERE company_id = v_company.id
    ORDER BY shares DESC, created_at ASC, user_id ASC
    LIMIT 1;

    UPDATE public.companies
    SET owner_id = v_new_owner,
        updated_at = now()
    WHERE id = v_company.id;

    UPDATE public.company_share_offers
    SET responded_at = now(),
        updated_at = now()
    WHERE id = v_offer.id;
  ELSE
    v_new_owner := v_company.owner_id;
  END IF;

  v_result := jsonb_build_object(
    'offerId', v_offer.id,
    'status', CASE WHEN v_total = 0 THEN 'accepted' ELSE 'pending' END,
    'companyId', v_company.id,
    'recipientProfileId', v_recipient.id,
    'recipientUserId', v_recipient.user_id,
    'shares', p_shares,
    'pricePerShare', p_price_per_share,
    'totalPrice', v_total,
    'companyBalance', v_company.balance,
    'recipientCash', v_recipient.cash,
    'newOwnerId', v_new_owner,
    'financialTransactionId', NULL,
    'idempotent', false
  );

  UPDATE public.company_share_offers
  SET creation_result = v_result,
      response_result = CASE WHEN v_total = 0 THEN v_result ELSE response_result END,
      updated_at = now()
  WHERE id = v_offer.id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_company_share_offer(
  p_offer_id uuid,
  p_accept boolean,
  p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_id uuid := public._caller_profile_id();
  v_offer public.company_share_offers%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_recipient public.profiles%ROWTYPE;
  v_hash text;
  v_new_owner uuid;
  v_financial_tx uuid;
  v_status text;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  IF v_profile_id IS NULL THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE = 'P0001'; END IF;
  IF p_idempotency_key IS NULL OR length(btrim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'idempotency_key_required' USING ERRCODE = 'P0001';
  END IF;

  v_hash := encode(digest(p_offer_id::text || '|' || p_accept::text, 'sha256'), 'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0));

  SELECT * INTO v_offer
  FROM public.company_share_offers
  WHERE id = p_offer_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'share_offer_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_offer.recipient_user_id <> v_user_id THEN RAISE EXCEPTION 'share_offer_not_for_user' USING ERRCODE = 'P0001'; END IF;
  IF v_offer.recipient_profile_id <> v_profile_id THEN RAISE EXCEPTION 'recipient_profile_must_be_active' USING ERRCODE = 'P0001'; END IF;

  IF v_offer.response_idempotency_key IS NOT NULL THEN
    IF v_offer.response_idempotency_key <> p_idempotency_key OR v_offer.response_hash <> v_hash THEN
      RAISE EXCEPTION 'share_offer_already_resolved' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_offer.response_result || jsonb_build_object('idempotent', true);
  END IF;

  IF v_offer.status <> 'pending' THEN RAISE EXCEPTION 'share_offer_not_pending' USING ERRCODE = 'P0001'; END IF;

  IF v_offer.expires_at <= now() THEN
    v_status := 'expired';
    v_result := jsonb_build_object(
      'offerId', v_offer.id,
      'status', v_status,
      'companyId', v_offer.company_id,
      'recipientProfileId', v_offer.recipient_profile_id,
      'recipientUserId', v_offer.recipient_user_id,
      'shares', v_offer.shares,
      'pricePerShare', v_offer.price_per_share,
      'totalPrice', v_offer.total_price,
      'companyBalance', NULL,
      'recipientCash', NULL,
      'newOwnerId', NULL,
      'financialTransactionId', NULL,
      'idempotent', false
    );

    UPDATE public.company_share_offers
    SET status = v_status,
        response_idempotency_key = p_idempotency_key,
        response_hash = v_hash,
        response_result = v_result,
        responded_at = now(),
        updated_at = now()
    WHERE id = v_offer.id;

    RETURN v_result;
  END IF;

  IF NOT p_accept THEN
    v_status := 'declined';
    v_result := jsonb_build_object(
      'offerId', v_offer.id,
      'status', v_status,
      'companyId', v_offer.company_id,
      'recipientProfileId', v_offer.recipient_profile_id,
      'recipientUserId', v_offer.recipient_user_id,
      'shares', v_offer.shares,
      'pricePerShare', v_offer.price_per_share,
      'totalPrice', v_offer.total_price,
      'companyBalance', NULL,
      'recipientCash', NULL,
      'newOwnerId', NULL,
      'financialTransactionId', NULL,
      'idempotent', false
    );

    UPDATE public.company_share_offers
    SET status = v_status,
        response_idempotency_key = p_idempotency_key,
        response_hash = v_hash,
        response_result = v_result,
        responded_at = now(),
        updated_at = now()
    WHERE id = v_offer.id;

    RETURN v_result;
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = v_offer.company_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'company_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_company.owner_id <> v_offer.issuer_user_id THEN
    RAISE EXCEPTION 'share_offer_issuer_no_longer_controls_company' USING ERRCODE = 'P0001';
  END IF;
  IF v_company.status <> 'active' OR coalesce(v_company.is_bankrupt, false) THEN
    RAISE EXCEPTION 'company_not_active' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_recipient
  FROM public.profiles
  WHERE id = v_offer.recipient_profile_id
    AND user_id = v_user_id
    AND died_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'recipient_profile_not_found' USING ERRCODE = 'P0001'; END IF;
  IF coalesce(v_recipient.cash, 0) < v_offer.total_price THEN
    RAISE EXCEPTION 'insufficient_personal_funds' USING ERRCODE = 'P0001';
  END IF;

  SELECT public.finance_transfer(
    'player',
    v_recipient.id,
    'company',
    v_company.id,
    round(v_offer.total_price * 100)::bigint,
    'company_revenue',
    'Company share purchase',
    'company-share-offer:' || v_offer.id::text,
    'company',
    v_company.id,
    v_recipient.id,
    jsonb_build_object('shareOfferId', v_offer.id, 'shares', v_offer.shares)
  ) INTO v_financial_tx;

  UPDATE public.profiles
  SET cash = cash - v_offer.total_price,
      updated_at = now()
  WHERE id = v_recipient.id;

  UPDATE public.companies
  SET balance = balance + v_offer.total_price,
      negative_balance_since = NULL,
      updated_at = now()
  WHERE id = v_company.id;

  INSERT INTO public.company_transactions(
    company_id,
    transaction_type,
    amount,
    description,
    category,
    related_entity_id,
    related_entity_type
  ) VALUES (
    v_company.id,
    'income',
    v_offer.total_price,
    'Share sale (' || v_offer.shares || ' shares)',
    'owner_transfer',
    v_recipient.id,
    'profile'
  );

  INSERT INTO public.company_shareholders(company_id, user_id, shares)
  VALUES(v_company.id, v_recipient.user_id, v_offer.shares)
  ON CONFLICT(company_id, user_id)
  DO UPDATE SET shares = public.company_shareholders.shares + EXCLUDED.shares,
                updated_at = now();

  INSERT INTO public.company_share_transfers(
    company_id,
    from_user_id,
    to_user_id,
    shares,
    price_per_share,
    total_price,
    transfer_type
  ) VALUES (
    v_company.id,
    v_offer.issuer_user_id,
    v_recipient.user_id,
    v_offer.shares,
    v_offer.price_per_share,
    v_offer.total_price,
    'sale'
  );

  SELECT user_id INTO v_new_owner
  FROM public.company_shareholders
  WHERE company_id = v_company.id
  ORDER BY shares DESC, created_at ASC, user_id ASC
  LIMIT 1;

  UPDATE public.companies
  SET owner_id = v_new_owner,
      updated_at = now()
  WHERE id = v_company.id;

  v_status := 'accepted';
  v_result := jsonb_build_object(
    'offerId', v_offer.id,
    'status', v_status,
    'companyId', v_company.id,
    'recipientProfileId', v_recipient.id,
    'recipientUserId', v_recipient.user_id,
    'shares', v_offer.shares,
    'pricePerShare', v_offer.price_per_share,
    'totalPrice', v_offer.total_price,
    'companyBalance', v_company.balance + v_offer.total_price,
    'recipientCash', v_recipient.cash - v_offer.total_price,
    'newOwnerId', v_new_owner,
    'financialTransactionId', v_financial_tx,
    'idempotent', false
  );

  UPDATE public.company_share_offers
  SET status = v_status,
      response_idempotency_key = p_idempotency_key,
      response_hash = v_hash,
      response_result = v_result,
      responded_at = now(),
      updated_at = now()
  WHERE id = v_offer.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.propose_company_share_issuance(uuid, uuid, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.propose_company_share_issuance(uuid, uuid, integer, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public.respond_company_share_offer(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_company_share_offer(uuid, boolean, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
