-- Finance backlog A3: make player-facing booking balances agree with the
-- canonical band treasury while legacy recording/gig surfaces are migrated.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_band_balance_projection_from_treasury()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_band_id uuid;
  v_primary public.band_treasuries;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_band_id := OLD.band_id;
  ELSE
    v_band_id := NEW.band_id;
  END IF;

  SELECT * INTO v_primary
  FROM public.band_treasuries
  WHERE band_id = v_band_id
  ORDER BY is_primary DESC, created_at ASC
  LIMIT 1;

  -- The compatibility projection deliberately reflects spendable funds rather
  -- than gross treasury cash so old booking screens cannot over-promise money
  -- that is already reserved.
  UPDATE public.bands
  SET band_balance = COALESCE((
    (v_primary.balance_minor - v_primary.reserved_balance_minor) / 100
  )::integer, 0)
  WHERE id = v_band_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS band_treasury_sync_legacy_balance_projection
  ON public.band_treasuries;

CREATE TRIGGER band_treasury_sync_legacy_balance_projection
AFTER INSERT OR UPDATE OF balance_minor, reserved_balance_minor, is_primary OR DELETE
ON public.band_treasuries
FOR EACH ROW
EXECUTE FUNCTION public.sync_band_balance_projection_from_treasury();

-- Repair the compatibility mirror immediately so legacy recording UI displays
-- the same spendable treasury balance that the atomic booking RPC will debit.
UPDATE public.bands b
SET band_balance = COALESCE((
  SELECT ((t.balance_minor - t.reserved_balance_minor) / 100)::integer
  FROM public.band_treasuries t
  WHERE t.band_id = b.id
  ORDER BY t.is_primary DESC, t.created_at ASC
  LIMIT 1
), 0);

-- Explicit recovery helper used by finance/support surfaces. It creates a zero
-- treasury only for active members of the band; funding remains a separate,
-- explicit action and no money is manufactured.
CREATE OR REPLACE FUNCTION public.ensure_my_band_treasury(p_band_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile_id uuid := public._caller_profile_id();
  v_treasury public.band_treasuries;
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_profile_required';
  END IF;

  IF NOT public._band_active_member(p_band_id, v_profile_id) THEN
    RAISE EXCEPTION 'not_band_member';
  END IF;

  SELECT * INTO v_treasury
  FROM public.band_treasuries
  WHERE band_id = p_band_id
  ORDER BY is_primary DESC, created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_treasury.id IS NULL THEN
    INSERT INTO public.band_treasuries (
      band_id,
      currency_code,
      balance_minor,
      reserved_balance_minor,
      is_primary
    ) VALUES (
      p_band_id,
      'USD',
      0,
      0,
      true
    )
    RETURNING * INTO v_treasury;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'treasuryId', v_treasury.id,
    'currencyCode', v_treasury.currency_code,
    'balanceMinor', v_treasury.balance_minor,
    'reservedBalanceMinor', v_treasury.reserved_balance_minor,
    'availableBalanceMinor', v_treasury.balance_minor - v_treasury.reserved_balance_minor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_band_treasury(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_band_treasury(uuid) TO authenticated;

COMMIT;
