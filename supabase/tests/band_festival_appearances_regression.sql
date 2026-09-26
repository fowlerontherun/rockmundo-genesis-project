-- Run only in a disposable DB after applying the read-only Festival appearance
-- migration. Never impersonate a real member or mutate production bookings.
DO $tests$
DECLARE
  definition text;
BEGIN
  IF to_regprocedure('public.get_my_band_festival_appearances()') IS NULL THEN
    RAISE EXCEPTION 'Festival appearance RPC missing';
  END IF;

  IF has_function_privilege('anon', 'public.get_my_band_festival_appearances()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous callers must not read Festival member calendars';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_my_band_festival_appearances()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Active players cannot read their Festival appearances';
  END IF;

  SELECT pg_get_functiondef('public.get_my_band_festival_appearances()'::regprocedure)
    INTO definition;
  IF position('auth.uid() IS NULL' IN definition)=0
    OR position('public._caller_profile_id()' IN definition)=0
    OR position('member.profile_id=v_profile_id' IN definition)=0
    OR position('member.member_status=' IN definition)=0
    OR position('edition.status<>' IN definition)=0
    OR position('booking.status IN (' IN definition)=0
    OR position('festival_artist_booking_canonical_links' IN definition)=0
    OR position('coalesce(session.scheduled_start_at, slot.start_time)' IN definition)=0 THEN
    RAISE EXCEPTION 'Festival RPC missing a membership, booking or time-integrity guard';
  END IF;
END;
$tests$;
