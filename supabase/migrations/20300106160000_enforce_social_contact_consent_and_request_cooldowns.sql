
-- Recipient consent, request cooldowns and clear friendship lifecycle.
-- Must run after the canonical friendship, direct-message and social-safety
-- migrations. Never rely solely on frontend buttons for privacy restrictions.
BEGIN;

ALTER TYPE public.profile_dm_permission ADD VALUE IF NOT EXISTS 'friends_and_band';
ALTER TYPE public.profile_dm_permission ADD VALUE IF NOT EXISTS 'existing_conversations';

-- All direct-message write paths, including idempotent fallback, use this
-- recipient policy.  Preferences are read as text so newly-added enum values
-- can be used in the same deployment transaction.
CREATE OR REPLACE FUNCTION public.can_profile_receive_dm(
  sender_profile_id uuid, recipient_profile_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_preference text;
  v_friends boolean;
BEGIN
  IF sender_profile_id IS NULL OR recipient_profile_id IS NULL
     OR sender_profile_id = recipient_profile_id
     OR public.are_profiles_blocked(sender_profile_id, recipient_profile_id) THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = recipient_profile_id AND p.deleted_at IS NULL AND p.died_at IS NULL
  ) THEN RETURN false; END IF;

  SELECT COALESCE(pps.dm_permission::text, 'friends') INTO v_preference
  FROM public.profile_privacy_settings pps
  WHERE pps.profile_id = recipient_profile_id;
  v_preference := COALESCE(v_preference, 'friends');
  IF v_preference = 'none' THEN RETURN false; END IF;
  IF v_preference = 'everyone' THEN RETURN true; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'::public.friendship_status
      AND ((f.requestor_id = sender_profile_id AND f.addressee_id = recipient_profile_id)
        OR (f.addressee_id = sender_profile_id AND f.requestor_id = recipient_profile_id))
  ) INTO v_friends;

  IF v_preference IN ('friends', 'friends_and_band') AND v_friends THEN RETURN true; END IF;
  IF v_preference = 'friends' THEN RETURN false; END IF;

  IF v_preference = 'friends_and_band' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.band_members mine
      JOIN public.band_members theirs ON theirs.band_id = mine.band_id
      WHERE mine.profile_id = sender_profile_id
        AND theirs.profile_id = recipient_profile_id
        AND mine.member_status = 'active' AND theirs.member_status = 'active'
        AND COALESCE(mine.is_touring_member, false) = false
        AND COALESCE(theirs.is_touring_member, false) = false
    );
  END IF;
  IF v_preference = 'existing_conversations' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants mine
        ON mine.conversation_id = c.id AND mine.profile_id = sender_profile_id
      JOIN public.conversation_participants theirs
        ON theirs.conversation_id = c.id AND theirs.profile_id = recipient_profile_id
      WHERE c.type = 'direct' AND COALESCE(c.is_closed, false) = false
    );
  END IF;
  RETURN false;
END;
$$;

-- This is the canonical write guard. Even legacy SQL functions that check
-- blocks only, direct table inserts and fallback-send RPCs cannot bypass
-- recipient consent; group-conversation writes remain governed by their
-- separate group-membership permissions.
CREATE OR REPLACE FUNCTION public.guard_direct_message_recipient_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
BEGIN
  IF NEW.recipient_profile_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.conversation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = NEW.conversation_id AND c.type = 'group'
  ) THEN RETURN NEW; END IF;

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.sender_profile_id AND p.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_profile_receive_dm(NEW.sender_profile_id, NEW.recipient_profile_id) THEN
    RAISE EXCEPTION 'Messaging is unavailable for this conversation.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_direct_message_recipient_consent ON public.direct_messages;
CREATE TRIGGER guard_direct_message_recipient_consent
BEFORE INSERT OR UPDATE OF sender_profile_id, recipient_profile_id, conversation_id
ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_message_recipient_consent();

-- Every path that creates/renews a friendship uses a serialized pair lock,
-- respecting the recipient's opt-out and 24h decline/cancel/remove cooldown.
CREATE OR REPLACE FUNCTION public.send_friend_request(
  target_profile_id uuid, requestor_profile_id uuid DEFAULT NULL::uuid
) RETURNS public.friendships
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_variable
DECLARE
  v_me uuid := public._assert_owned_profile(COALESCE(requestor_profile_id, public.current_profile_id()));
  v_target uuid := target_profile_id;
  v_row public.friendships%ROWTYPE;
  v_mode text;
  v_recent_action timestamptz;
  v_pair text;
BEGIN
  IF auth.uid() IS NULL OR v_me IS NULL THEN
    RAISE EXCEPTION 'active_profile_required' USING ERRCODE='42501';
  END IF;
  IF v_target IS NULL OR v_me = v_target THEN
    RAISE EXCEPTION 'Choose another player to add as a friend.' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=v_target
      AND p.deleted_at IS NULL AND p.died_at IS NULL
  ) THEN RAISE EXCEPTION 'That player could not be found.' USING ERRCODE='22023'; END IF;
  IF public.are_profiles_blocked(v_me, v_target) THEN
    RAISE EXCEPTION 'This player is not available for friend requests.' USING ERRCODE='42501';
  END IF;

  -- Concurrent requests for the same unordered pair must see each other's
  -- terminal state and cannot both create a fresh pending invitation.
  v_pair := LEAST(v_me::text, v_target::text) || ':' || GREATEST(v_me::text, v_target::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(v_pair, 0));

  SELECT f.* INTO v_row FROM public.friendships f
  WHERE (f.requestor_id=v_me AND f.addressee_id=v_target)
     OR (f.requestor_id=v_target AND f.addressee_id=v_me)
  ORDER BY f.updated_at DESC NULLS LAST, f.created_at DESC LIMIT 1 FOR UPDATE;

  IF v_row.id IS NOT NULL AND v_row.status='accepted'::public.friendship_status THEN
    RETURN v_row;
  END IF;

  -- Permission must be checked before reviving an old row and before
  -- auto-accepting a request in the reverse direction.
  SELECT COALESCE(fs.allow_friend_requests, 'everyone')
    INTO v_mode FROM public.friendship_settings fs WHERE fs.profile_id=v_target;
  IF COALESCE(v_mode, 'everyone') = 'none' THEN
    RAISE EXCEPTION 'This player is not available for friend requests.' USING ERRCODE='42501';
  END IF;

  SELECT max(a.created_at) INTO v_recent_action
  FROM public.social_relationship_audit a
  WHERE a.action IN ('friend_request_declined', 'friend_request_cancelled', 'friend_removed')
    AND ((a.actor_profile_id=v_me AND a.target_profile_id=v_target)
      OR (a.actor_profile_id=v_target AND a.target_profile_id=v_me));
  v_recent_action := GREATEST(
    COALESCE(v_recent_action, '-infinity'::timestamptz),
    CASE WHEN v_row.status::text='declined' THEN COALESCE(v_row.declined_at,v_row.responded_at,v_row.updated_at) ELSE '-infinity'::timestamptz END,
    CASE WHEN v_row.status::text='cancelled' THEN COALESCE(v_row.cancelled_at,v_row.responded_at,v_row.updated_at) ELSE '-infinity'::timestamptz END,
    CASE WHEN v_row.status::text='removed' THEN COALESCE(v_row.removed_at,v_row.responded_at,v_row.updated_at) ELSE '-infinity'::timestamptz END
  );
  IF v_recent_action > now() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Friend request declined or cancelled recently. Please wait before trying again.' USING ERRCODE='42901';
  END IF;

  IF v_row.id IS NOT NULL THEN
    IF v_row.status='pending'::public.friendship_status THEN
      IF v_row.addressee_id=v_me THEN
        UPDATE public.friendships f SET status='accepted'::public.friendship_status,
          responded_at=now(), accepted_at=now(), updated_at=now()
        WHERE f.id=v_row.id RETURNING * INTO v_row;
        INSERT INTO public.social_relationship_audit(actor_profile_id,target_profile_id,friendship_id,action)
          VALUES (v_me,v_target,v_row.id,'friend_request_accepted');
      END IF;
      RETURN v_row;
    END IF;
    IF v_row.status='blocked'::public.friendship_status THEN
      RAISE EXCEPTION 'This player is unavailable.' USING ERRCODE='42501';
    END IF;
    UPDATE public.friendships f
      SET requestor_id=v_me, addressee_id=v_target, status='pending'::public.friendship_status,
          responded_at=NULL, accepted_at=NULL, declined_at=NULL, cancelled_at=NULL,
          removed_at=NULL, updated_at=now()
    WHERE f.id=v_row.id RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.friendships (requestor_id,addressee_id,status)
      VALUES (v_me,v_target,'pending'::public.friendship_status)
    RETURNING * INTO v_row;
  END IF;
  INSERT INTO public.social_relationship_audit(actor_profile_id,target_profile_id,friendship_id,action)
    VALUES (v_me,v_target,v_row.id,'friend_request_sent');
  RETURN v_row;
END;
$$;

-- Expose a state matching the send-policy cooldown. Returning "not_connected"
-- for a recently declined or removed request shows a misleading Add Friend CTA.
CREATE OR REPLACE FUNCTION public.get_connection_state(
  target_profile_id uuid, viewer_profile_id uuid DEFAULT NULL::uuid
) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_me uuid := COALESCE(viewer_profile_id, public.current_profile_id());
  v_row public.friendships%ROWTYPE;
  v_mode text;
  v_recent timestamptz;
BEGIN
  IF auth.uid() IS NULL OR v_me IS NULL OR target_profile_id IS NULL
    OR NOT public.profile_belongs_to_current_user(v_me) THEN RETURN 'unavailable'; END IF;
  IF v_me=target_profile_id THEN RETURN 'self'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=target_profile_id
    AND p.deleted_at IS NULL AND p.died_at IS NULL) THEN RETURN 'unavailable'; END IF;
  IF public.are_profiles_blocked(v_me,target_profile_id) THEN RETURN 'restricted'; END IF;
  SELECT f.* INTO v_row FROM public.friendships f
  WHERE (f.requestor_id=v_me AND f.addressee_id=target_profile_id)
     OR (f.requestor_id=target_profile_id AND f.addressee_id=v_me)
  ORDER BY f.updated_at DESC NULLS LAST, f.created_at DESC LIMIT 1;
  IF v_row.status='accepted'::public.friendship_status THEN RETURN 'friends'; END IF;
  IF v_row.status='pending'::public.friendship_status AND v_row.requestor_id=v_me THEN RETURN 'outgoing_pending'; END IF;
  IF v_row.status='pending'::public.friendship_status AND v_row.addressee_id=v_me THEN RETURN 'incoming_pending'; END IF;
  IF v_row.status='blocked'::public.friendship_status THEN RETURN 'restricted'; END IF;

  SELECT COALESCE(fs.allow_friend_requests,'everyone') INTO v_mode
  FROM public.friendship_settings fs WHERE fs.profile_id=target_profile_id;
  IF COALESCE(v_mode,'everyone')='none' THEN RETURN 'restricted'; END IF;

  SELECT max(a.created_at) INTO v_recent
  FROM public.social_relationship_audit a
  WHERE a.action IN ('friend_request_declined','friend_request_cancelled','friend_removed')
    AND ((a.actor_profile_id=v_me AND a.target_profile_id=target_profile_id)
      OR (a.actor_profile_id=target_profile_id AND a.target_profile_id=v_me));
  v_recent := GREATEST(
    COALESCE(v_recent,'-infinity'::timestamptz),
    CASE WHEN v_row.status::text='declined' THEN COALESCE(v_row.declined_at,v_row.responded_at,v_row.updated_at) ELSE '-infinity'::timestamptz END,
    CASE WHEN v_row.status::text='cancelled' THEN COALESCE(v_row.cancelled_at,v_row.responded_at,v_row.updated_at) ELSE '-infinity'::timestamptz END,
    CASE WHEN v_row.status::text='removed' THEN COALESCE(v_row.removed_at,v_row.responded_at,v_row.updated_at) ELSE '-infinity'::timestamptz END
  );
  IF v_recent > now() - INTERVAL '24 hours' THEN RETURN 'request_cooldown'; END IF;
  RETURN 'not_connected';
END;
$$;

REVOKE ALL ON FUNCTION public.send_friend_request(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_friend_request(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.get_connection_state(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_connection_state(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.can_profile_receive_dm(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_profile_receive_dm(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_direct_message_recipient_consent() FROM PUBLIC,anon;

COMMIT;
