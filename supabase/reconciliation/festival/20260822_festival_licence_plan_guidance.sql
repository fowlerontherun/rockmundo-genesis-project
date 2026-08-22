-- Production parity for actionable annual Festival Plan licence blockers.
-- Run only after the inherited 2029 Festival schema has bootstrapped.

CREATE OR REPLACE FUNCTION public._festival_annual_plan_blockers(
  p_festival_company_id uuid,
  p_edition public.festival_editions_v2
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH licence AS (
  SELECT t.max_attendance,t.max_days,t.max_stages,t.max_acts_per_day
  FROM public.festival_company_licences l
  JOIN public.festival_licence_tiers t ON t.key=l.tier_key
  WHERE l.festival_company_id=p_festival_company_id
    AND l.status='active'
    AND coalesce(l.valid_from,'-infinity'::timestamptz)<=now()
    AND coalesce(l.valid_until,'infinity'::timestamptz)>now()
  ORDER BY t.rank DESC
  LIMIT 1
), blockers AS (
  SELECT x
  FROM licence l
  CROSS JOIN LATERAL (VALUES
    (CASE WHEN p_edition.starts_on IS NULL THEN jsonb_build_object('code','festival_dates_required','message','Choose the Festival start date and duration.') END),
    (CASE WHEN p_edition.city_id IS NULL THEN jsonb_build_object('code','festival_city_required','message','Choose the Festival city.') END),
    (CASE WHEN p_edition.site_type IS NULL THEN jsonb_build_object('code','festival_site_style_required','message','Choose the broad site style.') END),
    (CASE WHEN p_edition.festival_scale IS NULL THEN jsonb_build_object('code','festival_scale_required','message','Choose the Festival size.') END),
    (CASE WHEN p_edition.vibe IS NULL THEN jsonb_build_object('code','festival_vibe_required','message','Choose the Festival vibe.') END),
    (CASE WHEN p_edition.marketing_emphasis IS NULL THEN jsonb_build_object('code','festival_marketing_required','message','Choose the marketing emphasis.') END),
    (CASE WHEN l.max_attendance IS NOT NULL AND coalesce(p_edition.expected_capacity,0)>l.max_attendance THEN jsonb_build_object('code','festival_licence_capacity_exceeded','message','This Festival is larger than your active licence allows. Reduce Festival size or open Upgrades & licence to progress the company licence.') END),
    (CASE WHEN l.max_days IS NOT NULL AND coalesce(p_edition.duration_days,0)>l.max_days THEN jsonb_build_object('code','festival_licence_duration_exceeded','message','This Festival is longer than your active licence allows. Reduce the duration or open Upgrades & licence to progress the company licence.') END)
  ) candidate(x)
  WHERE x IS NOT NULL
  UNION ALL
  SELECT jsonb_build_object('code','festival_licence_required','message','The Festival company needs an active licence before launch. Open Upgrades & licence to apply for one.')
  WHERE NOT EXISTS(SELECT 1 FROM licence)
)
SELECT coalesce(jsonb_agg(x),'[]'::jsonb)
FROM blockers
$function$;
