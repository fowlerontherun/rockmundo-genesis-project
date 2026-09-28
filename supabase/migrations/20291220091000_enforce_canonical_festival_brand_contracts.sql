-- Enforce canonical brand identity at the prospect and contract boundaries.
-- Existing unlinked historical NPC/admin records are deliberately unchanged.
CREATE OR REPLACE FUNCTION public.festival_validate_canonical_brand_prospect()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.sponsorship_brand_id IS NOT NULL THEN
    IF NEW.sponsor_source NOT IN ('npc_company', 'admin_sponsor') THEN
      RAISE EXCEPTION 'festival_canonical_brand_invalid_source' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.sponsorship_brands b
      WHERE b.id = NEW.sponsorship_brand_id AND b.is_active
    ) THEN
      RAISE EXCEPTION 'festival_canonical_brand_inactive' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS festival_validate_canonical_brand_prospect_trigger
  ON public.festival_sponsor_prospects;
CREATE TRIGGER festival_validate_canonical_brand_prospect_trigger
BEFORE INSERT OR UPDATE OF sponsorship_brand_id, sponsor_source
ON public.festival_sponsor_prospects
FOR EACH ROW EXECUTE FUNCTION public.festival_validate_canonical_brand_prospect();

-- The existing proposal acceptance workflow inserts a contract with accepted_proposal_id.
-- Resolve the prospect's canonical brand server-side so clients cannot spoof its identity.
CREATE OR REPLACE FUNCTION public.festival_inherit_canonical_contract_brand()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  linked_brand uuid;
  proposal_plan uuid;
BEGIN
  SELECT prospect.sponsorship_brand_id, proposal.festival_sponsorship_plan_id
    INTO linked_brand, proposal_plan
  FROM public.festival_sponsor_proposals proposal
  LEFT JOIN public.festival_sponsor_prospects prospect
    ON prospect.id = proposal.prospect_id
  WHERE proposal.id = NEW.accepted_proposal_id;

  IF proposal_plan IS NULL OR proposal_plan <> NEW.festival_sponsorship_plan_id THEN
    RAISE EXCEPTION 'festival_canonical_brand_proposal_plan_mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.sponsorship_brand_id IS NOT NULL
     AND NEW.sponsorship_brand_id IS DISTINCT FROM linked_brand THEN
    RAISE EXCEPTION 'festival_canonical_brand_contract_mismatch' USING ERRCODE = '23514';
  END IF;
  NEW.sponsorship_brand_id := linked_brand;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS festival_inherit_canonical_contract_brand_trigger
  ON public.festival_sponsor_contracts;
CREATE TRIGGER festival_inherit_canonical_contract_brand_trigger
BEFORE INSERT OR UPDATE OF accepted_proposal_id, sponsorship_brand_id
ON public.festival_sponsor_contracts
FOR EACH ROW EXECUTE FUNCTION public.festival_inherit_canonical_contract_brand();

-- Avoid simultaneous active contracts for one canonical brand on a festival plan.
CREATE UNIQUE INDEX IF NOT EXISTS festival_active_contract_plan_brand_unique
ON public.festival_sponsor_contracts(festival_sponsorship_plan_id, sponsorship_brand_id)
WHERE sponsorship_brand_id IS NOT NULL
  AND status NOT IN ('cancelled', 'sponsor_defaulted', 'festival_cancelled');
