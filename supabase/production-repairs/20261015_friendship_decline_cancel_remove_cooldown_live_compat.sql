-- Complete the cooldown slice of historical
-- 20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql.
-- Live does not have public.friendship_settings; do NOT replay full original.
-- This migration changes no existing friendships/audit events, no rewards,
-- cash, XP, messages, cron tasks or privacy settings.
DO $preflight$
BEGIN
 IF to_regclass('public.friendships') IS NULL
    OR to_regclass('public.social_relationship_audit') IS NULL
    OR to_regprocedure('public.send_friend_request(uuid,uuid)') IS NULL
    OR to_regprocedure('public.cancel_friend_request(uuid,uuid)') IS NULL
    OR to_regprocedure('public.get_connection_state(uuid,uuid)') IS NULL
    OR to_regprocedure('public.are_profiles_blocked(uuid,uuid)') IS NULL
 THEN RAISE EXCEPTION 'FRIENDSHIP_COOLDOWN_LIVE_DEPENDENCY_MISSING'; END IF;
 IF to_regprocedure('public.guard_friendship_pair_cooldown()') IS NOT NULL
 THEN RAISE EXCEPTION 'FRIENDSHIP_PAIR_COOLDOWN_ALREADY_PRESENT_RECONCILE'; END IF;
END $preflight$;

-- Deletions through the older cancel_friend_request RPC previously discarded
-- the relationship without recording that it had just been cancelled.
CREATE OR REPLACE FUNCTION public.cancel_friend_request(
 friendship_id uuid, requestor_profile_id uuid DEFAULT NULL::uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $cancel$
DECLARE
  v_row public.friendships%ROWTYPE;
  v_me uuid := coalesce(requestor_profile_id, public.current_profile_id());
BEGIN
 IF auth.uid() IS NULL OR v_me IS NULL
    OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id=v_me AND p.user_id=auth.uid()
         AND p.died_at IS NULL AND p.deleted_at IS NULL
    ) THEN RAISE EXCEPTION 'FRIEND_CANCEL_PROFILE_NOT_OWNED'
         USING ERRCODE='42501'; END IF;
 SELECT * INTO v_row FROM public.friendships
 WHERE id=friendship_id FOR UPDATE;
 IF NOT FOUND OR v_row.status::text<>'pending' THEN
    RAISE EXCEPTION 'FRIEND_REQUEST_NOT_PENDING' USING ERRCODE='55000';
 END IF;
 IF v_row.requestor_id IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'FRIEND_CANCEL_ONLY_REQUESTOR' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.social_relationship_audit
   (actor_profile_id,target_profile_id,friendship_id,action)
 VALUES (v_me,v_row.addressee_id,v_row.id,'friend_request_cancelled');
 DELETE FROM public.friendships WHERE id=v_row.id;
END
$cancel$;

-- A BEFORE trigger protects even future SQL/RPC paths that create or revive
-- pending requests without going through send_friend_request().
-- Existing accepted and pending friendship rows are not modified.
CREATE OR REPLACE FUNCTION public.guard_friendship_pair_cooldown()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
DECLARE
 v_recent timestamptz;
 v_new_pending boolean := false;
BEGIN
 IF TG_OP='INSERT' THEN
    v_new_pending := NEW.status::text='pending';
 ELSIF TG_OP='UPDATE' THEN
    v_new_pending := NEW.status::text='pending' AND (
      OLD.status::text IS DISTINCT FROM 'pending'
      OR OLD.requestor_id IS DISTINCT FROM NEW.requestor_id
      OR OLD.addressee_id IS DISTINCT FROM NEW.addressee_id
    );
 END IF;
 IF NOT v_new_pending THEN RETURN NEW; END IF;
 IF NEW.requestor_id IS NULL OR NEW.addressee_id IS NULL
    OR NEW.requestor_id=NEW.addressee_id THEN
    RAISE EXCEPTION 'FRIEND_REQUEST_INVALID_PAIR' USING ERRCODE='22023';
 END IF;

 SELECT max(a.created_at) INTO v_recent
 FROM public.social_relationship_audit a
 WHERE a.action IN (
   'friend_request_declined',
   'friend_request_cancelled',
   'friendship_removed',
   'friend_removed'
 )
 AND (
     (a.actor_profile_id=NEW.requestor_id
      AND a.target_profile_id=NEW.addressee_id)
     OR
     (a.actor_profile_id=NEW.addressee_id
      AND a.target_profile_id=NEW.requestor_id)
 );
 IF v_recent > now()-interval '24 hours' THEN
    RAISE EXCEPTION 'FRIEND_REQUEST_COOLDOWN_24H'
         USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END
$guard$;

DROP TRIGGER IF EXISTS guard_friendship_pair_cooldown
 ON public.friendships;
CREATE TRIGGER guard_friendship_pair_cooldown
 BEFORE INSERT OR UPDATE OF status,requestor_id,addressee_id
 ON public.friendships FOR EACH ROW
 EXECUTE FUNCTION public.guard_friendship_pair_cooldown();

CREATE OR REPLACE FUNCTION public.get_connection_state(
 target_profile_id uuid, viewer_profile_id uuid DEFAULT NULL::uuid
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $state$
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

REVOKE ALL ON FUNCTION public.guard_friendship_pair_cooldown()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_friendship_pair_cooldown()
 TO service_role;
REVOKE ALL ON FUNCTION public.cancel_friend_request(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_friend_request(uuid,uuid)
 TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_connection_state(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_connection_state(uuid,uuid)
 TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
