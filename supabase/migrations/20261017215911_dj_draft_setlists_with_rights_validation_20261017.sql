-- Draft-only DJ setlists, independent from gig booking and paid settlement.
-- All playable audio and creator permissions are revalidated at each save.
CREATE TABLE IF NOT EXISTS public.dj_setlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dj_setlists_items_array CHECK (jsonb_typeof(items) = 'array'),
  CONSTRAINT dj_setlists_items_bounds CHECK (jsonb_array_length(items) BETWEEN 1 AND 30)
);
CREATE INDEX IF NOT EXISTS dj_setlists_owner_idx ON public.dj_setlists(profile_id, updated_at DESC);
ALTER TABLE public.dj_setlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DJ owner reads their sets" ON public.dj_setlists FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = (SELECT auth.uid())
 ));
CREATE POLICY "DJ owner creates their sets" ON public.dj_setlists FOR INSERT TO authenticated
 WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = (SELECT auth.uid())
 ));
CREATE POLICY "DJ owner edits their sets" ON public.dj_setlists FOR UPDATE TO authenticated
 USING (user_id = (SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = (SELECT auth.uid())
 ))
 WITH CHECK (user_id = (SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = (SELECT auth.uid())
 ));
CREATE POLICY "DJ owner deletes their sets" ON public.dj_setlists FOR DELETE TO authenticated
 USING (user_id = (SELECT auth.uid()) AND EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.user_id = (SELECT auth.uid())
 ));

CREATE OR REPLACE FUNCTION public.validate_dj_setlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_item jsonb;
  v_kind text;
  v_id uuid;
  v_raw text;
BEGIN
  IF v_actor IS NULL OR NEW.user_id IS DISTINCT FROM v_actor OR
    NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=NEW.profile_id AND p.user_id=v_actor)
  THEN
    RAISE EXCEPTION 'DJ setlist profile not owned by this account' USING ERRCODE='42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
      RAISE EXCEPTION 'DJ setlist ownership cannot be changed' USING ERRCODE='42501';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.version := OLD.version + 1;
  ELSE
    NEW.version := 1;
  END IF;

  IF jsonb_typeof(NEW.items) IS DISTINCT FROM 'array' OR
     jsonb_array_length(NEW.items) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'DJ setlist requires 1 to 30 tracks' USING ERRCODE='22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.items)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' OR
       (SELECT count(*) FROM jsonb_object_keys(v_item)) <> 2 OR
       jsonb_typeof(v_item->'source') IS DISTINCT FROM 'string' OR
       jsonb_typeof(v_item->'id') IS DISTINCT FROM 'string'
    THEN RAISE EXCEPTION 'Invalid DJ setlist item shape' USING ERRCODE='22023';
    END IF;
    v_kind := v_item->>'source';
    v_raw := v_item->>'id';
    IF v_raw !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
      RAISE EXCEPTION 'DJ track reference must be a UUID' USING ERRCODE='22023';
    END IF;
    v_id := v_raw::uuid;
    IF v_kind = 'game' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.songs s
        WHERE s.id = v_id
          AND COALESCE(s.archived, false) = false
          AND s.status IN ('recorded', 'released', 'completed', 'mastered')
          AND (s.audio_url IS NOT NULL OR s.extended_audio_url IS NOT NULL)
          AND (
            (s.profile_id = NEW.profile_id AND s.user_id = v_actor)
            OR (s.dj_use_allowed IS TRUE AND s.status IN ('recorded', 'released'))
          )
      ) THEN
        RAISE EXCEPTION 'DJ setlist song is unavailable or not permitted' USING ERRCODE='42501';
      END IF;
    ELSIF v_kind = 'admin' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.dj_audio_tracks t
        WHERE t.id = v_id AND t.is_active AND t.rights_confirmed
      ) THEN
        RAISE EXCEPTION 'DJ setlist club audio is unavailable or not cleared' USING ERRCODE='42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported DJ track source' USING ERRCODE='22023';
    END IF;
  END LOOP;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_dj_setlist() FROM PUBLIC;
DROP TRIGGER IF EXISTS validate_dj_setlist_on_write ON public.dj_setlists;
CREATE TRIGGER validate_dj_setlist_on_write
  BEFORE INSERT OR UPDATE ON public.dj_setlists
  FOR EACH ROW EXECUTE FUNCTION public.validate_dj_setlist();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dj_setlists TO authenticated;
COMMENT ON TABLE public.dj_setlists IS
  'Practice-only DJ set drafts. Rights are rechecked on save; future booked gigs must recheck and snapshot at show start. No payouts.';
