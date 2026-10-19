-- Verified-owner read-only preview of scheduled DJs, no mutation or payment permissions.
CREATE OR REPLACE FUNCTION public.get_owned_nightclub_dj_roster(p_owned_club_id uuid)
RETURNS TABLE (
 booking_id uuid, starts_at timestamptz, ends_at timestamptz,
 status text, dj_name text, set_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=public,pg_temp
AS $roster$
BEGIN
 IF (select auth.uid()) IS NULL OR p_owned_club_id IS NULL
 OR public.current_active_player_profile_id() IS NULL THEN
  RAISE EXCEPTION 'Active verified nightclub owner required' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.player_owned_nightclubs o
   JOIN public.nightclub_purchase_receipts receipt
     ON receipt.id=o.verified_purchase_id AND receipt.club_id=o.club_id
       AND receipt.profile_id=o.profile_id
   JOIN public.profiles owner ON owner.id=o.profile_id
    WHERE o.id=p_owned_club_id
      AND owner.user_id=(select auth.uid())
      AND o.profile_id=public.current_active_player_profile_id()
 ) THEN RAISE EXCEPTION 'Nightclub owner booking roster requires verified purchase'
  USING ERRCODE='42501'; END IF;

 RETURN QUERY
 SELECT b.id,b.starts_at,b.ends_at,b.status,
   coalesce(nullif(trim(performer.display_name),''),'RockMundo DJ')::text,
   coalesce(nullif(trim(setlist.name),''),'Saved DJ set')::text
 FROM public.player_owned_nightclubs o
 JOIN public.dj_bookings b ON b.club_id=o.club_id
 JOIN public.profiles performer ON performer.id=b.profile_id
 JOIN public.dj_setlists setlist ON setlist.id=b.setlist_id
 WHERE o.id=p_owned_club_id
   AND b.status IN ('booked','ready','live','resolving')
   AND b.ends_at>=clock_timestamp()-interval '1 hour'
 ORDER BY b.starts_at
 LIMIT 30;
END;
$roster$;
REVOKE ALL ON FUNCTION public.get_owned_nightclub_dj_roster(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_owned_nightclub_dj_roster(uuid) TO authenticated;
COMMENT ON FUNCTION public.get_owned_nightclub_dj_roster(uuid) IS
'Only current active character with receipt-verified ownership may preview booked DJ names/time/status. No booking approval, fee or payout rights.';