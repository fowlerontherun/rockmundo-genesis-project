-- Bridge festival NPC/admin sponsorship records to the EXISTING shared brand catalogue.
-- Nullable references preserve historical player, NPC and administrator contracts.
ALTER TABLE public.festival_sponsor_prospects
  ADD COLUMN IF NOT EXISTS sponsorship_brand_id uuid
  REFERENCES public.sponsorship_brands(id) ON DELETE RESTRICT;
ALTER TABLE public.festival_sponsor_contracts
  ADD COLUMN IF NOT EXISTS sponsorship_brand_id uuid
  REFERENCES public.sponsorship_brands(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS festival_sponsor_prospects_canonical_brand_idx
  ON public.festival_sponsor_prospects(sponsorship_brand_id)
  WHERE sponsorship_brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS festival_sponsor_contracts_canonical_brand_idx
  ON public.festival_sponsor_contracts(sponsorship_brand_id)
  WHERE sponsorship_brand_id IS NOT NULL;

-- A canonical brand cannot be duplicated within the same festival commercial plan.
-- Existing historical rows remain untouched until an explicit verified mapping exists.
CREATE UNIQUE INDEX IF NOT EXISTS festival_sponsor_prospects_plan_brand_unique
  ON public.festival_sponsor_prospects(festival_sponsorship_plan_id, sponsorship_brand_id)
  WHERE sponsorship_brand_id IS NOT NULL;

-- Eligible fictional identities for the festival prospect discovery workflow.
-- Security remains governed by the base sponsorship_brands policies.
CREATE OR REPLACE VIEW public.festival_eligible_sponsorship_brands
WITH (security_invoker = true)
AS
SELECT id, name, logo_url, category, region, size, wealth_tier,
       available_budget, wealth_score, min_fame_required,
       min_fame_threshold, exclusivity_pref, targeting_flags
FROM public.sponsorship_brands
WHERE is_active = true
  AND coalesce(available_budget, 0) > 0;

COMMENT ON COLUMN public.festival_sponsor_prospects.sponsorship_brand_id
  IS 'Optional link to canonical sponsorship_brands; legacy NPC/admin records are not inferred by name.';
COMMENT ON COLUMN public.festival_sponsor_contracts.sponsorship_brand_id
  IS 'Canonical brand identity at contract time. Historical contract references must be migrated only after verified matching.';
