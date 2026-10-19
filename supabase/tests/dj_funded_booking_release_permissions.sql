-- Only service-role JWT verification can convert escrow to playable DJ bookings.
BEGIN;
DO $acl$
BEGIN
 IF has_function_privilege('authenticated',
   'public.confirm_accepted_nightclub_dj_offer_internal(uuid,uuid)','EXECUTE')
 OR has_function_privilege('authenticated',
   'public.dj_verified_funded_offer_booking_service(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon',
   'public.cancel_owned_funded_dj_booking(uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role',
   'public.dj_verified_funded_offer_booking_service(uuid,uuid,uuid)','EXECUTE')
 OR NOT has_function_privilege('authenticated',
   'public.cancel_owned_funded_dj_booking(uuid,uuid)','EXECUTE') THEN
  RAISE EXCEPTION 'Funded booking privilege boundary is incorrect';
 END IF;
END $acl$;
SET LOCAL ROLE authenticated;
DO $actor$
BEGIN
 BEGIN
   PERFORM public.confirm_accepted_nightclub_dj_offer_internal(gen_random_uuid(),gen_random_uuid());
   RAISE EXCEPTION 'Browser role bypassed funded booking release gate';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.dj_verified_funded_offer_booking_service(
    gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
   RAISE EXCEPTION 'Browser role can impersonate a DJ via service-only gateway';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF has_table_privilege('authenticated','public.nightclub_dj_funded_offers','UPDATE')
 OR has_table_privilege('authenticated','public.dj_bookings','INSERT') THEN
  RAISE EXCEPTION 'Browser can directly forge DJ booking or escrow state';
 END IF;
 RAISE NOTICE 'DJ funded booking remains server-only behind dual release flags';
END $actor$;
ROLLBACK;