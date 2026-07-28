-- Booking a future gig is not an action at the caller's current location. Replace
-- the legacy trigger, which rejected all gig INSERTs while the caller was travelling
-- now, with an interval check for the active band's real members.
DROP TRIGGER IF EXISTS prevent_gig_booking_while_traveling ON public.gigs;

CREATE OR REPLACE FUNCTION public.check_gig_member_schedule_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_end timestamptz := COALESCE(NEW.scheduled_end, NEW.scheduled_date + interval '3 hours');
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.player_scheduled_activities a
    WHERE a.status IN ('scheduled', 'in_progress')
      AND a.scheduled_start < v_end
      AND a.scheduled_end > NEW.scheduled_date
      AND a.profile_id IN (
        SELECT COALESCE(bm.profile_id, member_profile.id)
        FROM public.band_members bm
        LEFT JOIN public.profiles member_profile ON member_profile.user_id = bm.user_id
        WHERE bm.band_id = NEW.band_id
          AND COALESCE(bm.member_status, 'active') = 'active'
          AND COALESCE(bm.is_touring_member, false) = false
          AND COALESCE(bm.profile_id, member_profile.id) IS NOT NULL
        UNION
        SELECT leader_profile.id
        FROM public.bands b
        JOIN public.profiles leader_profile
          ON leader_profile.id = b.leader_id OR leader_profile.user_id = b.leader_id
        WHERE b.id = NEW.band_id
      )
  ) THEN
    RAISE EXCEPTION 'gig_booking_band_conflict' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_gig_member_schedule_conflicts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_gig_member_schedule_conflicts() TO authenticated, service_role;

CREATE TRIGGER check_gig_member_schedule_conflicts
  BEFORE INSERT ON public.gigs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_gig_member_schedule_conflicts();
