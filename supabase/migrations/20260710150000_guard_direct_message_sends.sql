ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'direct_message_send_denied';

CREATE OR REPLACE FUNCTION public.send_direct_message(
  recipient_profile_id uuid,
  message_body text
)
RETURNS public.direct_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_profile_id uuid;
  trimmed_body text;
  new_message public.direct_messages;
BEGIN
  SELECT p.id
    INTO sender_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF sender_profile_id IS NULL THEN
    RAISE EXCEPTION 'You need an active player profile before sending direct messages.' USING ERRCODE = '28000';
  END IF;

  trimmed_body := btrim(COALESCE(message_body, ''));

  IF recipient_profile_id IS NULL THEN
    RAISE EXCEPTION 'Choose a player to message.' USING ERRCODE = '22023';
  END IF;

  IF sender_profile_id = recipient_profile_id THEN
    RAISE EXCEPTION 'You cannot send a direct message to yourself.' USING ERRCODE = '22023';
  END IF;

  IF length(trimmed_body) < 1 THEN
    RAISE EXCEPTION 'Write a message before sending.' USING ERRCODE = '22023';
  END IF;

  IF length(trimmed_body) > 2000 THEN
    RAISE EXCEPTION 'Direct messages must be 2,000 characters or fewer.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = recipient_profile_id) THEN
    RAISE EXCEPTION 'That player could not be found.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.can_profile_receive_dm(sender_profile_id, recipient_profile_id) THEN
    INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, metadata)
    VALUES (
      sender_profile_id,
      recipient_profile_id,
      'direct_message_send_denied'::public.social_action_audit_kind,
      'direct_message',
      jsonb_build_object('reason', 'privacy_or_block_guard')
    );

    RAISE EXCEPTION 'This player is not available for direct messages.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.direct_messages (channel_id, sender_profile_id, recipient_profile_id, body)
  VALUES (
    least(sender_profile_id::text, recipient_profile_id::text) || ':' || greatest(sender_profile_id::text, recipient_profile_id::text),
    sender_profile_id,
    recipient_profile_id,
    trimmed_body
  )
  RETURNING * INTO new_message;

  RETURN new_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_direct_message(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "DM insert by sender" ON public.direct_messages;
CREATE POLICY "DM insert by guarded RPC or sender"
ON public.direct_messages FOR INSERT
WITH CHECK (
  public.profile_belongs_to_current_user(sender_profile_id)
  AND sender_profile_id <> recipient_profile_id
  AND channel_id = least(sender_profile_id::text, recipient_profile_id::text) || ':' || greatest(sender_profile_id::text, recipient_profile_id::text)
  AND public.can_profile_receive_dm(sender_profile_id, recipient_profile_id)
);

