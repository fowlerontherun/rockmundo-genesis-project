-- Guard against a band collaborator transferring a song to their own user_id
-- to bypass the DJ-use owner-consent check.
-- Server-side complete_song_sale runs as trusted SECURITY DEFINER postgres
-- (verified 2026-10-17), so legitimate marketplace transfers remain possible.
CREATE OR REPLACE FUNCTION public.guard_direct_song_ownership_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND current_user NOT IN ('postgres','service_role')
     AND NOT public.has_role((SELECT auth.uid()),'admin'::public.app_role)
  THEN
    RAISE EXCEPTION 'Song ownership changes require a trusted sale or administrative workflow'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_direct_song_ownership_transfer() FROM PUBLIC;
DROP TRIGGER IF EXISTS guard_direct_song_ownership_transfer_on_songs ON public.songs;
CREATE TRIGGER guard_direct_song_ownership_transfer_on_songs
  BEFORE UPDATE OF user_id ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.guard_direct_song_ownership_transfer();
