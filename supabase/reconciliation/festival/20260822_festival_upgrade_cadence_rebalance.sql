-- Production parity for the 2026-08-22 Festival upgrade cadence rebalance.
--
-- Production still exposes the inherited `_festival_upgrade_window(uuid)` helper,
-- while the future canonical v2 chain also exposes
-- `_festival_upgrade_purchase_window(uuid,timestamptz)`. Keep both final contracts
-- on the same 20 granular purchases / rolling 30 days rule.

CREATE OR REPLACE FUNCTION public._festival_upgrade_window(p_festival_company_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH recent AS (
    SELECT completed_at
    FROM public.festival_upgrade_purchase_operations
    WHERE festival_company_id = p_festival_company_id
      AND status = 'succeeded'
      AND completed_at > now() - interval '30 days'
  ), x AS (
    SELECT count(*)::int AS used, min(completed_at) AS oldest
    FROM recent
  )
  SELECT jsonb_build_object(
    'limit', 20,
    'used', least(used, 20),
    'remaining', greatest(0, 20 - used),
    'windowDays', 30,
    'serverNow', now(),
    'nextAvailableAt', CASE
      WHEN used >= 20 THEN oldest + interval '30 days'
      ELSE NULL
    END
  )
  FROM x
$function$;

CREATE OR REPLACE FUNCTION public._festival_upgrade_purchase_window(
  c uuid,
  clock_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH recent AS (
    SELECT completed_at
    FROM public.festival_upgrade_purchase_operations
    WHERE festival_company_id = c
      AND status = 'succeeded'
      AND financial_transaction_id IS NOT NULL
      AND completed_at > clock_at - interval '30 days'
  ), x AS (
    SELECT count(*)::int AS used, min(completed_at) AS oldest
    FROM recent
  )
  SELECT jsonb_build_object(
    'limit', 20,
    'used', least(used, 20),
    'remaining', greatest(0, 20 - used),
    'windowDays', 30,
    'serverNow', clock_at,
    'nextAvailableAt', CASE
      WHEN used >= 20 THEN oldest + interval '30 days'
      ELSE NULL
    END
  )
  FROM x
$$;
