-- DJ booking reverse guard: never permit a new/rescheduled band gig
-- to silently supersede an existing character-level DJ reservation.
-- Membership changes and DJ-booking forwards checks are handled separately.

CREATE OR REPLACE FUNCTION public.guard_dj_reverse_band_gig_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
 v_member record;
 v_start timestamptz;
 v_end timestamptz;
BEGIN
 IF NEW.status::text NOT IN ('scheduled','confirmed','in_progress')
 THEN RETURN NEW; END IF;

 v_start:=NEW.scheduled_date;
 v_end:=COALESCE(NEW.scheduled_end,NEW.scheduled_date+interval '2 hours');
 IF NEW.band_id IS NULL THEN RETURN NEW; END IF;

 -- Sorted lock order is shared with the DJ reservation, rehearsals, tour,
 -- membership and Schedule guards to prevent concurrent double bookings.
 FOR v_member IN
  SELECT DISTINCT bm.profile_id
  FROM public.band_members bm
  WHERE bm.band_id=NEW.band_id
    AND bm.member_status='active'
    AND bm.profile_id IS NOT NULL
  ORDER BY bm.profile_id
 LOOP
   PERFORM public._dj_assert_no_reserved_slot(
      v_member.profile_id,v_start,v_end,'Band gig');
 END LOOP;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_dj_reverse_band_gig_write() FROM PUBLIC;

DROP TRIGGER IF EXISTS aa_dj_reverse_band_gig_write ON public.gigs;
-- Alphabetical first trigger: reject conflict before other gig booking
-- preparation, ticket seeding or contract side effects occur.
CREATE TRIGGER aa_dj_reverse_band_gig_write
 BEFORE INSERT OR UPDATE OF band_id,status,scheduled_date,scheduled_end
 ON public.gigs FOR EACH ROW
 EXECUTE FUNCTION public.guard_dj_reverse_band_gig_write();

COMMENT ON FUNCTION public.guard_dj_reverse_band_gig_write() IS
 'Reject booked/confirmed/live band gig writes that conflict with a band member DJ slot. Server-authoritative, no payout changes.';
