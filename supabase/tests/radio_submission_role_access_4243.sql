-- #4243: check real PostgREST authenticated-role RLS, not table grants
-- alone. Ordinary players cannot edit radio outcomes; admins still can.
-- All writes inside the fixture are discarded by ROLLBACK.
BEGIN;
CREATE TEMP TABLE radio_role_fixture ON COMMIT DROP AS
SELECT
 (SELECT sub.user_id FROM public.radio_submissions sub
  WHERE sub.user_id IS NOT NULL AND sub.status='accepted'
    AND NOT public.has_role(sub.user_id,'admin'::public.app_role)
  ORDER BY sub.id LIMIT 1) AS non_admin_id,
 (SELECT sub.user_id FROM public.radio_submissions sub
  WHERE sub.user_id IS NOT NULL AND sub.status='accepted'
    AND public.has_role(sub.user_id,'admin'::public.app_role)
  ORDER BY sub.id LIMIT 1) AS admin_id;

DO $fixtures$
BEGIN
 IF (SELECT non_admin_id IS NULL OR admin_id IS NULL FROM radio_role_fixture) THEN
   RAISE EXCEPTION 'RADIO_TEST_MISSING_ROLE_FIXTURES';
 END IF;
END;
$fixtures$;

SELECT set_config('request.jwt.claim.sub',
 (SELECT non_admin_id::text FROM radio_role_fixture),true);
SET LOCAL ROLE authenticated;
DO $non_admin$
DECLARE v_count integer;
BEGIN
 UPDATE public.radio_submissions SET status='pending'
 WHERE user_id=auth.uid() AND status='accepted';
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>0 THEN
   RAISE EXCEPTION 'RADIO_PLAYER_CAN_FORGE_REVIEW';
 END IF;
 RAISE NOTICE 'radio non-admin RLS prevents review writes';
END;
$non_admin$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub',
 (SELECT admin_id::text FROM radio_role_fixture),true);
SET LOCAL ROLE authenticated;
DO $admin$
DECLARE v_count integer;
BEGIN
 UPDATE public.radio_submissions SET status='pending'
 WHERE id=(SELECT sub.id FROM public.radio_submissions sub
   WHERE sub.user_id=auth.uid() AND sub.status='accepted'
   ORDER BY sub.id LIMIT 1);
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN
   RAISE EXCEPTION 'RADIO_ADMIN_REVIEW_MUTATION_BLOCKED';
 END IF;
 RAISE NOTICE 'existing legitimate admin radio review remains permitted';
END;
$admin$;
RESET ROLE;

SELECT 'PASS — normal players denied; admin update preserved; rollback' AS result;
ROLLBACK;
