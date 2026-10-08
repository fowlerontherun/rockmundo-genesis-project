-- Keep the legacy player cash projection and the canonical personal account aligned.
-- A number of older game systems still award/deduct whole-unit profiles.cash while
-- Festival, company and band funding correctly consult financial_accounts in minor
-- units.  Without this bridge those screens can report no funds even when the
-- player's wallet visibly contains cash.

CREATE OR REPLACE FUNCTION public.sync_profile_cash_financial_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_minor bigint := round(coalesce(NEW.cash, 0)::numeric * 100)::bigint;
BEGIN
  IF v_balance_minor < 0 THEN
    RAISE EXCEPTION 'player cash cannot be negative';
  END IF;

  INSERT INTO public.financial_accounts(
    owner_type,
    owner_id,
    account_name,
    current_balance_minor,
    default_currency_code,
    is_primary,
    metadata
  )
  VALUES (
    'player',
    NEW.id,
    'Personal cash',
    v_balance_minor,
    'USD',
    true,
    jsonb_build_object('profilesCashRole', 'compatibility_projection')
  )
  ON CONFLICT (owner_type, owner_id) WHERE is_primary AND owner_id IS NOT NULL
  DO UPDATE SET
    current_balance_minor = greatest(
      EXCLUDED.current_balance_minor,
      public.financial_accounts.reserved_balance_minor
    ),
    updated_at = timezone('utc', now()),
    metadata = public.financial_accounts.metadata
      || jsonb_build_object('profilesCashRole', 'compatibility_projection');

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_cash_financial_account ON public.profiles;
CREATE TRIGGER trg_sync_profile_cash_financial_account
AFTER INSERT OR UPDATE OF cash ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_cash_financial_account();

-- Repair existing players before the trigger takes over future writes.  The
-- compatibility value is used deliberately because it is what players see in
-- the wallet and what the remaining legacy earning/cost systems update.
INSERT INTO public.financial_accounts(
  owner_type,
  owner_id,
  account_name,
  current_balance_minor,
  default_currency_code,
  is_primary,
  metadata
)
SELECT
  'player',
  p.id,
  'Personal cash',
  round(coalesce(p.cash, 0)::numeric * 100)::bigint,
  'USD',
  true,
  jsonb_build_object('profilesCashRole', 'compatibility_projection')
FROM public.profiles p
ON CONFLICT (owner_type, owner_id) WHERE is_primary AND owner_id IS NOT NULL
DO UPDATE SET
  current_balance_minor = greatest(
    EXCLUDED.current_balance_minor,
    public.financial_accounts.reserved_balance_minor
  ),
  updated_at = timezone('utc', now()),
  metadata = public.financial_accounts.metadata
    || jsonb_build_object('profilesCashRole', 'compatibility_projection');

REVOKE ALL ON FUNCTION public.sync_profile_cash_financial_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_cash_financial_account() TO service_role;

-- Company management still exposes companies.balance and applies several legacy
-- operating costs there. Mirror those writes as well so affordability and
-- Festival planning read the same company money that the player sees.
CREATE OR REPLACE FUNCTION public.sync_company_balance_financial_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance_minor bigint := round(coalesce(NEW.balance, 0)::numeric * 100)::bigint;
BEGIN
  IF v_balance_minor < 0 THEN
    -- Legacy company gameplay permits an overdraft. The canonical account cannot
    -- be negative, so expose zero rather than an invented positive balance.
    v_balance_minor := 0;
  END IF;

  INSERT INTO public.financial_accounts(
    owner_type, owner_id, account_name, current_balance_minor,
    default_currency_code, is_primary, metadata
  ) VALUES (
    'company', NEW.id, 'Company operating account', v_balance_minor,
    'USD', true, jsonb_build_object('companiesBalanceRole', 'compatibility_projection')
  )
  ON CONFLICT (owner_type, owner_id) WHERE is_primary AND owner_id IS NOT NULL
  DO UPDATE SET
    current_balance_minor = greatest(
      EXCLUDED.current_balance_minor,
      public.financial_accounts.reserved_balance_minor
    ),
    updated_at = timezone('utc', now()),
    metadata = public.financial_accounts.metadata
      || jsonb_build_object('companiesBalanceRole', 'compatibility_projection');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_company_balance_financial_account ON public.companies;
CREATE TRIGGER trg_sync_company_balance_financial_account
AFTER INSERT OR UPDATE OF balance ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.sync_company_balance_financial_account();

INSERT INTO public.financial_accounts(
  owner_type, owner_id, account_name, current_balance_minor,
  default_currency_code, is_primary, metadata
)
SELECT
  'company', c.id, 'Company operating account',
  greatest(0, round(coalesce(c.balance, 0)::numeric * 100)::bigint),
  'USD', true, jsonb_build_object('companiesBalanceRole', 'compatibility_projection')
FROM public.companies c
ON CONFLICT (owner_type, owner_id) WHERE is_primary AND owner_id IS NOT NULL
DO UPDATE SET
  current_balance_minor = greatest(
    EXCLUDED.current_balance_minor,
    public.financial_accounts.reserved_balance_minor
  ),
  updated_at = timezone('utc', now()),
  metadata = public.financial_accounts.metadata
    || jsonb_build_object('companiesBalanceRole', 'compatibility_projection');

REVOKE ALL ON FUNCTION public.sync_company_balance_financial_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_company_balance_financial_account() TO service_role;

NOTIFY pgrst, 'reload schema';
