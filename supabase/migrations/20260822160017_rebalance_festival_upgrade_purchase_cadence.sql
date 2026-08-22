-- Rebalance Festival upgrade cadence after catalogue v2 expanded each historical
-- milestone into ten granular levels. The original 2 purchases / 30 days limit
-- became ten times slower in practice once 5 levels became 50.
--
-- Preserve the original long-term milestone pace by allowing 20 granular level
-- purchases per rolling 30 days. Existing purchases remain counted; no ownership,
-- prices, construction, upkeep, licence requirements, or history are rewritten.

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
