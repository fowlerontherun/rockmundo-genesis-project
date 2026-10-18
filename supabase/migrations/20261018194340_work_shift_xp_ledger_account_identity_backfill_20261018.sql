-- Repair identity only; no re-award of XP, cash, fame or work shifts.
-- Each work_shift XP entry belongs to its profile's owning auth account.
DO $repair$
DECLARE v_expected integer;
DECLARE v_updated integer;
BEGIN
 SELECT count(*) INTO v_expected
 FROM public.experience_ledger e
 JOIN public.profiles p ON p.id=e.profile_id
 WHERE e.activity_type='work_shift' AND e.user_id IS DISTINCT FROM p.user_id;
 IF EXISTS (
   SELECT 1 FROM public.experience_ledger e
   LEFT JOIN public.profiles p ON p.id=e.profile_id
   LEFT JOIN auth.users u ON u.id=p.user_id
   WHERE e.activity_type='work_shift' AND (p.id IS NULL OR u.id IS NULL)
 ) THEN RAISE EXCEPTION 'Unverifiable historical work-shift XP owner; abort';
 END IF;

 UPDATE public.experience_ledger e
 SET user_id=p.user_id
 FROM public.profiles p
 WHERE e.activity_type='work_shift'
   AND e.profile_id=p.id
   AND e.user_id IS DISTINCT FROM p.user_id;
 GET DIAGNOSTICS v_updated=ROW_COUNT;
 IF v_updated IS DISTINCT FROM v_expected THEN
   RAISE EXCEPTION 'Expected %s work-shift account updates, got %s',v_expected,v_updated;
 END IF;
 IF EXISTS (
   SELECT 1 FROM public.experience_ledger e
   JOIN public.profiles p ON p.id=e.profile_id
   WHERE e.activity_type='work_shift' AND e.user_id IS DISTINCT FROM p.user_id
 ) THEN RAISE EXCEPTION 'Some work-shift account IDs remain incorrect'; END IF;
 RAISE NOTICE 'Corrected % existing work-shift account IDs without granting XP',v_updated;
END;
$repair$;