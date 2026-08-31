REVOKE ALL ON FUNCTION public.move_festival_artist_booking_slot(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.move_festival_artist_booking_slot(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.move_festival_artist_booking_slot(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.move_festival_artist_booking_slot(uuid, uuid, uuid) TO service_role;
