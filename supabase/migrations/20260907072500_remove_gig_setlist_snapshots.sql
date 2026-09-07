-- Gigs should reference a reusable band setlist directly.
-- Do not create per-gig rows in public.setlists. The internal gig_setlists mirror
-- remains available for preparation/readiness code, but it is refreshed from the
-- selected reusable setlist whenever that setlist changes.

DROP TRIGGER IF EXISTS trg_gig_setlists_sync_legacy ON public.gig_setlists;
DROP TRIGGER IF EXISTS trg_gig_setlist_items_sync_legacy ON public.gig_setlist_items;

CREATE OR REPLACE FUNCTION public.sync_gig_snapshot_legacy_setlist(p_gig_setlist_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  -- Legacy compatibility no-op. Per-gig execution snapshots in public.setlists
  -- were creating a new hidden setlist for every booking. gigs.setlist_id is now
  -- the authoritative reusable setlist reference.
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_gig_snapshot_legacy_setlist(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_gig_snapshot_legacy_setlist(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_upcoming_gigs_for_setlist(p_setlist_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  IF p_setlist_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT g.id
    FROM public.gigs g
    WHERE g.setlist_id = p_setlist_id
      AND g.status::text IN ('scheduled', 'confirmed')
  LOOP
    PERFORM public.ensure_gig_preparation_from_booked_setlist(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_upcoming_gigs_for_setlist(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_upcoming_gigs_for_setlist(uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.trg_refresh_gigs_for_reusable_setlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_setlist_id uuid;
BEGIN
  v_setlist_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.setlist_id ELSE NEW.setlist_id END;
  PERFORM public.refresh_upcoming_gigs_for_setlist(v_setlist_id);

  IF TG_OP = 'UPDATE' AND OLD.setlist_id IS DISTINCT FROM NEW.setlist_id THEN
    PERFORM public.refresh_upcoming_gigs_for_setlist(OLD.setlist_id);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_refresh_gigs_for_reusable_setlist()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_setlist_songs_refresh_booked_gigs ON public.setlist_songs;
CREATE TRIGGER trg_setlist_songs_refresh_booked_gigs
AFTER INSERT OR UPDATE OR DELETE
ON public.setlist_songs
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_gigs_for_reusable_setlist();

CREATE OR REPLACE FUNCTION public.trg_refresh_gigs_for_setlist_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    PERFORM public.refresh_upcoming_gigs_for_setlist(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.trg_refresh_gigs_for_setlist_metadata()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_setlists_refresh_booked_gigs ON public.setlists;
CREATE TRIGGER trg_setlists_refresh_booked_gigs
AFTER UPDATE OF name, is_active
ON public.setlists
FOR EACH ROW
EXECUTE FUNCTION public.trg_refresh_gigs_for_setlist_metadata();

-- Refresh all upcoming gigs from their selected reusable setlist so any stale
-- preparation mirrors created by the old snapshot model are immediately corrected.
DO $refresh$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id
    FROM public.gigs
    WHERE setlist_id IS NOT NULL
      AND status::text IN ('scheduled', 'confirmed')
  LOOP
    PERFORM public.ensure_gig_preparation_from_booked_setlist(r.id);
  END LOOP;
END;
$refresh$;

-- Remove the old hidden compatibility setlists where they are no longer referenced.
-- Any legacy row still referenced by an old/orphaned gig is retained for safety but
-- is inactive and excluded from player-facing setlist queries.
DELETE FROM public.setlists s
WHERE (
    s.setlist_type = 'gig_snapshot'
    OR s.name LIKE '__gig_snapshot_%'
    OR s.description IN (
      'Internal compatibility mirror of the booked gig setlist snapshot.',
      'Gig-specific execution snapshot'
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.gigs g WHERE g.setlist_id = s.id
  );

COMMENT ON FUNCTION public.refresh_upcoming_gigs_for_setlist(uuid) IS
  'Refreshes internal gig preparation mirrors for upcoming gigs that reference the reusable setlist. No new public.setlists row is created.';
