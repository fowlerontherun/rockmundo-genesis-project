-- Role-level auth/permission test: safely skip if fresh test DB has no player fixtures.
BEGIN;
SELECT set_config('request.jwt.claim.sub',coalesce((
 SELECT p.user_id::text FROM public.player_owned_nightclubs o JOIN public.profiles p ON p.id=o.profile_id
 WHERE p.is_active=true AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.nightclub_staff s WHERE s.owned_club_id=o.id)
 ORDER BY o.created_at DESC LIMIT 1),''),true);
SELECT set_config('app.nightclub_staff_test_club',coalesce((
 SELECT o.id::text FROM public.player_owned_nightclubs o JOIN public.profiles p ON p.id=o.profile_id
 WHERE p.is_active=true AND p.died_at IS NULL AND p.user_id IS NOT NULL
 AND EXISTS(SELECT 1 FROM public.nightclub_staff s WHERE s.owned_club_id=o.id)
 ORDER BY o.created_at DESC LIMIT 1),''),true);
SET LOCAL ROLE authenticated;
DO $real_role$
DECLARE
 raw_id text:=current_setting('app.nightclub_staff_test_club',true);
 cid uuid; hired jsonb; dismissed jsonb;
BEGIN
 IF raw_id IS NULL OR raw_id='' THEN
  RAISE NOTICE 'Fresh database has no active staffed club; role-level test skipped';
  RETURN;
 END IF;
 cid:=raw_id::uuid;
 IF (SELECT count(*) FROM public.nightclub_staff WHERE owned_club_id=cid)=0 THEN
  RAISE EXCEPTION 'Authenticated owner cannot read own club staff through RLS';
 END IF;
 BEGIN
  INSERT INTO public.nightclub_staff(owned_club_id,staff_type,name,skill_level,salary_weekly)
   VALUES(cid,'dj','Forbidden Direct Write',1,1);
  RAISE EXCEPTION 'Browser role inserted staff with arbitrary salary';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 hired:=public.nightclub_staff_action_atomic(cid,'hire',gen_random_uuid(),'dj','Role Fixture DJ',1,NULL);
 IF (hired->>'salary_weekly')::integer<>400 OR (hired->>'still_employed')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Authenticated hire RPC failed its contract'; END IF;
 dismissed:=public.nightclub_staff_action_atomic(cid,'fire',gen_random_uuid(),NULL,NULL,NULL,(hired->>'staff_id')::uuid);
 IF (dismissed->>'still_employed')::boolean IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'Authenticated fire RPC failed its contract'; END IF;
END $real_role$;
ROLLBACK;
