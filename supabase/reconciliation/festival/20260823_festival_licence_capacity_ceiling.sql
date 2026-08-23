-- Production reconciliation: Festival licence limits are use-time ceilings.
-- Live production migration: 20260823085909 enforce_festival_licence_capacity_caps_v2.

UPDATE public.festival_licence_tiers
SET max_days = 2
WHERE key = 'community';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_upgrade_levels'
      AND column_name = 'minimum_licence_tier'
  ) THEN
    EXECUTE 'UPDATE public.festival_upgrade_levels SET minimum_licence_tier = 1 WHERE minimum_licence_tier > 1';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'festival_upgrade_levels'
      AND column_name = 'minimum_licence_rank'
  ) THEN
    EXECUTE 'UPDATE public.festival_upgrade_levels SET minimum_licence_rank = 1 WHERE minimum_licence_rank > 1';
  END IF;
END;
$$;

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
