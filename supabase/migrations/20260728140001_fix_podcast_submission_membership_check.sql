-- Evaluate media-submission membership outside table RLS.  Checking
-- band_members/profiles directly inside a submission policy can produce a false
-- negative when either table hides character-scoped membership rows.
CREATE OR REPLACE FUNCTION public.can_submit_media_for_band(p_band_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.band_members AS bm
      WHERE bm.band_id = p_band_id
        AND COALESCE(bm.member_status, 'active') = 'active'
        AND (
          bm.user_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles AS p
            WHERE p.id = bm.profile_id
              AND p.user_id = auth.uid()
          )
        )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_submit_media_for_band(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_submit_media_for_band(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users can create podcast submissions for their bands"
  ON public.podcast_submissions;

CREATE POLICY "Users can create podcast submissions for their bands"
ON public.podcast_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.can_submit_media_for_band(band_id)
);
