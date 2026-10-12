-- Idempotent fallback DMs for recipients without an established conversation.
CREATE UNIQUE INDEX IF NOT EXISTS direct_messages_fallback_request_key
 ON public.direct_messages(sender_profile_id,client_message_id)
 WHERE conversation_id IS NULL AND client_message_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.send_direct_message_idempotent(
 p_recipient_profile_id uuid,p_message_body text,p_client_message_id text
) RETURNS public.direct_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_sender uuid:=public._caller_profile_id();v_result public.direct_messages%rowtype;
 v_body text:=btrim(coalesce(p_message_body,''));
BEGIN
 IF auth.uid() IS NULL OR v_sender IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.profiles WHERE id=v_sender AND user_id=auth.uid())
 THEN RAISE EXCEPTION 'active_profile_required'; END IF;
 IF nullif(btrim(p_client_message_id),'') IS NULL OR length(p_client_message_id)>128
 THEN RAISE EXCEPTION 'invalid_message_request_key'; END IF;
 SELECT * INTO v_result FROM public.direct_messages
 WHERE sender_profile_id=v_sender AND client_message_id=p_client_message_id
 AND conversation_id IS NULL;
 IF FOUND THEN
  IF v_result.recipient_profile_id IS DISTINCT FROM p_recipient_profile_id OR v_result.body<>v_body
  THEN RAISE EXCEPTION 'message_request_reused_with_different_content'; END IF;
  RETURN v_result;
 END IF;
 IF p_recipient_profile_id IS NULL OR p_recipient_profile_id=v_sender OR length(v_body) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'invalid_direct_message'; END IF;
 IF NOT public.can_profile_receive_dm(v_sender,p_recipient_profile_id)
 THEN RAISE EXCEPTION 'recipient_not_available'; END IF;
 INSERT INTO public.direct_messages(channel_id,sender_profile_id,recipient_profile_id,body,client_message_id)
 VALUES(least(v_sender::text,p_recipient_profile_id::text)||':'||
 greatest(v_sender::text,p_recipient_profile_id::text),v_sender,p_recipient_profile_id,v_body,p_client_message_id)
 ON CONFLICT (sender_profile_id,client_message_id)
 WHERE conversation_id IS NULL AND client_message_id IS NOT NULL
 DO NOTHING RETURNING * INTO v_result;
 IF v_result.id IS NULL THEN
  SELECT * INTO v_result FROM public.direct_messages
  WHERE sender_profile_id=v_sender AND client_message_id=p_client_message_id
    AND conversation_id IS NULL;
 END IF;
 IF v_result.id IS NULL OR v_result.recipient_profile_id IS DISTINCT FROM p_recipient_profile_id OR
   v_result.body<>v_body THEN RAISE EXCEPTION 'direct_message_idempotency_conflict'; END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.send_direct_message_idempotent(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message_idempotent(uuid,text,text) TO authenticated;