-- Production reconciliation: Festival licence limits are use-time ceilings.
-- Live production migrations:
--   20260823085909 enforce_festival_licence_capacity_caps_v2
--   20260823090510 preserve_festival_upgrade_usage_licence_metadata

UPDATE public.festival_licence_tiers
SET max_days = 2
WHERE key = 'community';

-- Keep the previous licence threshold as usage metadata while removing it as a
-- purchase gate. Existing upgrades may therefore be built ahead of the licence.
ALTER TABLE public.festival_upgrade_levels
  ADD COLUMN IF NOT EXISTS usage_licence_rank smallint;

UPDATE public.festival_upgrade_levels
SET usage_licence_rank = coalesce(usage_licence_rank, minimum_licence_rank),
    minimum_licence_rank = 1
WHERE minimum_licence_rank > 1
   OR usage_licence_rank IS NULL;

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

CREATE OR REPLACE FUNCTION public.get_festival_upgrade_purchase_preview(
  p_festival_company_id uuid,
  p_category_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  festival_company public.festival_companies%ROWTYPE;
  category jsonb;
  balance_minor bigint;
  cost_minor bigint;
  purchase_window jsonb;
  reason_codes jsonb := '[]'::jsonb;
  implications jsonb := '[]'::jsonb;
  usage_rank integer := 1;
  current_rank integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public._festival_upgrade_authorised(p_festival_company_id) THEN
    RAISE EXCEPTION 'FESTIVAL_UPGRADE_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;

  PERFORM public._festival_activate_due_upgrades(p_festival_company_id);
  SELECT * INTO festival_company
  FROM public.festival_companies
  WHERE id = p_festival_company_id;

  category := public._festival_upgrade_category_json(
    p_festival_company_id,
    p_category_key
  );
  balance_minor := public._festival_company_balance_minor(p_festival_company_id);
  cost_minor := coalesce((category->>'nextCostMinor')::bigint, 0);
  purchase_window := public._festival_upgrade_window(p_festival_company_id);

  IF category->>'nextLevel' IS NULL THEN
    reason_codes := reason_codes || '["FESTIVAL_UPGRADE_MAX_LEVEL"]'::jsonb;
  END IF;
  IF (purchase_window->>'remaining')::integer <= 0 THEN
    reason_codes := reason_codes || '["FESTIVAL_UPGRADE_WINDOW_EXHAUSTED"]'::jsonb;
  END IF;

  SELECT reason_codes || coalesce(jsonb_agg(item->>'code'), '[]'::jsonb)
  INTO reason_codes
  FROM jsonb_array_elements(category->'missingRequirements') item;

  IF category->>'nextLevel' IS NOT NULL THEN
    SELECT coalesce(level.usage_licence_rank, level.minimum_licence_rank, 1)
    INTO usage_rank
    FROM public.festival_upgrade_levels level
    WHERE level.catalogue_version = 2
      AND level.category_key = p_category_key
      AND level.level = (category->>'nextLevel')::integer;

    SELECT coalesce(max(tier.rank), 0)
    INTO current_rank
    FROM public.festival_company_licences licence
    JOIN public.festival_licence_tiers tier ON tier.key = licence.tier_key
    WHERE licence.festival_company_id = p_festival_company_id
      AND licence.status = 'active'
      AND coalesce(licence.valid_from, '-infinity'::timestamptz) <= now()
      AND coalesce(licence.valid_until, 'infinity'::timestamptz) > now();

    IF usage_rank > current_rank THEN
      implications := implications || jsonb_build_array(
        'You can build this upgrade now, but Festival attendance remains capped by your active licence until the licence is upgraded.'
      );
    END IF;
    IF (category->>'nextLevel')::integer % 10 = 0 THEN
      implications := implications || jsonb_build_array(
        'Reaching this milestone counts toward the next licence tier requirements.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'category', category,
    'catalogueVersion', 2,
    'companyVersion', coalesce(festival_company.upgrade_version, 0),
    'purchaseWindow', purchase_window,
    'balanceMinor', balance_minor,
    'remainingBalanceMinor', balance_minor - cost_minor,
    'eligible', jsonb_array_length(reason_codes) = 0,
    'reasonCodes', reason_codes,
    'licenceImplications', implications
  );
END;
$$;

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
