-- Compatibility RPC for the already-deployed idempotent direct conversation sender.
-- Keeps all existing membership/block, rate-limit, and replay checks.
CREATE OR REPLACE FUNCTION public.send_direct_message_idempotent(
 p_recipient_profile_id uuid,p_message_body text,p_client_message_id text)
RETURNS public.direct_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_sender uuid;v_conversation uuid;v_body text:=btrim(coalesce(p_message_body,''));
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'active_profile_required' USING ERRCODE='42501';
 END IF;
 v_sender:=public.current_profile_id();
 IF v_sender IS NULL OR NOT public.profile_belongs_to_current_user(v_sender)
 THEN RAISE EXCEPTION 'active_profile_required' USING ERRCODE='42501';END IF;
 IF p_recipient_profile_id IS NULL OR p_recipient_profile_id=v_sender
 THEN RAISE EXCEPTION 'invalid_recipient_profile' USING ERRCODE='22023';END IF;
 IF v_body='' OR length(v_body)>2000
 THEN RAISE EXCEPTION 'invalid_message_length' USING ERRCODE='22023';END IF;
 IF p_client_message_id IS NULL OR length(btrim(p_client_message_id))<8
   OR length(p_client_message_id)>128
 THEN RAISE EXCEPTION 'invalid_client_message_id' USING ERRCODE='22023';END IF;

 -- Serialize conversation creation for both directions to prevent duplicate
 -- direct conversations when concurrent idempotent sends retry.
 PERFORM pg_advisory_xact_lock(hashtextextended(
   least(v_sender::text,p_recipient_profile_id::text)||':'||
   greatest(v_sender::text,p_recipient_profile_id::text),0));
 v_conversation:=nullif(public.start_direct_conversation(p_recipient_profile_id)->>'conversation_id','')::uuid;
 IF v_conversation IS NULL THEN
  RAISE EXCEPTION 'direct_conversation_unavailable' USING ERRCODE='P0001';END IF;

 -- This existing RPC checks membership, blocks, rate limits and the unique
 -- (conversation_id,sender_profile_id,client_message_id) replay key.
 RETURN public.send_conversation_message(v_conversation,v_body,p_client_message_id,NULL);
END $$;
REVOKE ALL ON FUNCTION public.send_direct_message_idempotent(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_direct_message_idempotent(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';