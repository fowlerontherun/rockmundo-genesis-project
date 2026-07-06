
-- Server-side enforcement of storefront hours, days, active flag, and sold-out behavior.
-- Buyers (non-owners) may only read storefronts / inventory / services that are
-- currently visible per is_public, open_days, open_hour..close_hour, is_active,
-- and the storefront's sold_out_behavior policy.

-- ---------- helper: is a storefront open right now? ----------
CREATE OR REPLACE FUNCTION public.is_storefront_open(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sf AS (
    SELECT is_public, open_hour, close_hour, open_days
    FROM public.company_storefront
    WHERE company_id = _company_id
  ), now_parts AS (
    SELECT
      EXTRACT(HOUR FROM (now() AT TIME ZONE 'UTC'))::int AS hr,
      lower(to_char((now() AT TIME ZONE 'UTC'), 'Dy')) AS dow -- 'mon','tue',...
  )
  SELECT
    COALESCE(
      (SELECT
         sf.is_public
         AND np.dow = ANY (sf.open_days)
         AND (
           -- normal window (e.g. 09..21)
           (sf.close_hour > sf.open_hour AND np.hr >= sf.open_hour AND np.hr < sf.close_hour)
           OR
           -- overnight window (e.g. 21..3)
           (sf.close_hour <= sf.open_hour AND (np.hr >= sf.open_hour OR np.hr < sf.close_hour))
           OR
           -- 24h storefront (open_hour = close_hour)
           (sf.open_hour = sf.close_hour)
         )
       FROM sf, now_parts np),
      false
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_storefront_open(uuid) TO anon, authenticated, service_role;

-- ---------- helper: sold-out behavior for a storefront ----------
CREATE OR REPLACE FUNCTION public.storefront_sold_out_behavior(_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sold_out_behavior, 'hide')
  FROM public.company_storefront
  WHERE company_id = _company_id
$$;

GRANT EXECUTE ON FUNCTION public.storefront_sold_out_behavior(uuid) TO anon, authenticated, service_role;

-- ---------- helper: is the caller the company owner? ----------
CREATE OR REPLACE FUNCTION public.is_company_owner(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = _company_id AND c.owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_owner(uuid) TO anon, authenticated, service_role;

-- ---------- tighten SELECT policies ----------
-- company_storefront
DROP POLICY IF EXISTS "Anyone can view storefronts" ON public.company_storefront;
CREATE POLICY "Storefront visible when open or to owner"
ON public.company_storefront
FOR SELECT
USING (
  public.is_company_owner(company_id)
  OR (is_public = true AND public.is_storefront_open(company_id))
);

-- company_inventory
DROP POLICY IF EXISTS "Anyone reads inventory" ON public.company_inventory;
CREATE POLICY "Inventory visible when active, in stock or per sold-out policy"
ON public.company_inventory
FOR SELECT
USING (
  public.is_company_owner(company_id)
  OR (
    is_active = true
    AND public.is_storefront_open(company_id)
    AND (
      stock > 0
      OR public.storefront_sold_out_behavior(company_id) <> 'hide'
    )
  )
);

-- company_services
DROP POLICY IF EXISTS "Anyone reads services" ON public.company_services;
CREATE POLICY "Services visible when active and storefront open"
ON public.company_services
FOR SELECT
USING (
  public.is_company_owner(company_id)
  OR (
    is_active = true
    AND public.is_storefront_open(company_id)
  )
);
