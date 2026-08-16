-- ============ SOCIAL SAFETY TABLES ============
CREATE TABLE IF NOT EXISTS public.player_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  reason_category text,
  private_note text,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_blocks_not_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT player_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT player_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS player_blocks_active_unique ON public.player_blocks (blocker_id, blocked_id) WHERE removed_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_blocks TO authenticated;
GRANT ALL ON public.player_blocks TO service_role;
ALTER TABLE public.player_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players manage their own blocks" ON public.player_blocks;
CREATE POLICY "Players manage their own blocks" ON public.player_blocks FOR ALL TO authenticated
  USING (blocker_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (blocker_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.profile_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text,
  mute_until timestamptz,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_mutes_not_self CHECK (viewer_profile_id <> target_profile_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS profile_mutes_active_unique ON public.profile_mutes (viewer_profile_id, target_profile_id) WHERE removed_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_mutes TO authenticated;
GRANT ALL ON public.profile_mutes TO service_role;
ALTER TABLE public.profile_mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players manage their own mutes" ON public.profile_mutes;
CREATE POLICY "Players manage their own mutes" ON public.profile_mutes FOR ALL TO authenticated
  USING (viewer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (viewer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.player_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_player_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category text NOT NULL,
  subcategory text,
  target_type text NOT NULL DEFAULT 'player_profile',
  target_id uuid,
  content_type text NOT NULL DEFAULT 'player_profile',
  content_id uuid,
  description text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  priority text NOT NULL DEFAULT 'normal',
  resolution_summary text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_reports_reporter_idx ON public.player_reports (reporter_profile_id, submitted_at DESC);
GRANT SELECT, INSERT ON public.player_reports TO authenticated;
GRANT ALL ON public.player_reports TO service_role;
ALTER TABLE public.player_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Players read their own reports" ON public.player_reports;
CREATE POLICY "Players read their own reports" ON public.player_reports FOR SELECT TO authenticated
  USING (reporter_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins read all reports" ON public.player_reports;
CREATE POLICY "Admins read all reports" ON public.player_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct',
  last_message_id uuid,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  archived_at timestamptz,
  muted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, profile_id)
);
GRANT SELECT, UPDATE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read their conversations" ON public.conversations;
CREATE POLICY "Participants read their conversations" ON public.conversations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    JOIN public.profiles p ON p.id = cp.profile_id
    WHERE cp.conversation_id = conversations.id AND p.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Participants read their memberships" ON public.conversation_participants;
CREATE POLICY "Participants read their memberships" ON public.conversation_participants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants sibling
    JOIN public.profiles p ON p.id = sibling.profile_id
    WHERE sibling.conversation_id = conversation_participants.conversation_id AND p.user_id = auth.uid()
  ));
DROP POLICY IF EXISTS "Participants update their own membership" ON public.conversation_participants;
CREATE POLICY "Participants update their own membership" ON public.conversation_participants FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS client_message_id text;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS reply_to_message_id uuid;
CREATE INDEX IF NOT EXISTS direct_messages_conversation_idx ON public.direct_messages (conversation_id, created_at);

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.are_profiles_blocked(first_profile_id uuid, second_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_blocks b
    WHERE b.removed_at IS NULL
      AND ((b.blocker_id = first_profile_id AND b.blocked_id = second_profile_id)
        OR (b.blocker_id = second_profile_id AND b.blocked_id = first_profile_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_profile_muted(viewer_profile_id uuid, target_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_mutes m
    WHERE m.removed_at IS NULL
      AND m.viewer_profile_id = is_profile_muted.viewer_profile_id
      AND m.target_profile_id = is_profile_muted.target_profile_id
      AND (m.mute_until IS NULL OR m.mute_until > now())
  );
$$;

-- ============ BLOCKS / MUTES ============
CREATE OR REPLACE FUNCTION public.block_player(target_profile_id uuid, reason_category text DEFAULT NULL, private_note text DEFAULT NULL)
RETURNS public.player_blocks LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_row public.player_blocks;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  IF v_me = target_profile_id THEN RAISE EXCEPTION 'You cannot block yourself'; END IF;
  INSERT INTO public.player_blocks (blocker_id, blocked_id, reason_category, private_note)
  VALUES (v_me, target_profile_id, reason_category, private_note)
  ON CONFLICT (blocker_id, blocked_id) WHERE removed_at IS NULL
  DO UPDATE SET reason_category = EXCLUDED.reason_category, private_note = EXCLUDED.private_note, updated_at = now()
  RETURNING * INTO v_row;
  UPDATE public.friendships SET status = 'blocked', responded_at = now(), updated_at = now()
  WHERE (requestor_id = v_me AND addressee_id = target_profile_id) OR (requestor_id = target_profile_id AND addressee_id = v_me);
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_profile(target_profile_id uuid, note text DEFAULT NULL)
RETURNS public.player_blocks LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.block_player(target_profile_id, NULL, note);
$$;

CREATE OR REPLACE FUNCTION public.unblock_player(target_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_count integer;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  UPDATE public.player_blocks SET removed_at = now(), updated_at = now()
  WHERE blocker_id = v_me AND blocked_id = target_profile_id AND removed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_profile(target_profile_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.unblock_player(target_profile_id);
$$;

CREATE OR REPLACE FUNCTION public.mute_profile(target_profile_id uuid, mute_until timestamptz DEFAULT NULL, note text DEFAULT NULL)
RETURNS public.profile_mutes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_row public.profile_mutes;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  IF v_me = target_profile_id THEN RAISE EXCEPTION 'You cannot mute yourself'; END IF;
  INSERT INTO public.profile_mutes (viewer_profile_id, target_profile_id, note, mute_until)
  VALUES (v_me, target_profile_id, note, mute_until)
  ON CONFLICT (viewer_profile_id, target_profile_id) WHERE removed_at IS NULL
  DO UPDATE SET note = EXCLUDED.note, mute_until = EXCLUDED.mute_until, updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.unmute_profile(target_profile_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_count integer;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  UPDATE public.profile_mutes SET removed_at = now(), updated_at = now()
  WHERE viewer_profile_id = v_me AND target_profile_id = unmute_profile.target_profile_id AND removed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ============ REPORTS ============
CREATE OR REPLACE FUNCTION public.submit_player_report(
  target_profile_id uuid, category text, description text,
  content_type text DEFAULT 'player_profile', content_id uuid DEFAULT NULL,
  subcategory text DEFAULT NULL, evidence jsonb DEFAULT '{}'::jsonb, block_after_report boolean DEFAULT false)
RETURNS public.player_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_row public.player_reports; v_recent integer;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  SELECT count(*) INTO v_recent FROM public.player_reports
  WHERE reporter_profile_id = v_me AND submitted_at > now() - interval '1 minute';
  IF v_recent >= 3 THEN RAISE EXCEPTION 'Please wait a moment before sending another report'; END IF;
  INSERT INTO public.player_reports (reporter_profile_id, reported_player_id, category, subcategory, target_type, target_id, content_type, content_id, description, evidence,
    priority)
  VALUES (v_me, target_profile_id, category, subcategory, content_type, content_id, content_type, content_id, coalesce(description, ''), coalesce(evidence, '{}'::jsonb),
    CASE WHEN category IN ('threats_intimidation','hate_discriminatory_abuse','scam_fraud','personal_information','ban_evasion') THEN 'high' ELSE 'normal' END)
  RETURNING * INTO v_row;
  IF block_after_report AND target_profile_id IS NOT NULL THEN
    PERFORM public.block_player(target_profile_id, 'other', 'Blocked while reporting');
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_social_target(
  reported_profile_id uuid, target_type text, target_id uuid, category text, reason text, context jsonb DEFAULT '{}'::jsonb)
RETURNS public.player_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_row public.player_reports;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  INSERT INTO public.player_reports (reporter_profile_id, reported_player_id, category, target_type, target_id, content_type, content_id, description, context)
  VALUES (v_me, reported_profile_id, category, coalesce(target_type, 'player_profile'), target_id, coalesce(target_type, 'player_profile'), target_id, coalesce(reason, ''), coalesce(context, '{}'::jsonb))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- ============ FRIENDSHIPS ============
CREATE OR REPLACE FUNCTION public.send_friend_request(target_profile_id uuid)
RETURNS public.friendships LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_row public.friendships;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  IF v_me = target_profile_id THEN RAISE EXCEPTION 'You cannot add yourself'; END IF;
  IF public.are_profiles_blocked(v_me, target_profile_id) THEN RAISE EXCEPTION 'This player is unavailable'; END IF;
  SELECT * INTO v_row FROM public.friendships
  WHERE (requestor_id = v_me AND addressee_id = target_profile_id) OR (requestor_id = target_profile_id AND addressee_id = v_me)
  LIMIT 1;
  IF v_row.id IS NOT NULL THEN
    IF v_row.status IN ('pending','accepted') THEN RETURN v_row; END IF;
    UPDATE public.friendships SET status = 'pending', requestor_id = v_me, addressee_id = target_profile_id, responded_at = NULL, updated_at = now()
    WHERE id = v_row.id RETURNING * INTO v_row;
    RETURN v_row;
  END IF;
  INSERT INTO public.friendships (requestor_id, addressee_id, status)
  VALUES (v_me, target_profile_id, 'pending') RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_friend_request(friendship_id uuid, next_status text)
RETURNS public.friendships LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_row public.friendships; v_status friendship_status;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  SELECT * INTO v_row FROM public.friendships WHERE id = friendship_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_me NOT IN (v_row.requestor_id, v_row.addressee_id) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  v_status := CASE WHEN lower(next_status) = 'accepted' THEN 'accepted'::friendship_status ELSE 'declined'::friendship_status END;
  IF v_status = 'accepted' AND v_me <> v_row.addressee_id THEN RAISE EXCEPTION 'Only the recipient can accept'; END IF;
  UPDATE public.friendships SET status = v_status, responded_at = now(), updated_at = now()
  WHERE id = friendship_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_request_counts()
RETURNS TABLE (friends integer, incoming integer, outgoing integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT public.current_profile_id() AS id)
  SELECT
    (SELECT count(*)::int FROM public.friendships f, me WHERE f.status = 'accepted' AND me.id IN (f.requestor_id, f.addressee_id)),
    (SELECT count(*)::int FROM public.friendships f, me WHERE f.status = 'pending' AND f.addressee_id = me.id),
    (SELECT count(*)::int FROM public.friendships f, me WHERE f.status = 'pending' AND f.requestor_id = me.id);
$$;

CREATE OR REPLACE FUNCTION public.get_connection_state(target_profile_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_row public.friendships;
BEGIN
  IF v_me IS NULL OR target_profile_id IS NULL THEN RETURN 'unavailable'; END IF;
  IF v_me = target_profile_id THEN RETURN 'self'; END IF;
  IF public.are_profiles_blocked(v_me, target_profile_id) THEN RETURN 'blocked'; END IF;
  SELECT * INTO v_row FROM public.friendships
  WHERE (requestor_id = v_me AND addressee_id = target_profile_id) OR (requestor_id = target_profile_id AND addressee_id = v_me)
  LIMIT 1;
  IF v_row.id IS NULL THEN RETURN 'none'; END IF;
  IF v_row.status = 'accepted' THEN RETURN 'friends'; END IF;
  IF v_row.status = 'pending' AND v_row.requestor_id = v_me THEN RETURN 'outgoing'; END IF;
  IF v_row.status = 'pending' THEN RETURN 'incoming'; END IF;
  RETURN 'none';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_social_permissions(target_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_blocked boolean; v_by_viewer boolean; v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_profile_id AND coalesce(is_active, true) AND deleted_at IS NULL) INTO v_exists;
  v_blocked := coalesce(public.are_profiles_blocked(v_me, target_profile_id), false);
  SELECT EXISTS (SELECT 1 FROM public.player_blocks WHERE blocker_id = v_me AND blocked_id = target_profile_id AND removed_at IS NULL) INTO v_by_viewer;
  RETURN jsonb_build_object(
    'can_view_profile', v_exists,
    'can_send_friend_request', v_exists AND NOT v_blocked AND v_me IS DISTINCT FROM target_profile_id,
    'can_message', v_exists AND NOT v_blocked AND v_me IS DISTINCT FROM target_profile_id,
    'can_invite_to_band', v_exists AND NOT v_blocked,
    'can_invite_to_activity', v_exists AND NOT v_blocked,
    'can_offer_job', v_exists AND NOT v_blocked,
    'can_send_money', v_exists AND NOT v_blocked,
    'can_send_item', v_exists AND NOT v_blocked,
    'can_report', v_exists AND v_me IS DISTINCT FROM target_profile_id,
    'is_blocked_by_viewer', v_by_viewer,
    'is_interaction_restricted', v_blocked OR NOT v_exists,
    'neutral_message', CASE WHEN NOT v_exists THEN 'This player is unavailable.' WHEN v_blocked THEN 'Interactions with this player are unavailable.' ELSE NULL END
  );
END;
$$;

-- ============ MESSAGING ============
CREATE OR REPLACE FUNCTION public.start_direct_conversation(recipient_profile_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_conversation uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  IF v_me = recipient_profile_id THEN RAISE EXCEPTION 'You cannot message yourself'; END IF;
  IF public.are_profiles_blocked(v_me, recipient_profile_id) THEN RAISE EXCEPTION 'This player is unavailable'; END IF;
  SELECT c.id INTO v_conversation
  FROM public.conversations c
  JOIN public.conversation_participants a ON a.conversation_id = c.id AND a.profile_id = v_me
  JOIN public.conversation_participants b ON b.conversation_id = c.id AND b.profile_id = recipient_profile_id
  WHERE c.type = 'direct'
  LIMIT 1;
  IF v_conversation IS NULL THEN
    INSERT INTO public.conversations (type) VALUES ('direct') RETURNING id INTO v_conversation;
    INSERT INTO public.conversation_participants (conversation_id, profile_id)
    VALUES (v_conversation, v_me), (v_conversation, recipient_profile_id);
  END IF;
  RETURN (SELECT to_jsonb(row) FROM (
    SELECT v_conversation AS conversation_id, 'direct'::text AS type, p.id AS other_profile_id, p.display_name AS other_display_name,
           p.username AS other_username, p.avatar_url AS other_avatar_url,
           c.last_message_id, c.last_message_at, c.last_message_preview,
           0 AS unread_count, cp.archived_at, cp.muted_until
    FROM public.conversations c
    JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.profile_id = v_me
    JOIN public.profiles p ON p.id = recipient_profile_id
    WHERE c.id = v_conversation
  ) row);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_conversations(
  include_archived boolean DEFAULT false, search_query text DEFAULT NULL,
  page_limit integer DEFAULT 30, before_activity_at timestamptz DEFAULT NULL)
RETURNS TABLE (
  conversation_id uuid, type text, other_profile_id uuid, other_display_name text, other_username text,
  other_avatar_url text, last_message_id uuid, last_message_at timestamptz, last_message_preview text,
  unread_count integer, archived_at timestamptz, muted_until timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id();
BEGIN
  IF v_me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.id, c.type, other.id, other.display_name::text, other.username::text, other.avatar_url,
         c.last_message_id, c.last_message_at, c.last_message_preview,
         (SELECT count(*)::int FROM public.direct_messages dm
            WHERE dm.conversation_id = c.id AND dm.sender_profile_id <> v_me
              AND (mine.last_read_at IS NULL OR dm.created_at > mine.last_read_at)),
         mine.archived_at, mine.muted_until
  FROM public.conversations c
  JOIN public.conversation_participants mine ON mine.conversation_id = c.id AND mine.profile_id = v_me
  JOIN public.conversation_participants theirs ON theirs.conversation_id = c.id AND theirs.profile_id <> v_me
  JOIN public.profiles other ON other.id = theirs.profile_id
  WHERE (include_archived OR mine.archived_at IS NULL)
    AND (search_query IS NULL OR other.display_name ILIKE '%' || search_query || '%' OR other.username ILIKE '%' || search_query || '%')
    AND (before_activity_at IS NULL OR coalesce(c.last_message_at, c.created_at) < before_activity_at)
    AND NOT public.are_profiles_blocked(v_me, other.id)
  ORDER BY coalesce(c.last_message_at, c.created_at) DESC
  LIMIT greatest(1, least(coalesce(page_limit, 30), 100));
END;
$$;

CREATE OR REPLACE FUNCTION public.send_conversation_message(
  conversation_id uuid, message_body text, client_message_id text DEFAULT NULL, reply_to_message_id uuid DEFAULT NULL)
RETURNS public.direct_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_other uuid; v_row public.direct_messages; v_body text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'No active character'; END IF;
  v_body := btrim(coalesce(message_body, ''));
  IF v_body = '' THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_participants.conversation_id = send_conversation_message.conversation_id AND profile_id = v_me) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT profile_id INTO v_other FROM public.conversation_participants
  WHERE conversation_participants.conversation_id = send_conversation_message.conversation_id AND profile_id <> v_me LIMIT 1;
  IF v_other IS NOT NULL AND public.are_profiles_blocked(v_me, v_other) THEN RAISE EXCEPTION 'This player is unavailable'; END IF;
  IF client_message_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.direct_messages dm
    WHERE dm.conversation_id = send_conversation_message.conversation_id AND dm.client_message_id = send_conversation_message.client_message_id LIMIT 1;
    IF v_row.id IS NOT NULL THEN RETURN v_row; END IF;
  END IF;
  INSERT INTO public.direct_messages (conversation_id, channel_id, sender_profile_id, recipient_profile_id, body, client_message_id, reply_to_message_id)
  VALUES (send_conversation_message.conversation_id,
          array_to_string(ARRAY(SELECT unnest(ARRAY[v_me::text, coalesce(v_other::text, v_me::text)]) ORDER BY 1), ':'),
          v_me, v_other, v_body, client_message_id, reply_to_message_id)
  RETURNING * INTO v_row;
  UPDATE public.conversations SET last_message_id = v_row.id, last_message_at = v_row.created_at,
         last_message_preview = left(v_body, 160), updated_at = now()
  WHERE id = send_conversation_message.conversation_id;
  UPDATE public.conversation_participants SET last_read_at = now(), updated_at = now()
  WHERE conversation_participants.conversation_id = send_conversation_message.conversation_id AND profile_id = v_me;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_direct_message(recipient_profile_id uuid, message_body text)
RETURNS public.direct_messages LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conversation uuid;
BEGIN
  v_conversation := ((public.start_direct_conversation(recipient_profile_id)) ->> 'conversation_id')::uuid;
  RETURN public.send_conversation_message(v_conversation, message_body, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(conversation_id uuid, read_message_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := public.current_profile_id(); v_at timestamptz := now();
BEGIN
  IF v_me IS NULL THEN RETURN false; END IF;
  IF read_message_id IS NOT NULL THEN
    SELECT created_at INTO v_at FROM public.direct_messages WHERE id = read_message_id;
    v_at := coalesce(v_at, now());
  END IF;
  UPDATE public.conversation_participants SET last_read_at = greatest(coalesce(last_read_at, v_at), v_at), updated_at = now()
  WHERE conversation_participants.conversation_id = mark_conversation_read.conversation_id AND profile_id = v_me;
  UPDATE public.direct_messages SET read_at = now()
  WHERE direct_messages.conversation_id = mark_conversation_read.conversation_id AND recipient_profile_id = v_me AND read_at IS NULL;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.are_profiles_blocked(uuid, uuid), public.is_profile_muted(uuid, uuid),
  public.block_player(uuid, text, text), public.block_profile(uuid, text), public.unblock_player(uuid), public.unblock_profile(uuid),
  public.mute_profile(uuid, timestamptz, text), public.unmute_profile(uuid),
  public.submit_player_report(uuid, text, text, text, uuid, text, jsonb, boolean),
  public.report_social_target(uuid, text, uuid, text, text, jsonb),
  public.send_friend_request(uuid), public.respond_to_friend_request(uuid, text), public.get_friend_request_counts(),
  public.get_connection_state(uuid), public.get_social_permissions(uuid),
  public.start_direct_conversation(uuid), public.list_conversations(boolean, text, integer, timestamptz),
  public.send_conversation_message(uuid, text, text, uuid), public.send_direct_message(uuid, text),
  public.mark_conversation_read(uuid, uuid) TO authenticated;