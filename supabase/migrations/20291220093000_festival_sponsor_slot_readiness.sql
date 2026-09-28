-- Read-only reconciliation and launch-readiness report for sponsor allocations.
-- Historical NULL roles are surfaced explicitly, not silently assigned.
CREATE OR REPLACE VIEW public.festival_sponsor_slot_readiness
WITH (security_invoker = true)
AS
SELECT
  p.id AS sponsorship_plan_id,
  p.festival_company_id,
  count(c.id) FILTER (
    WHERE c.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
      AND c.festival_sponsor_role = 'main'
  )::integer AS main_sponsor_count,
  count(c.id) FILTER (
    WHERE c.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
      AND c.festival_sponsor_role = 'support'
  )::integer AS support_sponsor_count,
  count(c.id) FILTER (
    WHERE c.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
      AND c.festival_sponsor_role IS NULL
  )::integer AS unassigned_legacy_contract_count,
  count(c.id) FILTER (
    WHERE c.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
      AND c.sponsorship_brand_id IS NULL
      AND c.sponsor_source IN ('npc_company','admin_sponsor')
  )::integer AS unlinked_npc_admin_contract_count,
  (
    count(c.id) FILTER (
      WHERE c.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
        AND c.festival_sponsor_role = 'main'
    ) = 1
    AND count(c.id) FILTER (
      WHERE c.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
        AND c.festival_sponsor_role = 'support'
    ) <= 4
    AND count(c.id) FILTER (
      WHERE c.status NOT IN ('cancelled','sponsor_defaulted','festival_cancelled')
        AND c.festival_sponsor_role IS NULL
    ) = 0
  ) AS sponsor_slots_ready
FROM public.festival_sponsorship_plans p
LEFT JOIN public.festival_sponsor_contracts c
  ON c.festival_sponsorship_plan_id = p.id
GROUP BY p.id, p.festival_company_id;

COMMENT ON VIEW public.festival_sponsor_slot_readiness
IS 'Read-only per-plan sponsor slot audit: exactly one main, up to four support, and no unassigned active historical contracts required for sponsor_slots_ready. Does not itself block festival launch.';
