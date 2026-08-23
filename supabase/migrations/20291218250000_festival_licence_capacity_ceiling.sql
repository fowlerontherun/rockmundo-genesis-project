-- Festival licence limits are use-time ceilings, not infrastructure purchase gates.
-- Companies may build ahead of their current licence, but attendance/ticketing remains
-- capped until the licence is upgraded.

UPDATE public.festival_licence_tiers
SET max_days = 2
WHERE key = 'community';

-- Preserve the historical tier threshold as usage metadata, then make every upgrade
-- purchasable from the entry licence. Capacity is constrained separately at use time.
ALTER TABLE public.festival_upgrade_levels
  ADD COLUMN IF NOT EXISTS usage_licence_tier smallint;

UPDATE public.festival_upgrade_levels
SET usage_licence_tier = coalesce(usage_licence_tier, minimum_licence_tier),
    minimum_licence_tier = 1
WHERE minimum_licence_tier > 1
   OR usage_licence_tier IS NULL;

CREATE OR REPLACE FUNCTION public._festival_annual_plan_potential_capacity(
  p_festival_company_id uuid,
  p_scale text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT round(
    scale.minimum_site_capacity
    + (scale.maximum_site_capacity - scale.minimum_site_capacity)
      * public._festival_annual_plan_upgrade_progress(
          p_festival_company_id,
          ARRAY['site_infrastructure','stages_production','audience_facilities','transport_access']
        )
  )::integer
  FROM public.festival_scale_catalogue scale
  WHERE scale.key = p_scale
    AND scale.active;
$$;

CREATE OR REPLACE FUNCTION public._festival_active_licence_capacity(
  p_festival_company_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tier.max_attendance
  FROM public.festival_company_licences licence
  JOIN public.festival_licence_tiers tier ON tier.key = licence.tier_key
  WHERE licence.festival_company_id = p_festival_company_id
    AND licence.status = 'active'
    AND coalesce(licence.valid_from, '-infinity'::timestamptz) <= p_at
    AND coalesce(licence.valid_until, 'infinity'::timestamptz) > p_at
  ORDER BY tier.rank DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._festival_annual_plan_capacity(
  p_festival_company_id uuid,
  p_scale text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH capacity AS (
    SELECT
      public._festival_annual_plan_potential_capacity(p_festival_company_id, p_scale) AS potential_capacity,
      public._festival_active_licence_capacity(p_festival_company_id, now()) AS licence_capacity
  )
  SELECT CASE
    WHEN potential_capacity IS NULL THEN NULL
    WHEN licence_capacity IS NULL THEN potential_capacity
    ELSE least(potential_capacity, licence_capacity)
  END
  FROM capacity;
$$;

-- Licence threshold is now informational for upgrades. The quote remains eligible when
-- other requirements pass, while telling the player that the extra Festival capacity is
-- waiting for a higher licence.
CREATE OR REPLACE FUNCTION public.get_festival_upgrade_purchase_preview(
  p_festival_company_id uuid,
  p_category_key text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  state jsonb;
  category jsonb;
  eligibility jsonb;
  usage_tier integer := 1;
  licence_rank integer := 0;
  implications jsonb := '[]'::jsonb;
BEGIN
  state := public.get_festival_company_upgrades(p_festival_company_id);
  SELECT item INTO category
  FROM jsonb_array_elements(state->'categories') item
  WHERE item->>'key' = p_category_key;

  IF category IS NULL THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_CATEGORY_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  eligibility := public._festival_upgrade_eligibility(
    p_festival_company_id,
    p_category_key,
    (category->>'nextLevel')::integer,
    (state->>'catalogueVersion')::integer,
    (state->>'companyVersion')::integer,
    now()
  );

  IF category->>'nextLevel' IS NOT NULL THEN
    SELECT coalesce(level.usage_licence_tier, level.minimum_licence_tier, 1)
    INTO usage_tier
    FROM public.festival_upgrade_levels level
    WHERE level.catalogue_version = (state->>'catalogueVersion')::integer
      AND level.category_key = p_category_key
      AND level.level = (category->>'nextLevel')::integer;

    SELECT coalesce(max(tier.rank), 0)
    INTO licence_rank
    FROM public.festival_company_licences licence
    JOIN public.festival_licence_tiers tier ON tier.key = licence.tier_key
    WHERE licence.festival_company_id = p_festival_company_id
      AND licence.status = 'active'
      AND coalesce(licence.valid_from, '-infinity'::timestamptz) <= now()
      AND coalesce(licence.valid_until, 'infinity'::timestamptz) > now();

    IF usage_tier > licence_rank THEN
      implications := implications || jsonb_build_array(
        'You can build this upgrade now, but Festival attendance remains capped by your active licence until the licence is upgraded.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'category', category,
    'catalogueVersion', state->'catalogueVersion',
    'companyVersion', state->'companyVersion',
    'purchaseWindow', eligibility->'purchaseWindow',
    'balanceMinor', state->'availableBalanceMinor',
    'remainingBalanceMinor', greatest(
      0,
      (state->>'availableBalanceMinor')::bigint
        - coalesce((category->>'nextCostMinor')::bigint, 0)
    ),
    'eligible', eligibility->'eligible',
    'reasonCodes', eligibility->'reasonCodes',
    'licenceImplications', implications
  );
END;
$$;

-- Recalculate editable annual editions so downstream site/ticket projections inherit
-- the licensed ceiling immediately. The edition trigger rematerialises those projections.
WITH recalculated AS (
  SELECT
    edition.id,
    public._festival_annual_plan_potential_capacity(
      edition.festival_company_id,
      edition.festival_scale
    ) AS potential_capacity,
    public._festival_annual_plan_capacity(
      edition.festival_company_id,
      edition.festival_scale
    ) AS licensed_capacity,
    public._festival_active_licence_capacity(
      edition.festival_company_id,
      now()
    ) AS licence_capacity
  FROM public.festival_editions_v2 edition
  WHERE edition.status NOT IN ('completed', 'cancelled')
    AND edition.locked_at IS NULL
    AND edition.festival_scale IS NOT NULL
)
UPDATE public.festival_editions_v2 edition
SET expected_capacity = recalculated.licensed_capacity,
    estimated_operating_cost_minor = public._festival_annual_plan_cost(
      edition.festival_company_id,
      edition.festival_scale,
      edition.site_type,
      coalesce(edition.environmental_policy, 'standard'),
      coalesce(edition.marketing_emphasis, 'balanced'),
      greatest(1, coalesce(edition.duration_days, 1)),
      recalculated.licensed_capacity
    ),
    planning_effects = coalesce(edition.planning_effects, '{}'::jsonb)
      || jsonb_build_object(
        'capacity', recalculated.licensed_capacity,
        'potentialCapacity', recalculated.potential_capacity,
        'licensedCapacity', recalculated.licensed_capacity,
        'licenceCapacityLimit', recalculated.licence_capacity,
        'capacityRestrictedByLicence',
          recalculated.licence_capacity IS NOT NULL
          AND recalculated.potential_capacity > recalculated.licence_capacity
      ),
    planning_updated_at = now(),
    version = edition.version + 1
FROM recalculated
WHERE edition.id = recalculated.id
  AND recalculated.licensed_capacity IS NOT NULL
  AND edition.site_type IS NOT NULL
  AND (
    edition.expected_capacity IS DISTINCT FROM recalculated.licensed_capacity
    OR coalesce((edition.planning_effects->>'potentialCapacity')::integer, -1)
       IS DISTINCT FROM recalculated.potential_capacity
  );

UPDATE public.festival_editions_v2 edition
SET readiness_score = greatest(
      0,
      100 - jsonb_array_length(
        public._festival_annual_plan_blockers(edition.festival_company_id, edition)
      ) * 25
    ),
    planning_status = CASE
      WHEN jsonb_array_length(
        public._festival_annual_plan_blockers(edition.festival_company_id, edition)
      ) = 0 THEN 'ready'
      ELSE 'in_progress'
    END
WHERE edition.status NOT IN ('completed', 'cancelled')
  AND edition.locked_at IS NULL;
