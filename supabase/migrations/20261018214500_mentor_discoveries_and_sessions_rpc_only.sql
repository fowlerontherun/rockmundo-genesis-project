-- Mentor discovery and booking are trusted atomic server operations.
-- Client INSERT grants on underlying tables bypass discovery conditions and
-- allow fabricated session history despite the secure RPC flow.
-- Applied directly to live Supabase on 18 October 2026 and verified.
-- Keep authenticated SELECT policies intact for the Mentors UI.
REVOKE INSERT ON TABLE public.player_master_discoveries
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT ON TABLE public.player_mentor_sessions
  FROM PUBLIC, anon, authenticated;

-- Obsolete policies are not a valid substitute for revoking table INSERT:
-- they only checked that the client owned the character.
DROP POLICY IF EXISTS "Users can insert own discoveries"
  ON public.player_master_discoveries;
DROP POLICY IF EXISTS "Users can create their own sessions"
  ON public.player_mentor_sessions;

-- The following SECURITY DEFINER RPCs, owned by postgres, remain callable:
-- public.discover_master(uuid,uuid,text,jsonb)
-- public.book_mentor_session_atomic(uuid,uuid)
-- Their ownership, availability, XP, funds and cooldown checks remain intact.
DO $check$
BEGIN
 IF has_table_privilege('authenticated','public.player_master_discoveries','INSERT')
 OR has_table_privilege('authenticated','public.player_mentor_sessions','INSERT')
 OR has_table_privilege('anon','public.player_master_discoveries','INSERT')
 OR has_table_privilege('anon','public.player_mentor_sessions','INSERT')
 THEN RAISE EXCEPTION 'Mentor base tables still expose direct INSERT to clients'; END IF;
 IF NOT has_table_privilege('authenticated','public.player_master_discoveries','SELECT')
 OR NOT has_table_privilege('authenticated','public.player_mentor_sessions','SELECT')
 THEN RAISE EXCEPTION 'Legitimate mentor client reads were revoked'; END IF;
 IF NOT has_function_privilege('authenticated','public.discover_master(uuid,uuid,text,jsonb)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.book_mentor_session_atomic(uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Legitimate mentor RPC grants were lost'; END IF;
END $check$;
