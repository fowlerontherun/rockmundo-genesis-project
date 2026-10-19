-- Disallow withdrawing an application after it becomes an active funded DJ booking.
CREATE OR REPLACE FUNCTION public.withdraw_nightclub_dj_application(p_application_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_actor uuid:=(select auth.uid());
 v_row public.dj_club_applications%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_application_id IS NULL THEN
  RAISE EXCEPTION 'Sign in to withdraw your DJ application' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_row FROM public.dj_club_applications
  WHERE id=p_application_id AND user_id=v_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'DJ application not owned by this account' USING ERRCODE='42501'; END IF;
 IF v_row.status='withdrawn' THEN RETURN v_row.id; END IF;
 -- Once a funded offer becomes a real gig, withdrawing the old interest
 -- application must not silently leave a confirmed calendar obligation.
 IF EXISTS(SELECT 1 FROM public.nightclub_dj_funded_offers f
  WHERE f.application_id=v_row.id AND f.booking_id IS NOT NULL
   AND f.status='booked') THEN
  RAISE EXCEPTION 'This application is booked; cancel the scheduled DJ gig instead'
   USING ERRCODE='22023';END IF;
 IF v_row.status NOT IN ('pending','shortlisted') THEN
  RAISE EXCEPTION 'Only open applications may be withdrawn' USING ERRCODE='22023'; END IF;
 UPDATE public.dj_club_applications SET status='withdrawn',updated_at=clock_timestamp()
 WHERE id=p_application_id;
 RETURN p_application_id;
END $function$
;