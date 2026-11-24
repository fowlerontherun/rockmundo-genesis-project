CREATE OR REPLACE FUNCTION private.get_festival_edition_branding(p_edition_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT jsonb_build_object('theme',e.brand_theme,'motif',e.brand_motif,'version',e.branding_version) FROM public.festival_editions_v2 e WHERE e.id=p_edition_id; $$;
REVOKE ALL ON FUNCTION private.get_festival_edition_branding(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.get_festival_edition_branding(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_festival_edition_branding(p_edition_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ SELECT private.get_festival_edition_branding(p_edition_id); $$;
REVOKE ALL ON FUNCTION public.get_festival_edition_branding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_festival_edition_branding(uuid) TO anon,authenticated,service_role;