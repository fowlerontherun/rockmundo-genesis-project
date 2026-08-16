
ALTER TABLE public.global_chat
  ADD COLUMN IF NOT EXISTS profile_id uuid;

CREATE INDEX IF NOT EXISTS global_chat_channel_created_idx ON public.global_chat (channel, created_at DESC);

-- Band rooms use the channel key 'band:<band_id>'.
CREATE OR REPLACE FUNCTION public.chat_channel_band_id(p_channel text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_channel IS NULL OR p_channel NOT LIKE 'band:%' THEN RETURN NULL; END IF;
  BEGIN
    v_id := substring(p_channel from 6)::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.caller_can_use_chat_channel(p_channel text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.chat_channel_band_id(p_channel) IS NULL THEN true
    ELSE public.caller_in_band(public.chat_channel_band_id(p_channel))
  END;
$$;

GRANT EXECUTE ON FUNCTION public.chat_channel_band_id(text), public.caller_can_use_chat_channel(text) TO authenticated, service_role;

GRANT SELECT, INSERT ON public.global_chat TO authenticated;
GRANT ALL ON public.global_chat TO service_role;

DROP POLICY IF EXISTS "Chat messages are viewable by everyone" ON public.global_chat;
DROP POLICY IF EXISTS "Users can post messages" ON public.global_chat;

CREATE POLICY global_chat_read ON public.global_chat FOR SELECT TO authenticated
  USING (public.caller_can_use_chat_channel(channel));

CREATE POLICY global_chat_post ON public.global_chat FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.caller_can_use_chat_channel(channel));

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.global_chat;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
