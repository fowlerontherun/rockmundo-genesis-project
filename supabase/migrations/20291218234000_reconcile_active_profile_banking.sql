-- Keep the legacy banking facade and the canonical finance model on the same
-- character.  The facade previously resolved an arbitrary profile belonging
-- to auth.uid() when current_profile_id() was unavailable.  Multi-character
-- users could therefore see (and debit) a different character's wallet while
-- the Financial Command Center used the selected active profile.

CREATE OR REPLACE FUNCTION public._caller_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_active_player_profile_id();
$$;

REVOKE EXECUTE ON FUNCTION public._caller_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._caller_profile_id() TO authenticated, service_role;

-- Some deployed databases received the temporary profile_id banking facade.
-- Reconcile those rows into the canonical owner columns so that the band
-- contribution RPCs can discover accounts opened through that facade.  The
-- conditional block remains safe on clean databases, where profile_id was
-- never part of the canonical bank_accounts table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bank_accounts'
      AND column_name = 'profile_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.bank_accounts
      SET owner_type = 'player'::public.financial_owner_type,
          owner_id = profile_id
      WHERE profile_id IS NOT NULL
        AND (owner_type IS DISTINCT FROM 'player'::public.financial_owner_type
             OR owner_id IS DISTINCT FROM profile_id)
    $sql$;

    EXECUTE $sql$
      UPDATE public.financial_accounts fa
      SET owner_type = 'player'::public.financial_owner_type,
          owner_id = ba.profile_id
      FROM public.bank_accounts ba
      WHERE ba.linked_finance_account_id = fa.id
        AND ba.profile_id IS NOT NULL
        AND (fa.owner_type IS DISTINCT FROM 'player'::public.financial_owner_type
             OR fa.owner_id IS DISTINCT FROM ba.profile_id)
    $sql$;
  END IF;
END $$;

-- Reapply the eligibility reader after ownership reconciliation.  This is the
-- JSON contract consumed by BandFinancesTab (rather than the temporary SETOF
-- contract introduced by the legacy facade migration).
CREATE OR REPLACE FUNCTION public.get_my_eligible_band_contribution_accounts(
  p_band_id uuid,
  p_currency_code char(3) DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := public.current_active_player_profile_id();
  currency char(3) := p_currency_code;
  personal_count integer := 0;
  eligible_count integer := 0;
  mismatch_count integer := 0;
  accounts jsonb := '[]'::jsonb;
BEGIN
  IF pid IS NULL THEN
    RETURN jsonb_build_object('status','profile_missing','accounts',accounts,'message','An active player profile is required.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id = p_band_id) THEN
    RETURN jsonb_build_object('status','band_missing','accounts',accounts,'message','Band not found.');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.band_members
    WHERE band_id = p_band_id AND profile_id = pid
      AND COALESCE(member_status, 'active') = 'active'
  ) THEN
    RETURN jsonb_build_object('status','not_band_member','accounts',accounts,'message','Active band membership is required.');
  END IF;

  currency := COALESCE(currency, (
    SELECT COALESCE(fa.currency_code, fa.default_currency_code)
    FROM public.financial_accounts fa
    WHERE fa.owner_type = 'band' AND fa.owner_id = p_band_id
      AND fa.account_status = 'active'
      AND fa.metadata->>'account_role' = 'band_treasury'
    ORDER BY fa.is_primary DESC, fa.created_at
    LIMIT 1
  ), 'GBP'::char(3));

  SELECT count(*) INTO personal_count
  FROM public.bank_accounts ba
  WHERE ba.owner_type = 'player' AND ba.owner_id = pid;

  SELECT count(*) INTO mismatch_count
  FROM public.bank_accounts ba
  WHERE ba.owner_type = 'player' AND ba.owner_id = pid
    AND ba.status = 'active' AND ba.currency_code <> currency;

  WITH candidates AS (
    SELECT ba.*, fa.current_balance_minor, fa.available_balance_minor,
           fa.is_primary, bp.brand_name,
           public.is_bank_account_eligible_for_outgoing_payment(ba.id, NULL, currency) AS eligibility
    FROM public.bank_accounts ba
    JOIN public.financial_accounts fa ON fa.id = ba.linked_finance_account_id
    LEFT JOIN public.banking_providers bp ON bp.id = ba.provider_id
    WHERE ba.owner_type = 'player' AND ba.owner_id = pid
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', id,
           'displayName', COALESCE(NULLIF(metadata->>'display_name',''), initcap(replace(account_type::text,'_',' ')) || ' Account'),
           'providerName', COALESCE(brand_name,'Bank account'),
           'accountType', account_type,
           'maskedAccountNumber', COALESCE(NULLIF(metadata->>'masked_account_number',''), NULLIF(metadata->>'account_mask',''), '•••• ' || right(id::text,4)),
           'currencyCode', currency_code,
           'currentBalanceMinor', current_balance_minor,
           'availableBalanceMinor', available_balance_minor,
           'isPrimary', COALESCE(is_primary,false),
           'eligible', (eligibility->>'eligible')::boolean,
           'ineligibleReason', eligibility->>'reason'
         ) ORDER BY COALESCE(is_primary,false) DESC, opened_at NULLS LAST, created_at)
         FILTER (WHERE (eligibility->>'eligible')::boolean), '[]'::jsonb),
         count(*) FILTER (WHERE (eligibility->>'eligible')::boolean)
  INTO accounts, eligible_count
  FROM candidates;

  RETURN jsonb_build_object(
    'status', CASE
      WHEN personal_count = 0 THEN 'no_personal_accounts'
      WHEN eligible_count = 0 AND mismatch_count > 0 THEN 'currency_mismatch'
      WHEN eligible_count = 0 THEN 'no_eligible_accounts'
      ELSE 'ok'
    END,
    'accounts', accounts,
    'message', CASE WHEN personal_count = 0 THEN 'No personal bank accounts were found for the active character.' ELSE NULL END
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid,char(3)) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid,char(3)) TO authenticated, service_role;
