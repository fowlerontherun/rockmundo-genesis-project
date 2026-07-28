-- Server-owned identifier resolution for canonical Festival routes. No gameplay or settlement authority lives here.
CREATE TABLE IF NOT EXISTS public.festival_public_legacy_bridges (
  legacy_festival_id uuid NOT NULL,
  festival_company_id uuid REFERENCES public.festival_companies(id) ON DELETE CASCADE,
  festival_edition_id uuid REFERENCES public.festival_editions_v2(id) ON DELETE CASCADE,
  provenance text NOT NULL DEFAULT 'admin_repair',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (legacy_festival_id, festival_company_id, festival_edition_id)
);
ALTER TABLE public.festival_public_legacy_bridges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.festival_public_legacy_bridges FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_public_festival_identifier(
  p_identifier text,
  p_expected_identifier_kind text,
  p_edition_identifier text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE matches jsonb[] := '{}'; fc public.festival_companies%ROWTYPE; ed public.festival_editions_v2%ROWTYPE; bridge_count int; legacy_id uuid;
BEGIN
  IF p_expected_identifier_kind NOT IN ('festival_company','public_slug','legacy_festival') OR p_identifier IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;
  SELECT * INTO fc FROM public.festival_companies
   WHERE (p_expected_identifier_kind IN ('festival_company','public_slug') AND slug=p_identifier)
      OR (p_expected_identifier_kind='festival_company' AND p_identifier ~* '^[0-9a-f-]{36}$' AND id=p_identifier::uuid);
  IF FOUND THEN
    IF p_edition_identifier IS NOT NULL THEN
      SELECT * INTO ed FROM public.festival_editions_v2 WHERE festival_company_id=fc.id AND
        ((p_edition_identifier ~* '^[0-9a-f-]{36}$' AND id=p_edition_identifier::uuid) OR (p_edition_identifier ~ '^[0-9]{4}$' AND edition_year=p_edition_identifier::int));
      IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
    ELSE SELECT * INTO ed FROM public.festival_editions_v2 WHERE festival_company_id=fc.id ORDER BY (status IN ('announced','live')) DESC, starts_on DESC NULLS LAST LIMIT 1;
    END IF;
    RETURN jsonb_strip_nulls(jsonb_build_object('status','resolved','festivalCompanyId',fc.id,'publicSlug',fc.slug,'companyId',fc.company_id,'editionId',ed.id,'editionYear',ed.edition_year,'provenance',CASE WHEN fc.slug=p_identifier THEN 'canonical_slug' ELSE 'canonical_uuid' END));
  END IF;
  IF p_identifier ~* '^[0-9a-f-]{36}$' THEN
    legacy_id:=p_identifier::uuid;
    SELECT count(*) INTO bridge_count FROM public.festival_public_legacy_bridges WHERE legacy_festival_id=legacy_id;
    IF bridge_count>1 THEN RETURN jsonb_build_object('status','ambiguous'); END IF;
    IF bridge_count=1 THEN SELECT f.* INTO fc FROM public.festival_companies f JOIN public.festival_public_legacy_bridges b ON b.festival_company_id=f.id WHERE b.legacy_festival_id=legacy_id;
      SELECT e.* INTO ed FROM public.festival_editions_v2 e JOIN public.festival_public_legacy_bridges b ON b.festival_edition_id=e.id WHERE b.legacy_festival_id=legacy_id;
      RETURN jsonb_build_object('status','resolved','festivalCompanyId',fc.id,'publicSlug',fc.slug,'companyId',fc.company_id,'editionId',ed.id,'editionYear',ed.edition_year,'provenance','legacy_mapping');
    END IF;
    IF to_regclass('public.festivals') IS NOT NULL AND EXISTS(SELECT 1 FROM public.festivals WHERE id=legacy_id) THEN RETURN jsonb_build_object('status','legacy_only'); END IF;
  END IF;
  RETURN jsonb_build_object('status','not_found');
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('status','unavailable');
END $$;

CREATE OR REPLACE FUNCTION public.resolve_owner_festival_identifier(p_identifier text,p_edition_identifier text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; profile_id uuid; fc_id uuid; ed_id uuid;
BEGIN
  profile_id:=public.current_profile_id_safe();
  IF profile_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_ACCESS_DENIED'; END IF;
  result:=public.resolve_public_festival_identifier(p_identifier,'festival_company',p_edition_identifier);
  IF result->>'status'='legacy_only' THEN RAISE EXCEPTION 'FESTIVAL_IDENTIFIER_LEGACY_ONLY'; END IF;
  IF result->>'status'='ambiguous' THEN RAISE EXCEPTION 'FESTIVAL_IDENTIFIER_AMBIGUOUS'; END IF;
  IF result->>'status'<>'resolved' THEN RAISE EXCEPTION 'FESTIVAL_COMPANY_NOT_FOUND'; END IF;
  fc_id:=(result->>'festivalCompanyId')::uuid; ed_id:=(result->>'editionId')::uuid;
  IF ed_id IS NULL THEN RAISE EXCEPTION 'FESTIVAL_EDITION_NOT_FOUND'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.festival_editions_v2 WHERE id=ed_id AND festival_company_id=fc_id) THEN RAISE EXCEPTION 'FESTIVAL_EDITION_COMPANY_MISMATCH'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.festival_companies WHERE id=fc_id AND owner_profile_id=profile_id)
     AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'FESTIVAL_EDITION_ACCESS_DENIED'; END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.resolve_public_festival_identifier(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_owner_festival_identifier(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_public_festival_identifier(text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_owner_festival_identifier(text,text) TO authenticated;
