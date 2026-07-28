-- Submit podcast requests through a narrowly scoped, authenticated function.
-- This avoids relying on client-visible band_members/profile rows while still
-- enforcing ownership and active membership before the RLS-bypassing insert.
CREATE OR REPLACE FUNCTION public.submit_podcast_appearance(
  p_band_id uuid,
  p_podcast_id uuid,
  p_episode_topic text,
  p_linked_release_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  submission_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_submit_media_for_band(p_band_id) THEN
    RAISE EXCEPTION 'Active band membership required' USING ERRCODE = '42501';
  END IF;

  IF p_linked_release_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.releases AS r
    WHERE r.id = p_linked_release_id
      AND r.band_id = p_band_id
  ) THEN
    RAISE EXCEPTION 'Linked release must belong to the submitting band'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.podcast_submissions (
    user_id,
    band_id,
    podcast_id,
    episode_topic,
    linked_release_id,
    status
  )
  VALUES (
    auth.uid(),
    p_band_id,
    p_podcast_id,
    p_episode_topic,
    p_linked_release_id,
    'pending'
  )
  RETURNING id INTO submission_id;

  RETURN submission_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_podcast_appearance(uuid, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_podcast_appearance(uuid, uuid, text, uuid) TO authenticated;
