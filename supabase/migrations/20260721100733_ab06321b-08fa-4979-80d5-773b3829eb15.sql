
CREATE OR REPLACE FUNCTION public.get_band_treasury_dashboard(p_band_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', 'treasury_missing',
    'canViewBalance', true,
    'canViewDetails', true,
    'primaryCurrencyCode', 'GBP',
    'treasuries', '[]'::jsonb,
    'contributions', '[]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_eligible_band_contribution_accounts(
  p_band_id uuid,
  p_currency_code text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'status', 'no_eligible_accounts',
    'accounts', '[]'::jsonb,
    'message', 'Band treasury accounts are not yet available.'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_band_treasury_dashboard(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_eligible_band_contribution_accounts(uuid, text) TO authenticated, service_role;
