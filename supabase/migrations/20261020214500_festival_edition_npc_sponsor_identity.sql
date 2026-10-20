-- #2182: edition-bound *identity* assignments reusing sponsorship_brands.
-- This deliberately does not create a sponsor contract, receivable, or cash entry.
-- The simplified festival sponsorship budget remains the only financial authority
-- until explicit contracts are reconciled, and historical editions are untouched.
CREATE TABLE IF NOT EXISTS public.festival_edition_sponsor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id) ON DELETE RESTRICT,
  sponsorship_brand_id uuid NOT NULL REFERENCES public.sponsorship_brands(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('main','supporting')),
  source text NOT NULL DEFAULT 'npc_fallback' CHECK (source = 'npc_fallback'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  brand_name_snapshot text NOT NULL CHECK (btrim(brand_name_snapshot) <> ''),
  logo_url_snapshot text NOT NULL CHECK (btrim(logo_url_snapshot) <> ''),
  category_snapshot text NOT NULL,
  region_snapshot text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS festival_edition_one_main_sponsor_idx
ON public.festival_edition_sponsor_assignments(festival_edition_id)
WHERE role = 'main' AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS festival_edition_one_active_brand_idx
ON public.festival_edition_sponsor_assignments(festival_edition_id, sponsorship_brand_id)
WHERE status = 'active';
CREATE INDEX IF NOT EXISTS festival_edition_sponsor_edition_idx
ON public.festival_edition_sponsor_assignments(festival_edition_id, role, assigned_at);

ALTER TABLE public.festival_edition_sponsor_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_edition_sponsor_assignments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._festival_edition_sponsor_assignment_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $guard$
DECLARE
  v_edition public.festival_editions_v2%ROWTYPE;
  v_brand public.sponsorship_brands%ROWTYPE;
  v_supporting integer;
BEGIN
  -- Serialize all writes for a particular annual edition, including competing
  -- supporting-sponsor inserts. Unique indexes arbitrate main and brand races too.
  SELECT * INTO v_edition
  FROM public.festival_editions_v2
  WHERE id = NEW.festival_edition_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'festival_sponsor_edition_not_found' USING ERRCODE='23503';
  END IF;

  IF v_edition.status IN ('announced','live','completed','cancelled')
     OR v_edition.locked_at IS NOT NULL
     OR v_edition.configuration_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'festival_sponsor_edition_immutable' USING ERRCODE='23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Identity snapshots are append-only; to change a prospect, cancel and
    -- create a new row while the edition is still editable.
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.festival_edition_id IS DISTINCT FROM OLD.festival_edition_id
       OR NEW.sponsorship_brand_id IS DISTINCT FROM OLD.sponsorship_brand_id
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.brand_name_snapshot IS DISTINCT FROM OLD.brand_name_snapshot
       OR NEW.logo_url_snapshot IS DISTINCT FROM OLD.logo_url_snapshot
       OR NEW.category_snapshot IS DISTINCT FROM OLD.category_snapshot
       OR NEW.region_snapshot IS DISTINCT FROM OLD.region_snapshot
       OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
       OR OLD.status <> 'active'
       OR NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'festival_sponsor_identity_change_forbidden' USING ERRCODE='23514';
    END IF;
    NEW.cancelled_at := now();
  ELSE
    -- Never trust a caller-supplied name or logo: snapshot the canonical
    -- fictional brand identity once on allocation.
    SELECT * INTO v_brand
    FROM public.sponsorship_brands
    WHERE id = NEW.sponsorship_brand_id
      AND is_active
      AND coalesce(available_budget, 0) > 0
      AND nullif(btrim(logo_url), '') IS NOT NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'festival_sponsor_brand_ineligible' USING ERRCODE='23514';
    END IF;
    NEW.brand_name_snapshot := v_brand.name;
    NEW.logo_url_snapshot := v_brand.logo_url;
    NEW.category_snapshot := coalesce(v_brand.category, 'unspecified');
    NEW.region_snapshot := coalesce(v_brand.region, 'Global');
  END IF;

  IF NEW.status = 'active' AND NEW.role = 'supporting' THEN
    SELECT count(*) INTO v_supporting
    FROM public.festival_edition_sponsor_assignments a
    WHERE a.festival_edition_id = NEW.festival_edition_id
      AND a.status = 'active'
      AND a.role = 'supporting'
      AND a.id IS DISTINCT FROM NEW.id;
    IF v_supporting >= 4 THEN
      RAISE EXCEPTION 'festival_supporting_sponsor_slots_full' USING ERRCODE='23514';
    END IF;
  END IF;

  -- Exclusivity is symmetrical: either the incoming brand OR an existing
  -- edition sponsor can require category exclusivity (main or supporting).
  IF NEW.status = 'active' AND EXISTS (
    SELECT 1
    FROM public.festival_edition_sponsor_assignments a
    JOIN public.sponsorship_brands existing ON existing.id = a.sponsorship_brand_id
    JOIN public.sponsorship_brands incoming ON incoming.id = NEW.sponsorship_brand_id
    WHERE a.festival_edition_id = NEW.festival_edition_id
      AND a.status = 'active'
      AND a.id IS DISTINCT FROM NEW.id
      AND a.category_snapshot = NEW.category_snapshot
      AND (coalesce(incoming.exclusivity_pref,false)
           OR coalesce(existing.exclusivity_pref,false))
  ) THEN
    RAISE EXCEPTION 'festival_sponsor_category_exclusive' USING ERRCODE='23514';
  END IF;

  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public._festival_edition_sponsor_assignment_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS festival_edition_sponsor_assignment_guard ON public.festival_edition_sponsor_assignments;
CREATE TRIGGER festival_edition_sponsor_assignment_guard
BEFORE INSERT OR UPDATE ON public.festival_edition_sponsor_assignments
FOR EACH ROW EXECUTE FUNCTION public._festival_edition_sponsor_assignment_guard();

CREATE OR REPLACE FUNCTION public.ensure_festival_edition_npc_main_sponsor(
  p_festival_edition_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_edition public.festival_editions_v2%ROWTYPE;
  v_existing public.festival_edition_sponsor_assignments%ROWTYPE;
  v_brand_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'festival_sponsor_forbidden' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_edition
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id FOR UPDATE;
  IF NOT FOUND OR NOT public._festival_company_manager_authorized(
      v_edition.festival_company_id, public._caller_profile_id()) THEN
    RAISE EXCEPTION 'festival_sponsor_forbidden' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.festival_edition_sponsor_assignments
  WHERE festival_edition_id = p_festival_edition_id
    AND role = 'main' AND status = 'active';
  IF FOUND THEN RETURN to_jsonb(v_existing); END IF;

  IF v_edition.status IN ('announced','live','completed','cancelled')
     OR v_edition.locked_at IS NOT NULL
     OR v_edition.configuration_locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'festival_sponsor_edition_immutable' USING ERRCODE='23514';
  END IF;

  -- Contract workflows have their own authority. Stop NPC allocation if
  -- those tables are deployed before the financial reconciliation is linked.
  IF to_regclass('public.festival_sponsor_contracts') IS NOT NULL THEN
    RAISE EXCEPTION 'festival_sponsor_contract_reconciliation_required' USING ERRCODE='P0001';
  END IF;

  -- Conservative eligibility when a reputation score cannot be verified:
  -- never allocate a brand with a positive fame threshold.
  SELECT b.id INTO v_brand_id
  FROM public.sponsorship_brands b
  WHERE b.is_active
    AND coalesce(b.available_budget, 0) > 0
    AND nullif(btrim(b.logo_url), '') IS NOT NULL
    AND coalesce(b.min_fame_threshold,b.min_fame_required,0) <= 0
    AND b.wealth_tier <= CASE WHEN v_edition.festival_scale = 'small' THEN 3
      WHEN v_edition.festival_scale = 'medium' THEN 4 ELSE 5 END
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM public.festival_canonical_brand_selections sel
      WHERE sel.festival_company_id = v_edition.festival_company_id
        AND sel.brand_id = b.id
    ) THEN 0 ELSE 1 END,
    CASE WHEN (v_edition.country_code = 'GB' AND b.region = 'United Kingdom')
        OR (v_edition.country_code = 'US' AND b.region = 'United States')
        OR b.region = 'Global' THEN 0 ELSE 1 END,
    CASE WHEN v_edition.vibe = ANY(coalesce(b.targeting_flags, ARRAY[]::text[]))
      THEN 0 ELSE 1 END,
    md5(b.id::text || v_edition.id::text),
    b.id
  LIMIT 1;

  IF v_brand_id IS NULL THEN
    RAISE EXCEPTION 'festival_main_sponsor_no_eligible_brand' USING ERRCODE='P0001';
  END IF;

  INSERT INTO public.festival_edition_sponsor_assignments(
    festival_edition_id, sponsorship_brand_id, role, source, status,
    brand_name_snapshot, logo_url_snapshot, category_snapshot, region_snapshot
  ) VALUES (
    v_edition.id, v_brand_id, 'main', 'npc_fallback', 'active',
    '', '', '', ''
  ) RETURNING * INTO v_existing;

  -- Financial authority stays in the simplified budget; no revenue posted.
  RETURN to_jsonb(v_existing);
END;
$fn$;
REVOKE ALL ON FUNCTION public.ensure_festival_edition_npc_main_sponsor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_festival_edition_npc_main_sponsor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_festival_edition_sponsor_identities(
  p_festival_edition_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT festival_company_id INTO v_company_id
  FROM public.festival_editions_v2
  WHERE id = p_festival_edition_id;
  IF auth.uid() IS NULL OR v_company_id IS NULL
     OR NOT public._festival_company_manager_authorized(v_company_id, public._caller_profile_id()) THEN
    RAISE EXCEPTION 'festival_sponsor_forbidden' USING ERRCODE='42501';
  END IF;

  RETURN jsonb_build_object(
    'editionId', p_festival_edition_id,
    'main', (
      SELECT jsonb_build_object(
        'brandId', a.sponsorship_brand_id,
        'name', a.brand_name_snapshot,
        'logoUrl', a.logo_url_snapshot,
        'category', a.category_snapshot,
        'source', a.source
      )
      FROM public.festival_edition_sponsor_assignments a
      WHERE a.festival_edition_id = p_festival_edition_id AND a.role='main' AND a.status='active'
      LIMIT 1
    ),
    'supporting', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'brandId', a.sponsorship_brand_id,
        'name', a.brand_name_snapshot,
        'logoUrl', a.logo_url_snapshot,
        'category', a.category_snapshot,
        'source', a.source
      ) ORDER BY a.assigned_at, a.id)
      FROM public.festival_edition_sponsor_assignments a
      WHERE a.festival_edition_id = p_festival_edition_id
        AND a.role='supporting' AND a.status='active'
    ),'[]'::jsonb),
    'financialAuthority', 'simplified_automatic_budget',
    'postsRevenue', false
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_festival_edition_sponsor_identities(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_sponsor_identities(uuid) TO authenticated;
COMMENT ON TABLE public.festival_edition_sponsor_assignments
IS 'Edition-specific fictional sponsor identity snapshot, not a contract, invoice, receivable or revenue entitlement; identities are immutable when edition is locked/published/completed.';
NOTIFY pgrst, 'reload schema';
