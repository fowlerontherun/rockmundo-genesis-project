-- Run only AFTER deploying the teaching migration. Read-only ACL and
-- unauthorized-RPC checks; the outer transaction rolls back any test state.
BEGIN;
DO $$
BEGIN
  IF has_table_privilege('authenticated','public.player_teaching_sessions','INSERT')
    OR has_table_privilege('authenticated','public.player_teaching_sessions','UPDATE')
    OR has_table_privilege('authenticated','public.player_teaching_sessions','DELETE') THEN
    RAISE EXCEPTION 'teaching_table_mutation_still_public';
  END IF;
  IF has_table_privilege('authenticated','public.player_teaching_reward_ledger','INSERT')
    OR has_table_privilege('authenticated','public.player_teaching_reward_ledger','UPDATE') THEN
    RAISE EXCEPTION 'teaching_receipt_mutation_public';
  END IF;
  IF NOT has_function_privilege('authenticated','public.request_teaching_lesson(uuid,uuid,text,integer)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.respond_teaching_lesson(uuid,uuid,boolean)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.cancel_teaching_lesson(uuid,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'teaching_public_api_missing';
  END IF;
  IF has_function_privilege('authenticated','public.settle_due_teaching_lessons(integer)','EXECUTE')
    OR has_function_privilege('anon','public.settle_due_teaching_lessons(integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.grant_teaching_skill_xp(uuid,text,integer)','EXECUTE') THEN
    RAISE EXCEPTION 'teaching_settlement_exposed';
  END IF;
  IF (SELECT count(*) FROM cron.job WHERE jobname='settle-player-teaching' AND active) <> 1 THEN
    RAISE EXCEPTION 'teaching_cron_missing_or_duplicate';
  END IF;
  IF (SELECT count(*) FROM pg_policies
    WHERE schemaname='public' AND tablename='player_teaching_sessions'
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')) > 0 THEN
    RAISE EXCEPTION 'unsafe_teaching_rls_policy_remains';
  END IF;
  IF EXISTS (SELECT 1 FROM public.player_teaching_sessions
    WHERE accepted_at IS NULL AND status IN ('scheduled','in_progress','completed')) THEN
    RAISE EXCEPTION 'unverified_legacy_teaching_session_could_settle';
  END IF;
END
$$;
SET LOCAL ROLE authenticated;
-- With no authenticated JWT, even the intentionally exposed invite API must
-- fail closed before reading or writing a privileged session.
DO $$
BEGIN
  BEGIN
    PERFORM public.request_teaching_lesson(
      NULL::uuid,NULL::uuid,'teaching_basic_teaching',1);
    RAISE EXCEPTION 'anonymous_teaching_request_was_accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    PERFORM public.respond_teaching_lesson(NULL::uuid,NULL::uuid,true);
    RAISE EXCEPTION 'anonymous_teaching_accept_was_allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END
$$;
RESET ROLE;
ROLLBACK;
