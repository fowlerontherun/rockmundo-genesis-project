-- Friendship lifecycle hardening: canonical pairs, server-side actions, counts and mutuals.

ALTER TYPE public.friendship_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.friendship_status ADD VALUE IF NOT EXISTS 'removed';
ALTER TYPE public.friendship_status ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE public.friendships
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS friendships_pending_lookup_idx ON public.friendships (addressee_id, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS friendships_accepted_lookup_idx ON public.friendships (LEAST(requestor_id, addressee_id), GREATEST(requestor_id, addressee_id)) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS friendships_recent_activity_idx ON public.friendships (updated_at DESC, status);

CREATE TABLE IF NOT EXISTS public.friendship_settings (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  friendship_visibility text NOT NULL DEFAULT 'public' CHECK (friendship_visibility IN ('public','friends_only','band_members_only','private')),
  allow_friend_requests text NOT NULL DEFAULT 'everyone' CHECK (allow_friend_requests IN ('everyone','same_city','band_connections','mutual_connections','none')),
  show_friend_count boolean NOT NULL DEFAULT true,
  show_mutual_friends boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.friendship_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage friendship settings" ON public.friendship_settings;
CREATE POLICY "Owners manage friendship settings" ON public.friendship_settings FOR ALL
USING (public.profile_belongs_to_current_user(profile_id))
WITH CHECK (public.profile_belongs_to_current_user(profile_id));

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid() ORDER BY p.created_at ASC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_connection_state(target_profile_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer uuid := public.current_profile_id(); f public.friendships; target_exists boolean; allow_mode text;
BEGIN
  IF viewer IS NULL THEN RETURN 'unavailable'; END IF;
  IF target_profile_id IS NULL THEN RETURN 'unavailable'; END IF;
  IF viewer = target_profile_id THEN RETURN 'self'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_profile_id) INTO target_exists;
  IF NOT target_exists THEN RETURN 'unavailable'; END IF;
  IF public.are_profiles_blocked(viewer, target_profile_id) THEN RETURN 'restricted'; END IF;
  SELECT * INTO f FROM public.friendships WHERE (requestor_id = viewer AND addressee_id = target_profile_id) OR (requestor_id = target_profile_id AND addressee_id = viewer) LIMIT 1;
  IF f.status = 'accepted'::public.friendship_status THEN RETURN 'friends'; END IF;
  IF f.status = 'pending'::public.friendship_status AND f.requestor_id = viewer THEN RETURN 'outgoing_pending'; END IF;
  IF f.status = 'pending'::public.friendship_status AND f.addressee_id = viewer THEN RETURN 'incoming_pending'; END IF;
  IF f.status = 'blocked'::public.friendship_status THEN RETURN 'restricted'; END IF;
  SELECT COALESCE(fs.allow_friend_requests, 'everyone') INTO allow_mode FROM public.friendship_settings fs WHERE fs.profile_id = target_profile_id;
  IF allow_mode = 'none' THEN RETURN 'restricted'; END IF;
  RETURN 'not_connected';
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_friend_request(friendship_id uuid, next_status public.friendship_status)
RETURNS public.friendships LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE viewer uuid := public.current_profile_id(); row public.friendships;
BEGIN
  SELECT * INTO row FROM public.friendships WHERE id = friendship_id FOR UPDATE;
  IF row.id IS NULL THEN RAISE EXCEPTION 'Friend request is no longer available.' USING ERRCODE = '22023'; END IF;
  IF next_status = 'accepted'::public.friendship_status THEN
    IF row.addressee_id <> viewer OR row.status <> 'pending'::public.friendship_status THEN RAISE EXCEPTION 'You cannot accept this request.' USING ERRCODE = '42501'; END IF;
    UPDATE public.friendships SET status = next_status, responded_at = now(), accepted_at = now(), updated_at = now() WHERE id = friendship_id RETURNING * INTO row;
  ELSIF next_status = 'declined'::public.friendship_status THEN
    IF row.addressee_id <> viewer OR row.status <> 'pending'::public.friendship_status THEN RAISE EXCEPTION 'You cannot decline this request.' USING ERRCODE = '42501'; END IF;
    UPDATE public.friendships SET status = next_status, responded_at = now(), declined_at = now(), updated_at = now() WHERE id = friendship_id RETURNING * INTO row;
  ELSIF next_status::text = 'cancelled' THEN
    IF row.requestor_id <> viewer OR row.status <> 'pending'::public.friendship_status THEN RAISE EXCEPTION 'You cannot cancel this request.' USING ERRCODE = '42501'; END IF;
    UPDATE public.friendships SET status = next_status, responded_at = now(), cancelled_at = now(), updated_at = now() WHERE id = friendship_id RETURNING * INTO row;
  ELSIF next_status::text = 'removed' THEN
    IF viewer NOT IN (row.requestor_id, row.addressee_id) OR row.status <> 'accepted'::public.friendship_status THEN RAISE EXCEPTION 'You cannot remove this friendship.' USING ERRCODE = '42501'; END IF;
    UPDATE public.friendships SET status = next_status, removed_at = now(), updated_at = now() WHERE id = friendship_id RETURNING * INTO row;
  ELSE
    RAISE EXCEPTION 'Unsupported friendship action.' USING ERRCODE = '22023';
  END IF;
  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_request_counts()
RETURNS TABLE(friends bigint, incoming bigint, outgoing bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT public.current_profile_id() id)
  SELECT
    COUNT(*) FILTER (WHERE f.status = 'accepted') AS friends,
    COUNT(*) FILTER (WHERE f.status = 'pending' AND f.addressee_id = me.id) AS incoming,
    COUNT(*) FILTER (WHERE f.status = 'pending' AND f.requestor_id = me.id) AS outgoing
  FROM public.friendships f, me
  WHERE me.id IN (f.requestor_id, f.addressee_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_connection_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(uuid, public.friendship_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_request_counts() TO authenticated;
