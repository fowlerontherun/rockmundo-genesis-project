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
  v_band_id := COALESCE(NEW.band_id, OLD.band_id);

  SELECT * INTO v_primary
  FROM public.band_treasuries
  WHERE band_id = v_band_id
  ORDER BY is_primary DESC, created_at ASC
  LIMIT 1;

  UPDATE public.bands
  SET band_balance = COALESCE((v_primary.balance_minor / 100)::integer, 0)
  WHERE id = v_band_id;

  RETURN COALESCE(NEW, OLD);
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
-- the same current treasury balance that the atomic booking RPC will debit.
UPDATE public.bands b
SET band_balance = COALESCE((x.balance_minor / 100)::integer, 0)
FROM LATERAL (
  SELECT t.balance_minor
  FROM public.band_treasuries t
  WHERE t.band_id = b.id
  ORDER BY t.is_primary DESC, t.created_at ASC
  LIMIT 1
) x;

-- Bands without a treasury must not retain a stale positive compatibility value.
UPDATE public.bands b
SET band_balance = 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.band_treasuries t WHERE t.band_id = b.id
);

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
