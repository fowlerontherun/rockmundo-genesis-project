-- Forward-only correction after 20261015204607: PostgreSQL SQL statements
-- can interpret target_profile_id both as the function parameter and as
-- social_relationship_audit.target_profile_id. Explicitly prefer PL/pgSQL
-- variables for unqualified parameter references (qualified a.column still
-- resolves to table alias a). No data, access policy, trigger or history edits.
DO $preflight$
BEGIN
 IF to_regprocedure('public.get_connection_state(uuid,uuid)') IS NULL
    OR to_regprocedure('public.guard_friendship_pair_cooldown()') IS NULL
 THEN RAISE EXCEPTION 'FRIEND_COOLDOWN_PARAMETER_FIX_DEPENDENCIES_MISSING'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.get_connection_state(
 target_profile_id uuid, viewer_profile_id uuid DEFAULT NULL::uuid
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $state$
#variable_conflict use_variable
DECLARE
 v_me uuid := coalesce(viewer_profile_id,public.current_profile_id());
 v_row public.friendships%ROWTYPE;
 v_recent timestamptz;
BEGIN
 IF auth.uid() IS NULL OR v_me IS NULL OR target_profile_id IS NULL
    OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id=v_me AND p.user_id=auth.uid()
         AND p.died_at IS NULL AND p.deleted_at IS NULL
    ) THEN RETURN 'unavailable'; END IF;
 IF v_me=target_profile_id THEN RETURN 'self'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id=target_profile_id AND p.died_at IS NULL
     AND p.deleted_at IS NULL
 ) THEN RETURN 'unavailable'; END IF;
 IF public.are_profiles_blocked(v_me,target_profile_id) THEN
   RETURN 'restricted'; END IF;

 SELECT * INTO v_row FROM public.friendships f
 WHERE (f.requestor_id=v_me AND f.addressee_id=target_profile_id)
    OR (f.requestor_id=target_profile_id AND f.addressee_id=v_me)
 ORDER BY f.updated_at DESC NULLS LAST,f.created_at DESC
 LIMIT 1;

 IF v_row.status::text='accepted' THEN RETURN 'friends'; END IF;
 IF v_row.status::text='pending' AND v_row.requestor_id=v_me
 THEN RETURN 'outgoing_pending'; END IF;
 IF v_row.status::text='pending' AND v_row.addressee_id=v_me
 THEN RETURN 'incoming_pending'; END IF;
 IF v_row.status::text='blocked' THEN RETURN 'restricted'; END IF;

 SELECT max(a.created_at) INTO v_recent
 FROM public.social_relationship_audit a
 WHERE a.action IN (
   'friend_request_declined',
   'friend_request_cancelled',
   'friendship_removed',
   'friend_removed'
 ) AND (
    (a.actor_profile_id=v_me AND a.target_profile_id=target_profile_id)
    OR (a.actor_profile_id=target_profile_id AND a.target_profile_id=v_me)
 );
 IF v_recent > now()-interval '24 hours' THEN
   RETURN 'request_cooldown'; END IF;
 RETURN 'not_connected';
END
$state$;

REVOKE ALL ON FUNCTION public.get_connection_state(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_connection_state(uuid,uuid)
 TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
