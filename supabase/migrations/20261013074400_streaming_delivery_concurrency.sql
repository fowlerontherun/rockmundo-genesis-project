-- A release/song/platform/type is one delivery even when jobs overlap.
-- Verify existing duplicate rows before deploying this unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_song_releases_delivery
 ON public.song_releases(release_id,song_id,platform_id,release_type)
 WHERE release_id IS NOT NULL;

-- Removing only successfully delivered platforms avoids erasing new
-- requests or failed platforms when two workers handle a release together.
CREATE OR REPLACE FUNCTION public.acknowledge_streaming_platform_delivery(
  p_release_id uuid,p_succeeded_platforms text[])
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_pending text[];
BEGIN
 IF p_release_id IS NULL OR p_succeeded_platforms IS NULL THEN
   RAISE EXCEPTION 'Missing distribution acknowledgment';
 END IF;
 UPDATE public.releases r SET streaming_platforms=ARRAY(
  SELECT entry.platform_id
  FROM unnest(COALESCE(r.streaming_platforms,'{}'::text[]))
    WITH ORDINALITY AS entry(platform_id,position)
  WHERE NOT entry.platform_id=ANY(p_succeeded_platforms)
  ORDER BY entry.position
 ) WHERE r.id=p_release_id
 RETURNING streaming_platforms INTO v_pending;
 IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
 RETURN v_pending;
END $$;
REVOKE ALL ON FUNCTION public.acknowledge_streaming_platform_delivery(uuid,text[])
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_streaming_platform_delivery(uuid,text[])
 TO service_role;
