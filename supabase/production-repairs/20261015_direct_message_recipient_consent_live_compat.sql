-- Reconcile the independent recipient-consent portion of
-- 20300106160000_enforce_social_contact_consent_and_request_cooldowns.sql.
-- Do NOT replay the historical full file: the live friendship RPCs and
-- relationship rules have since evolved. This migration does not touch
-- friendships, existing conversations, messages or preference records.
-- Browser send, idempotent fallback and direct table INSERT all pass this
-- one server-side guard. Group conversations are checked by membership,
-- not by a 1:1 recipient privacy preference.
DO $preflight$
BEGIN
  IF to_regclass('public.direct_messages') IS NULL
    OR to_regclass('public.profile_privacy_settings') IS NULL
    OR to_regclass('public.friendships') IS NULL
    OR to_regclass('public.conversations') IS NULL
    OR to_regclass('public.conversation_participants') IS NULL
    OR to_regclass('public.band_members') IS NULL
    OR to_regprocedure('public.are_profiles_blocked(uuid,uuid)') IS NULL
    OR to_regtype('public.profile_dm_permission') IS NULL
  THEN RAISE EXCEPTION 'DIRECT_MESSAGE_CONSENT_SCHEMA_MISSING'; END IF;
  IF to_regprocedure('public.can_profile_receive_dm(uuid,uuid)') IS NOT NULL
    OR to_regprocedure('public.guard_direct_message_recipient_consent()') IS NOT NULL
  THEN RAISE EXCEPTION 'DIRECT_MESSAGE_CONSENT_ALREADY_PRESENT_REVIEW'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                JOIN pg_namespace n ON n.oid=t.typnamespace
                WHERE n.nspname='public' AND t.typname='profile_dm_permission'
                  AND e.enumlabel='friends_and_band')
     OR NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                JOIN pg_namespace n ON n.oid=t.typnamespace
                WHERE n.nspname='public' AND t.typname='profile_dm_permission'
                  AND e.enumlabel='existing_conversations')
  THEN RAISE EXCEPTION 'DIRECT_MESSAGE_CONSENT_ENUM_INCOMPLETE'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION public.can_profile_receive_dm(
  sender_profile_id uuid, recipient_profile_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $permission$
DECLARE v_mode text;
BEGIN
  IF auth.uid() IS NULL OR sender_profile_id IS NULL
    OR recipient_profile_id IS NULL OR sender_profile_id=recipient_profile_id
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles s
      WHERE s.id=sender_profile_id AND s.user_id=auth.uid()
        AND s.is_active IS TRUE AND s.deleted_at IS NULL AND s.died_at IS NULL
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles r
      WHERE r.id=recipient_profile_id
        AND r.is_active IS TRUE AND r.deleted_at IS NULL AND r.died_at IS NULL
    )
    OR public.are_profiles_blocked(sender_profile_id,recipient_profile_id)
  THEN RETURN false; END IF;

  SELECT pps.dm_permission::text INTO v_mode
    FROM public.profile_privacy_settings pps
    WHERE pps.profile_id=recipient_profile_id;
  v_mode:=coalesce(v_mode,'friends');
  IF v_mode='none' THEN RETURN false; END IF;
  IF v_mode='everyone' THEN RETURN true; END IF;

  IF v_mode IN ('friends','friends_and_band') AND EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status::text='accepted' AND (
      (f.requestor_id=sender_profile_id AND f.addressee_id=recipient_profile_id)
      OR (f.addressee_id=sender_profile_id AND f.requestor_id=recipient_profile_id)
    )
  ) THEN RETURN true; END IF;
  IF v_mode='friends' THEN RETURN false; END IF;

  IF v_mode='friends_and_band' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.band_members m
      JOIN public.band_members r ON r.band_id=m.band_id
      WHERE m.profile_id=sender_profile_id
        AND r.profile_id=recipient_profile_id
        AND m.member_status='active' AND r.member_status='active'
        AND coalesce(m.is_touring_member,false)=false
        AND coalesce(r.is_touring_member,false)=false
    );
  END IF;

  IF v_mode='existing_conversations' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.conversation_participants a
        ON a.conversation_id=c.id AND a.profile_id=sender_profile_id
      JOIN public.conversation_participants b
        ON b.conversation_id=c.id AND b.profile_id=recipient_profile_id
      WHERE c.type='direct' AND coalesce(c.is_closed,false)=false
        AND a.left_at IS NULL AND b.left_at IS NULL
    );
  END IF;
  RETURN false;
END
$permission$;

CREATE OR REPLACE FUNCTION public.guard_direct_message_recipient_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
DECLARE v_type text; v_closed boolean;
BEGIN
  IF auth.uid() IS NULL OR NEW.sender_profile_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id=NEW.sender_profile_id AND p.user_id=auth.uid()
         AND p.deleted_at IS NULL AND p.died_at IS NULL
         AND p.is_active IS TRUE
     )
  THEN RAISE EXCEPTION 'DIRECT_MESSAGE_SENDER_NOT_AUTHORISED' USING ERRCODE='42501';
  END IF;

  IF NEW.conversation_id IS NOT NULL THEN
    SELECT c.type,c.is_closed INTO v_type,v_closed
    FROM public.conversations c WHERE c.id=NEW.conversation_id;
    IF NOT FOUND OR coalesce(v_closed,false)=true THEN
      RAISE EXCEPTION 'DIRECT_MESSAGE_CONVERSATION_UNAVAILABLE' USING ERRCODE='42501';
    END IF;
    IF v_type='group' THEN
      IF NEW.recipient_profile_id IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id=NEW.conversation_id
          AND cp.profile_id=NEW.sender_profile_id AND cp.left_at IS NULL
      ) THEN RAISE EXCEPTION 'GROUP_MESSAGE_MEMBERSHIP_REQUIRED' USING ERRCODE='42501'; END IF;
      RETURN NEW;
    END IF;
    IF v_type IS DISTINCT FROM 'direct' THEN
      RAISE EXCEPTION 'DIRECT_MESSAGE_CONVERSATION_UNAVAILABLE' USING ERRCODE='42501';
    END IF;
    IF NEW.recipient_profile_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.conversation_participants a
      JOIN public.conversation_participants b
        ON b.conversation_id=a.conversation_id
      WHERE a.conversation_id=NEW.conversation_id
        AND a.profile_id=NEW.sender_profile_id
        AND b.profile_id=NEW.recipient_profile_id
        AND a.left_at IS NULL AND b.left_at IS NULL
    ) THEN RAISE EXCEPTION 'DIRECT_MESSAGE_MEMBERSHIP_REQUIRED' USING ERRCODE='42501';
    END IF;
  END IF;

  IF NEW.recipient_profile_id IS NULL OR NOT
     public.can_profile_receive_dm(NEW.sender_profile_id,NEW.recipient_profile_id)
  THEN RAISE EXCEPTION 'DIRECT_MESSAGE_RECIPIENT_CONSENT_REQUIRED'
       USING ERRCODE='42501'; END IF;
  RETURN NEW;
END
$guard$;

DROP TRIGGER IF EXISTS guard_direct_message_recipient_consent
  ON public.direct_messages;
CREATE TRIGGER guard_direct_message_recipient_consent
BEFORE INSERT OR UPDATE OF sender_profile_id,recipient_profile_id,conversation_id
ON public.direct_messages FOR EACH ROW
EXECUTE FUNCTION public.guard_direct_message_recipient_consent();

REVOKE ALL ON FUNCTION public.can_profile_receive_dm(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_profile_receive_dm(uuid,uuid)
  TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.guard_direct_message_recipient_consent()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.guard_direct_message_recipient_consent()
  TO service_role;

NOTIFY pgrst,'reload schema';
