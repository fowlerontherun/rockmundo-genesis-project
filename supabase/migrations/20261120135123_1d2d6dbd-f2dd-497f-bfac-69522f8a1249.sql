ALTER TABLE public.festival_editions_v2 ADD COLUMN IF NOT EXISTS brand_theme text, ADD COLUMN IF NOT EXISTS brand_motif text NOT NULL DEFAULT 'spotlight', ADD COLUMN IF NOT EXISTS branding_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.festival_editions_v2 ADD CONSTRAINT festival_edition_brand_theme_check CHECK (brand_theme IS NULL OR brand_theme IN ('electric','vintage','indie','industrial','sunset','forest'));
ALTER TABLE public.festival_editions_v2 ADD CONSTRAINT festival_edition_brand_motif_check CHECK (brand_motif IN ('spotlight','stripes','sunburst'));
CREATE OR REPLACE FUNCTION public.get_festival_edition_branding(p_edition_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT jsonb_build_object('theme',e.brand_theme,'motif',e.brand_motif,'version',e.branding_version) FROM public.festival_editions_v2 e WHERE e.id=p_edition_id; $$;
REVOKE ALL ON FUNCTION public.get_festival_edition_branding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_branding(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION private.save_festival_edition_branding(p_company_id uuid,p_edition_id uuid,p_expected_version integer,p_theme text,p_motif text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid:=public._caller_profile_id(); edition public.festival_editions_v2%ROWTYPE;
BEGIN
IF auth.uid() IS NULL OR actor IS NULL OR NOT public._festival_company_manager_authorized(p_company_id,actor) THEN RAISE EXCEPTION 'festival_branding_forbidden'; END IF;
SELECT * INTO edition FROM public.festival_editions_v2 WHERE id=p_edition_id AND festival_company_id=p_company_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'festival_branding_not_found'; END IF;
IF edition.status IN ('completed','cancelled') OR edition.locked_at IS NOT NULL OR edition.configuration_locked_at IS NOT NULL THEN RAISE EXCEPTION 'festival_branding_locked'; END IF;
IF p_motif IS NULL OR p_motif NOT IN ('spotlight','stripes','sunburst') OR (p_theme IS NOT NULL AND p_theme NOT IN ('electric','vintage','indie','industrial','sunset','forest')) THEN RAISE EXCEPTION 'festival_branding_invalid'; END IF;
IF p_expected_version IS NULL OR edition.branding_version<>p_expected_version THEN
IF edition.branding_version=p_expected_version+1 AND edition.brand_theme IS NOT DISTINCT FROM p_theme AND edition.brand_motif=p_motif THEN RETURN public.get_festival_edition_branding(p_edition_id); END IF;
RAISE EXCEPTION 'festival_branding_stale'; END IF;
IF edition.brand_theme IS NOT DISTINCT FROM p_theme AND edition.brand_motif=p_motif THEN RETURN public.get_festival_edition_branding(p_edition_id); END IF;
UPDATE public.festival_editions_v2 SET brand_theme=p_theme,brand_motif=p_motif,branding_version=branding_version+1,updated_at=now() WHERE id=p_edition_id;
INSERT INTO public.festival_edition_audit(festival_company_id,festival_edition_id,actor_profile_id,event_type,previous_version,new_version,metadata) VALUES(p_company_id,p_edition_id,actor,'edition_branding_updated',edition.version,edition.version,jsonb_build_object('theme',p_theme,'motif',p_motif,'previousBrandingVersion',edition.branding_version,'brandingVersion',edition.branding_version+1));
RETURN public.get_festival_edition_branding(p_edition_id); END; $$;
REVOKE ALL ON FUNCTION private.save_festival_edition_branding(uuid,uuid,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.save_festival_edition_branding(uuid,uuid,integer,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_festival_edition_branding(p_company_id uuid,p_edition_id uuid,p_expected_version integer,p_theme text,p_motif text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.save_festival_edition_branding(p_company_id,p_edition_id,p_expected_version,p_theme,p_motif); $$;
REVOKE ALL ON FUNCTION public.save_festival_edition_branding(uuid,uuid,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_festival_edition_branding(uuid,uuid,integer,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_festival_edition_wizard(p_festival_company_id uuid,p_festival_edition_id uuid,p_expected_version integer,p_plan jsonb,p_idempotency_key uuid,p_branding jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb; branding jsonb;
BEGIN result:=public.save_festival_edition_annual_plan(p_festival_company_id,p_festival_edition_id,p_expected_version,p_plan,p_idempotency_key);
branding:=public.save_festival_edition_branding(p_festival_company_id,p_festival_edition_id,(p_branding->>'version')::integer,p_branding->>'theme',p_branding->>'motif');
RETURN result||jsonb_build_object('branding',branding); END; $$;
REVOKE ALL ON FUNCTION public.save_festival_edition_wizard(uuid,uuid,integer,jsonb,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_festival_edition_wizard(uuid,uuid,integer,jsonb,uuid,jsonb) TO authenticated;