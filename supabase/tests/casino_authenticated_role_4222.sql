-- P0 #4222: execute as the same SQL role used by real browser sessions.
-- All wallet, addiction and receipt changes roll back.
BEGIN;
DO $fixture$
DECLARE v_user uuid;
BEGIN
 SELECT p.user_id INTO v_user FROM public.profiles p
 WHERE p.cash>=100 AND p.is_active IS TRUE AND p.died_at IS NULL AND p.deleted_at IS NULL
   AND p.id=(SELECT p2.id FROM public.profiles p2
     WHERE p2.user_id=p.user_id AND p2.is_active IS TRUE AND p2.died_at IS NULL
     ORDER BY p2.updated_at DESC NULLS LAST,p2.created_at DESC NULLS LAST,p2.id LIMIT 1)
 ORDER BY p.user_id LIMIT 1;
 IF v_user IS NULL THEN RAISE EXCEPTION 'No eligible casino fixture character'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_user::text,true);
END;
$fixture$;
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE casino_authenticated_receipt AS
SELECT public.play_casino_round_authoritative(
  'slots',10,'{}'::jsonb,'4f6de111-486a-4bce-ad14-fb3d85ce2111'::uuid) result;

SELECT
 (SELECT result->>'roundId' IS NOT NULL FROM casino_authenticated_receipt) browser_role_settled,
 (SELECT jsonb_array_length(result#>'{outcome,reels}')=3 FROM casino_authenticated_receipt) browser_received_reels,
 (SELECT count(*)=1 FROM public.casino_transactions
     WHERE profile_id=public.current_active_player_profile_id()
       AND metadata->>'request_id'='4f6de111-486a-4bce-ad14-fb3d85ce2111') browser_can_read_own_audit,
 NOT has_table_privilege('authenticated','public.casino_transactions','INSERT') browser_direct_insert_denied,
 NOT has_function_privilege('authenticated','public.play_casino_round(text,numeric,numeric,jsonb)','EXECUTE') browser_old_rpc_denied;

RESET ROLE;
ROLLBACK;
