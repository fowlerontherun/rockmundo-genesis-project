-- #2183: edition-scoped public festival visitor notes.
-- Apply after the legacy festival annual-edition foundation (which is future-dated
-- in this repository). Never rewrite historical launch snapshots.
CREATE TABLE IF NOT EXISTS public.festival_edition_visitor_guides (
  festival_edition_id uuid PRIMARY KEY REFERENCES public.festival_editions_v2(id),
  guide_version integer NOT NULL DEFAULT 1 CHECK (guide_version > 0),
  sections jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(sections) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_profile_id uuid REFERENCES public.profiles(id)
);
CREATE TABLE IF NOT EXISTS public.festival_edition_visitor_guide_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  festival_edition_id uuid NOT NULL REFERENCES public.festival_editions_v2(id),
  request_key uuid NOT NULL,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  old_version integer NOT NULL,
  new_version integer NOT NULL,
  old_sections jsonb NOT NULL,
  new_sections jsonb NOT NULL,
  admin_override boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(festival_edition_id, request_key)
);
ALTER TABLE public.festival_edition_visitor_guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festival_edition_visitor_guide_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_edition_visitor_guides, public.festival_edition_visitor_guide_audit FROM PUBLIC, anon, authenticated;

-- All writes take place behind the same owner/admin authority as festival
-- launch, not through direct table access. No rosters or private readiness data
-- are ever copied into the visitor projection.
CREATE OR REPLACE FUNCTION public.get_festival_edition_visitor_guide(
  p_festival_company_id uuid, p_festival_edition_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition public.festival_editions_v2%ROWTYPE;
  guide public.festival_edition_visitor_guides%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL OR
     NOT public._festival_launch_authorised(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_visitor_guide_forbidden' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO edition FROM public.festival_editions_v2
    WHERE id = p_festival_edition_id AND festival_company_id = p_festival_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_visitor_guide_not_found' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO guide FROM public.festival_edition_visitor_guides
    WHERE festival_edition_id = edition.id;
  RETURN jsonb_build_object(
    'editionId', edition.id,
    'version', coalesce(guide.guide_version, 0),
    'sections', coalesce(guide.sections, '{}'::jsonb),
    'editable', edition.status NOT IN ('completed', 'cancelled', 'cancelled_before_event')
      AND edition.locked_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.save_festival_edition_visitor_guide(
  p_festival_company_id uuid,
  p_festival_edition_id uuid,
  p_expected_version integer,
  p_sections jsonb,
  p_idempotency_key uuid,
  p_admin_override boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := public._caller_profile_id();
  edition public.festival_editions_v2%ROWTYPE;
  old_guide public.festival_edition_visitor_guides%ROWTYPE;
  prior public.festival_edition_visitor_guide_audit%ROWTYPE;
  normalised jsonb := '{}'::jsonb;
  item record;
  allowed_keys text[] := ARRAY[
    'site', 'transport', 'parking', 'camping', 'accessibility', 'foodAndDrink',
    'gates', 'curfew', 'contact', 'faq', 'ticketHelp', 'ageGuidance', 'terms', 'refundPolicy'
  ];
  next_version integer;
  admin_actor boolean := coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false);
BEGIN
  IF auth.uid() IS NULL OR actor IS NULL OR
     NOT public._festival_launch_authorised(p_festival_company_id, actor) THEN
    RAISE EXCEPTION 'festival_visitor_guide_forbidden' USING ERRCODE = 'P0001';
  END IF;
  IF p_idempotency_key IS NULL OR p_expected_version IS NULL OR p_expected_version < 0
      OR p_sections IS NULL OR jsonb_typeof(p_sections) <> 'object' THEN
    RAISE EXCEPTION 'festival_visitor_guide_invalid' USING ERRCODE = 'P0001';
  END IF;
  FOR item IN SELECT key, value FROM jsonb_each(p_sections) LOOP
    IF NOT (item.key = ANY(allowed_keys))
       OR jsonb_typeof(item.value) NOT IN ('string', 'null')
       OR length(coalesce(item.value #>> '{}', '')) > 1200
       OR coalesce(item.value #>> '{}', '') ~ '<[^>]+>' THEN
      RAISE EXCEPTION 'festival_visitor_guide_invalid' USING ERRCODE = 'P0001';
    END IF;
    IF item.value <> 'null'::jsonb AND btrim(item.value #>> '{}') <> '' THEN
      normalised := normalised || jsonb_build_object(item.key, btrim(item.value #>> '{}'));
    END IF;
  END LOOP;

  SELECT * INTO edition FROM public.festival_editions_v2
   WHERE id = p_festival_edition_id AND festival_company_id = p_festival_company_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'festival_visitor_guide_not_found' USING ERRCODE = 'P0001'; END IF;
  -- Completed and cancelled editions are immutable, even for administrators.
  IF edition.status IN ('completed', 'cancelled', 'cancelled_before_event') THEN
    RAISE EXCEPTION 'festival_visitor_guide_historical_locked' USING ERRCODE = 'P0001';
  END IF;
  IF edition.locked_at IS NOT NULL AND NOT (admin_actor AND p_admin_override) THEN
    RAISE EXCEPTION 'festival_visitor_guide_locked' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO prior FROM public.festival_edition_visitor_guide_audit
    WHERE festival_edition_id = edition.id AND request_key = p_idempotency_key;
  IF FOUND THEN
    IF prior.new_sections <> normalised THEN
      RAISE EXCEPTION 'festival_visitor_guide_idempotency_conflict' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('editionId',edition.id,'version',prior.new_version,'sections',prior.new_sections);
  END IF;

  SELECT * INTO old_guide FROM public.festival_edition_visitor_guides
    WHERE festival_edition_id = edition.id FOR UPDATE;
  IF coalesce(old_guide.guide_version, 0) <> p_expected_version THEN
    RAISE EXCEPTION 'festival_visitor_guide_stale' USING ERRCODE = 'P0001';
  END IF;
  next_version := p_expected_version + 1;
  INSERT INTO public.festival_edition_visitor_guides
    (festival_edition_id, guide_version, sections, updated_by_profile_id)
  VALUES (edition.id, next_version, normalised, actor)
  ON CONFLICT (festival_edition_id) DO UPDATE SET
    guide_version = EXCLUDED.guide_version, sections = EXCLUDED.sections,
    updated_by_profile_id = EXCLUDED.updated_by_profile_id, updated_at = now();
  INSERT INTO public.festival_edition_visitor_guide_audit
    (festival_edition_id, request_key, actor_profile_id, old_version, new_version,
      old_sections, new_sections, admin_override)
  VALUES (edition.id, p_idempotency_key, actor, p_expected_version, next_version,
    coalesce(old_guide.sections, '{}'::jsonb), normalised, admin_actor AND p_admin_override);
  RETURN jsonb_build_object('editionId',edition.id,'version',next_version,'sections',normalised);
END;
$$;

-- A new public read model supplements the existing authoritative launch
-- projection. It cannot bypass get_public_festival's publication boundary.
-- Exact edition identity wins; older published payloads without editionId are
-- matched only when the company and local start-date select one edition.
CREATE OR REPLACE FUNCTION public.get_public_festival_guide(p_slug text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  base jsonb;
  matched_edition uuid;
  site_style text;
  matched_count integer;
  content jsonb;
BEGIN
  base := public.get_public_festival(p_slug);
  IF base IS NULL THEN RETURN NULL; END IF;
  IF (base->>'editionId') IS NOT NULL THEN
    SELECT id, site_type INTO matched_edition, site_style
    FROM public.festival_editions_v2
    WHERE id = (base->>'editionId')::uuid;
  ELSE
    SELECT count(*), min(edition.id::text)::uuid, min(edition.site_type)
      INTO matched_count, matched_edition, site_style
    FROM public.festival_public_editions published
    JOIN public.festival_launches launch ON launch.id = published.festival_launch_id
    JOIN public.festival_editions_v2 edition
      ON edition.festival_company_id = launch.festival_company_id
      AND edition.starts_on = (published.starts_at AT TIME ZONE published.timezone)::date
    WHERE published.slug = p_slug;
    IF matched_count <> 1 THEN matched_edition := NULL; site_style := NULL; END IF;
  END IF;
  SELECT sections INTO content FROM public.festival_edition_visitor_guides
    WHERE festival_edition_id = matched_edition;
  RETURN base || jsonb_build_object('visitorGuide', jsonb_build_object(
    'siteStyle', site_style,
    'sections', coalesce(content, '{}'::jsonb),
    'siteMapReference', NULL, -- only approved canonical map assets may be published
    'verifiedSafety', NULL    -- never infer facilities from private staffing rosters
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.get_festival_edition_visitor_guide(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_festival_edition_visitor_guide(uuid,uuid,integer,jsonb,uuid,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_public_festival_guide(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_visitor_guide(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_festival_edition_visitor_guide(uuid,uuid,integer,jsonb,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_festival_guide(text) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
