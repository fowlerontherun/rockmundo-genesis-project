-- Private messaging conversation layer over existing direct-message infrastructure.
-- Architecture: keep direct_messages as the live message event table and add canonical
-- participant/read/action metadata so chat does not fork into a separate mail system.

ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'message_report';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'conversation_archive';
ALTER TYPE public.social_action_audit_kind ADD VALUE IF NOT EXISTS 'conversation_mute';

DO $$ BEGIN CREATE TYPE public.conversation_type AS ENUM ('direct'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conversation_status AS ENUM ('active', 'restricted', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.message_moderation_state AS ENUM ('visible', 'quarantined', 'removed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.conversation_type NOT NULL DEFAULT 'direct',
  direct_pair_key text UNIQUE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_message_at timestamptz,
  last_message_id uuid,
  status public.conversation_status NOT NULL DEFAULT 'active',
  CONSTRAINT conversations_direct_pair_required CHECK (type <> 'direct' OR direct_pair_key IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_read_message_id uuid,
  last_read_at timestamptz,
  archived_at timestamptz,
  muted_until timestamptz,
  deleted_for_player_at timestamptz,
  conversation_hidden_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  PRIMARY KEY (conversation_id, profile_id)
);

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS client_message_id text,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderation_state public.message_moderation_state NOT NULL DEFAULT 'visible';

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  moderation_state public.message_moderation_state NOT NULL DEFAULT 'visible',
  CONSTRAINT message_attachments_safe_filename CHECK (filename !~ '[\\/]' AND char_length(filename) BETWEEN 1 AND 180),
  CONSTRAINT message_attachments_safe_mime CHECK (mime_type ~ '^(image|audio|application)/(png|jpeg|jpg|gif|webp|pdf|mpeg|ogg|wav)$')
);

CREATE UNIQUE INDEX IF NOT EXISTS direct_messages_client_idempotency_idx
  ON public.direct_messages (conversation_id, sender_profile_id, client_message_id)
  WHERE client_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_last_message_idx ON public.conversations (last_message_at DESC NULLS LAST, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversation_participants_profile_idx ON public.conversation_participants (profile_id, archived_at, conversation_hidden_at);
CREATE INDEX IF NOT EXISTS conversation_participants_unread_idx ON public.conversation_participants (profile_id) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS direct_messages_conversation_created_idx ON public.direct_messages (conversation_id, created_at DESC, id DESC) WHERE deleted_at IS NULL AND moderation_state = 'visible';
CREATE INDEX IF NOT EXISTS direct_messages_body_fts_idx ON public.direct_messages USING gin (to_tsvector('simple', body)) WHERE deleted_at IS NULL AND moderation_state = 'visible';
CREATE INDEX IF NOT EXISTS message_attachments_message_idx ON public.message_attachments (message_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read conversations" ON public.conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = id AND public.profile_belongs_to_current_user(cp.profile_id))
);
CREATE POLICY "Participants read participant rows" ON public.conversation_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversation_participants mine WHERE mine.conversation_id = conversation_participants.conversation_id AND public.profile_belongs_to_current_user(mine.profile_id))
);
CREATE POLICY "Participants update their row" ON public.conversation_participants FOR UPDATE USING (public.profile_belongs_to_current_user(profile_id)) WITH CHECK (public.profile_belongs_to_current_user(profile_id));
CREATE POLICY "Participants read message attachments" ON public.message_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.direct_messages dm JOIN public.conversation_participants cp ON cp.conversation_id = dm.conversation_id WHERE dm.id = message_id AND public.profile_belongs_to_current_user(cp.profile_id))
);

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() ORDER BY p.created_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.direct_pair_key(a uuid, b uuid)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT least(a::text,b::text) || ':' || greatest(a::text,b::text); $$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(target_conversation_id uuid, target_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = target_conversation_id AND cp.profile_id = target_profile_id);
$$;

CREATE OR REPLACE FUNCTION public.start_direct_conversation(recipient_profile_id uuid)
RETURNS TABLE(conversation_id uuid, type text, other_profile_id uuid, other_display_name text, other_username text, other_avatar_url text, last_message_id uuid, last_message_at timestamptz, last_message_preview text, unread_count integer, archived_at timestamptz, muted_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender uuid := public.current_profile_id(); pair text; convo uuid; recipient_user uuid;
BEGIN
  IF sender IS NULL THEN RAISE EXCEPTION 'Active profile is required' USING ERRCODE='28000'; END IF;
  IF recipient_profile_id IS NULL OR sender = recipient_profile_id THEN RAISE EXCEPTION 'Choose a valid player to message' USING ERRCODE='22023'; END IF;
  SELECT p.user_id INTO recipient_user FROM public.profiles p WHERE p.id = recipient_profile_id;
  IF recipient_user IS NULL THEN RAISE EXCEPTION 'That player could not be found' USING ERRCODE='22023'; END IF;
  IF NOT public.can_profile_receive_dm(sender, recipient_profile_id) THEN RAISE EXCEPTION 'Messaging is unavailable for this player' USING ERRCODE='42501'; END IF;
  pair := public.direct_pair_key(sender, recipient_profile_id);
  INSERT INTO public.conversations(type, direct_pair_key, created_by)
  VALUES ('direct', pair, sender)
  ON CONFLICT (direct_pair_key) DO UPDATE SET updated_at = timezone('utc', now()), status = CASE WHEN conversations.status = 'closed' THEN 'active'::public.conversation_status ELSE conversations.status END
  RETURNING id INTO convo;
  INSERT INTO public.conversation_participants(conversation_id, profile_id) VALUES (convo, sender), (convo, recipient_profile_id)
  ON CONFLICT (conversation_id, profile_id) DO UPDATE SET conversation_hidden_at = NULL, deleted_for_player_at = NULL;
  RETURN QUERY
    SELECT c.id, c.type::text, p.id, p.display_name, p.username, p.avatar_url, c.last_message_id, c.last_message_at, left(coalesce(dm.body,''), 160), cp.unread_count, cp.archived_at, cp.muted_until
    FROM public.conversations c
    JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.profile_id = sender
    JOIN public.profiles p ON p.id = recipient_profile_id
    LEFT JOIN public.direct_messages dm ON dm.id = c.last_message_id
    WHERE c.id = convo;
END; $$;

CREATE OR REPLACE FUNCTION public.send_conversation_message(conversation_id uuid, message_body text, client_message_id text DEFAULT NULL, reply_to_message_id uuid DEFAULT NULL)
RETURNS public.direct_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sender uuid := public.current_profile_id(); recipient uuid; trimmed text; new_message public.direct_messages; existing public.direct_messages;
BEGIN
  IF sender IS NULL THEN RAISE EXCEPTION 'Active profile is required' USING ERRCODE='28000'; END IF;
  SELECT cp.profile_id INTO recipient FROM public.conversation_participants cp WHERE cp.conversation_id = send_conversation_message.conversation_id AND cp.profile_id <> sender LIMIT 1;
  IF recipient IS NULL OR NOT public.is_conversation_participant(send_conversation_message.conversation_id, sender) THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
  IF NOT public.can_profile_receive_dm(sender, recipient) THEN RAISE EXCEPTION 'Messaging is unavailable for this conversation' USING ERRCODE='42501'; END IF;
  trimmed := btrim(coalesce(message_body,''));
  IF length(trimmed) < 1 OR length(trimmed) > 2000 THEN RAISE EXCEPTION 'Direct messages must be between 1 and 2,000 characters' USING ERRCODE='22023'; END IF;
  IF reply_to_message_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.direct_messages dm WHERE dm.id = reply_to_message_id AND dm.conversation_id = send_conversation_message.conversation_id) THEN RAISE EXCEPTION 'Reply target is unavailable' USING ERRCODE='22023'; END IF;
  IF client_message_id IS NOT NULL THEN
    SELECT * INTO existing FROM public.direct_messages dm WHERE dm.conversation_id = send_conversation_message.conversation_id AND dm.sender_profile_id = sender AND dm.client_message_id = client_message_id;
    IF existing.id IS NOT NULL THEN RETURN existing; END IF;
  END IF;
  INSERT INTO public.direct_messages(channel_id, conversation_id, sender_profile_id, recipient_profile_id, body, client_message_id, reply_to_message_id)
  VALUES (public.direct_pair_key(sender, recipient), send_conversation_message.conversation_id, sender, recipient, trimmed, NULLIF(client_message_id,''), reply_to_message_id)
  RETURNING * INTO new_message;
  UPDATE public.conversations SET last_message_id = new_message.id, last_message_at = new_message.created_at, updated_at = timezone('utc', now()) WHERE id = send_conversation_message.conversation_id;
  UPDATE public.conversation_participants SET archived_at = NULL, conversation_hidden_at = NULL, deleted_for_player_at = NULL, unread_count = CASE WHEN profile_id = recipient THEN unread_count + 1 ELSE unread_count END WHERE conversation_participants.conversation_id = send_conversation_message.conversation_id;
  INSERT INTO public.notifications(user_id, profile_id, category, type, title, message, action_path, metadata)
    SELECT p.user_id, recipient, 'social', 'direct_message', 'New message', 'You have a new private message.', '/social/messages', jsonb_build_object('conversation_id', send_conversation_message.conversation_id, 'message_id', new_message.id, 'sender_profile_id', sender)
    FROM public.profiles p WHERE p.id = recipient AND NOT EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = send_conversation_message.conversation_id AND cp.profile_id = recipient AND cp.muted_until > timezone('utc', now()));
  RETURN new_message;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(conversation_id uuid, read_message_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer uuid := public.current_profile_id(); boundary uuid; boundary_time timestamptz;
BEGIN
  IF viewer IS NULL OR NOT public.is_conversation_participant(conversation_id, viewer) THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
  IF read_message_id IS NULL THEN SELECT dm.id, dm.created_at INTO boundary, boundary_time FROM public.direct_messages dm WHERE dm.conversation_id = mark_conversation_read.conversation_id ORDER BY dm.created_at DESC, dm.id DESC LIMIT 1; ELSE SELECT dm.id, dm.created_at INTO boundary, boundary_time FROM public.direct_messages dm WHERE dm.id = read_message_id AND dm.conversation_id = mark_conversation_read.conversation_id; END IF;
  UPDATE public.conversation_participants SET last_read_message_id = boundary, last_read_at = coalesce(boundary_time, timezone('utc', now())), unread_count = 0 WHERE conversation_participants.conversation_id = mark_conversation_read.conversation_id AND profile_id = viewer;
  UPDATE public.direct_messages SET read_at = coalesce(boundary_time, timezone('utc', now())) WHERE direct_messages.conversation_id = mark_conversation_read.conversation_id AND recipient_profile_id = viewer AND read_at IS NULL;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.list_conversations(include_archived boolean DEFAULT false, search_query text DEFAULT NULL, page_limit integer DEFAULT 30, before_activity_at timestamptz DEFAULT NULL)
RETURNS TABLE(conversation_id uuid, type text, other_profile_id uuid, other_display_name text, other_username text, other_avatar_url text, last_message_id uuid, last_message_at timestamptz, last_message_preview text, unread_count integer, archived_at timestamptz, muted_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH viewer AS (SELECT public.current_profile_id() AS id)
  SELECT c.id, c.type::text, p.id, p.display_name, p.username, p.avatar_url, c.last_message_id, c.last_message_at, left(coalesce(dm.body,''), 160), cp.unread_count, cp.archived_at, cp.muted_until
  FROM public.conversation_participants cp
  JOIN viewer v ON v.id = cp.profile_id
  JOIN public.conversations c ON c.id = cp.conversation_id
  JOIN public.conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.profile_id <> cp.profile_id
  JOIN public.profiles p ON p.id = other_cp.profile_id
  LEFT JOIN public.direct_messages dm ON dm.id = c.last_message_id
  WHERE (include_archived OR cp.archived_at IS NULL) AND cp.conversation_hidden_at IS NULL
    AND (before_activity_at IS NULL OR c.last_message_at < before_activity_at)
    AND (search_query IS NULL OR p.display_name ILIKE '%'||search_query||'%' OR p.username ILIKE '%'||search_query||'%' OR EXISTS (SELECT 1 FROM public.direct_messages s WHERE s.conversation_id = c.id AND s.deleted_at IS NULL AND s.moderation_state='visible' AND to_tsvector('simple', s.body) @@ plainto_tsquery('simple', search_query)))
  ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC
  LIMIT least(greatest(page_limit, 1), 50);
$$;

GRANT EXECUTE ON FUNCTION public.start_direct_conversation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_conversation_message(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_conversations(boolean, text, integer, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;

ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
