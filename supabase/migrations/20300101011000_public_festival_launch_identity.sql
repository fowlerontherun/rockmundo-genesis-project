-- Production's legacy festival_public_projection_v2 uses launch.id as its
-- public id. The later festival_public_editions schema uses its own id.
-- Resolve both from the already authorised public guide projection; never
-- infer which identity a UUID represents in the browser. Do not require the
-- later table to exist on today's live schema.
CREATE OR REPLACE FUNCTION public.get_public_festival_with_identity(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  projection jsonb;
  matching_launch_id uuid;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RETURN NULL;
  END IF;

  projection := public.get_public_festival_guide(p_slug);
  IF projection IS NULL THEN RETURN NULL; END IF;

  -- Legacy projection: the id is the launch id itself. Check the published
  -- slug too so a mismatched guide payload cannot identify another festival.
  SELECT launch.id INTO matching_launch_id
  FROM public.festival_launches launch
  LEFT JOIN public.festival_public_profiles profile
    ON profile.festival_company_id = launch.festival_company_id
  WHERE launch.id = (projection->>'id')::uuid
    AND (launch.public_slug = p_slug OR profile.public_slug = p_slug);

  -- Later projection: the id is the independent public-edition id. Dynamic
  -- SQL is necessary here because the public_edition table is absent on the
  -- current live schema. All input values are bound, never interpolated.
  IF matching_launch_id IS NULL AND to_regclass('public.festival_public_editions') IS NOT NULL THEN
    EXECUTE 'SELECT edition.festival_launch_id
      FROM public.festival_public_editions edition
      WHERE edition.id = $1::uuid AND edition.slug = $2'
      INTO matching_launch_id
      USING projection->>'id', p_slug;
  END IF;

  IF matching_launch_id IS NULL THEN
    RAISE EXCEPTION 'festival_public_identity_unavailable' USING ERRCODE = 'P0001';
  END IF;

  RETURN projection || jsonb_build_object('festivalLaunchId', matching_launch_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_festival_with_identity(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_festival_with_identity(text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
