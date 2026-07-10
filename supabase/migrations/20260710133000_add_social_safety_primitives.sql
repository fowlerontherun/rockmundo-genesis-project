BEGIN;

CREATE TYPE public.social_report_target_type AS ENUM ('profile', 'direct_message', 'social_invite', 'band', 'company', 'twaater_post', 'chat_message', 'other');
CREATE TYPE public.social_report_category AS ENUM ('harassment', 'spam', 'hate', 'sexual_content', 'threats', 'impersonation', 'scam', 'self_harm', 'other');
CREATE TYPE public.social_report_status AS ENUM ('open', 'triaged', 'actioned', 'dismissed');
CREATE TYPE public.social_action_audit_kind AS ENUM ('block', 'unblock', 'mute', 'unmute', 'report');

CREATE TABLE public.social_profile_blocks (
  blocker_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (blocker_profile_id, blocked_profile_id),
  CONSTRAINT social_profile_blocks_no_self CHECK (blocker_profile_id <> blocked_profile_id),
  CONSTRAINT social_profile_blocks_reason_length CHECK (reason IS NULL OR char_length(reason) <= 280)
);

COMMENT ON TABLE public.social_profile_blocks IS 'Dedicated cross-system player safety blocks. Blocks are owner-managed and consumed by shared social guards.';
COMMENT ON COLUMN public.social_profile_blocks.reason IS 'Optional private owner note; not visible to the blocked profile.';

CREATE INDEX social_profile_blocks_blocked_idx ON public.social_profile_blocks (blocked_profile_id, created_at DESC);

CREATE TABLE public.social_profile_mutes (
  muter_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (muter_profile_id, muted_profile_id),
  CONSTRAINT social_profile_mutes_no_self CHECK (muter_profile_id <> muted_profile_id),
  CONSTRAINT social_profile_mutes_reason_length CHECK (reason IS NULL OR char_length(reason) <= 280)
);

COMMENT ON TABLE public.social_profile_mutes IS 'Owner-managed social mutes for future feed, notification, and communication suppression.';

CREATE INDEX social_profile_mutes_muted_idx ON public.social_profile_mutes (muted_profile_id, created_at DESC);
CREATE INDEX social_profile_mutes_active_idx ON public.social_profile_mutes (muter_profile_id, muted_profile_id, expires_at);

CREATE TABLE public.social_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type public.social_report_target_type NOT NULL,
  target_id uuid,
  category public.social_report_category NOT NULL,
  reason text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.social_report_status NOT NULL DEFAULT 'open',
  moderator_notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  resolved_at timestamptz,
  CONSTRAINT social_reports_reason_length CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  CONSTRAINT social_reports_context_object CHECK (jsonb_typeof(context) = 'object'),
  CONSTRAINT social_reports_target_present CHECK (reported_profile_id IS NOT NULL OR target_id IS NOT NULL)
);

COMMENT ON TABLE public.social_reports IS 'Private player-submitted social safety reports retained for future moderation review.';
COMMENT ON COLUMN public.social_reports.context IS 'Optional sanitized context such as route, message preview, or client surface; never store auth internals or private emails.';

CREATE INDEX social_reports_reporter_idx ON public.social_reports (reporter_profile_id, created_at DESC);
CREATE INDEX social_reports_reported_idx ON public.social_reports (reported_profile_id, created_at DESC) WHERE reported_profile_id IS NOT NULL;
CREATE INDEX social_reports_status_idx ON public.social_reports (status, created_at DESC);
CREATE INDEX social_reports_target_idx ON public.social_reports (target_type, target_id) WHERE target_id IS NOT NULL;

CREATE TABLE public.social_action_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action public.social_action_audit_kind NOT NULL,
  target_type public.social_report_target_type,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT social_action_audit_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE public.social_action_audit_log IS 'Append-only lightweight audit trail for retryable social safety actions.';

CREATE INDEX social_action_audit_actor_idx ON public.social_action_audit_log (actor_profile_id, created_at DESC);
CREATE INDEX social_action_audit_target_idx ON public.social_action_audit_log (target_profile_id, created_at DESC) WHERE target_profile_id IS NOT NULL;

ALTER TABLE public.social_profile_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_profile_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_action_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profile owners manage their blocks" ON public.social_profile_blocks
  FOR ALL USING (public.profile_belongs_to_current_user(blocker_profile_id))
  WITH CHECK (public.profile_belongs_to_current_user(blocker_profile_id));

CREATE POLICY "Profile owners manage their mutes" ON public.social_profile_mutes
  FOR ALL USING (public.profile_belongs_to_current_user(muter_profile_id))
  WITH CHECK (public.profile_belongs_to_current_user(muter_profile_id));

CREATE POLICY "Reporters can create reports" ON public.social_reports
  FOR INSERT WITH CHECK (public.profile_belongs_to_current_user(reporter_profile_id));

CREATE POLICY "Reporters can view their reports" ON public.social_reports
  FOR SELECT USING (public.profile_belongs_to_current_user(reporter_profile_id));

CREATE POLICY "Actors can view their social safety audit log" ON public.social_action_audit_log
  FOR SELECT USING (public.profile_belongs_to_current_user(actor_profile_id));

CREATE TRIGGER update_social_profile_blocks_updated_at
  BEFORE UPDATE ON public.social_profile_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_profile_mutes_updated_at
  BEFORE UPDATE ON public.social_profile_mutes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_social_reports_updated_at
  BEFORE UPDATE ON public.social_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.are_profiles_blocked(first_profile_id uuid, second_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_profile_blocks b
    WHERE (b.blocker_profile_id = first_profile_id AND b.blocked_profile_id = second_profile_id)
       OR (b.blocker_profile_id = second_profile_id AND b.blocked_profile_id = first_profile_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'blocked'::public.friendship_status
      AND (
        (f.requestor_id = first_profile_id AND f.addressee_id = second_profile_id)
        OR (f.requestor_id = second_profile_id AND f.addressee_id = first_profile_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_profile_muted(viewer_profile_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.social_profile_mutes m
    WHERE m.muter_profile_id = viewer_profile_id
      AND m.muted_profile_id = target_profile_id
      AND (m.expires_at IS NULL OR m.expires_at > timezone('utc', now()))
  );
$$;

CREATE OR REPLACE FUNCTION public.block_profile(target_profile_id uuid, note text DEFAULT NULL)
RETURNS public.social_profile_blocks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  block_row public.social_profile_blocks;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required'; END IF;
  IF target_profile_id IS NULL OR target_profile_id = actor_profile_id THEN RAISE EXCEPTION 'Choose another player to block'; END IF;
  IF note IS NOT NULL AND char_length(note) > 280 THEN RAISE EXCEPTION 'Block note must be 280 characters or fewer'; END IF;

  INSERT INTO public.social_profile_blocks (blocker_profile_id, blocked_profile_id, reason)
  VALUES (actor_profile_id, target_profile_id, NULLIF(btrim(note), ''))
  ON CONFLICT (blocker_profile_id, blocked_profile_id)
  DO UPDATE SET reason = COALESCE(EXCLUDED.reason, public.social_profile_blocks.reason), updated_at = timezone('utc', now())
  RETURNING * INTO block_row;

  DELETE FROM public.social_profile_mutes WHERE muter_profile_id = actor_profile_id AND muted_profile_id = target_profile_id;
  INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action)
  VALUES (actor_profile_id, target_profile_id, 'block');
  RETURN block_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor_profile_id uuid;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required'; END IF;
  DELETE FROM public.social_profile_blocks WHERE blocker_profile_id = actor_profile_id AND blocked_profile_id = target_profile_id;
  INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action) VALUES (actor_profile_id, target_profile_id, 'unblock');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.mute_profile(target_profile_id uuid, mute_until timestamptz DEFAULT NULL, note text DEFAULT NULL)
RETURNS public.social_profile_mutes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  mute_row public.social_profile_mutes;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required'; END IF;
  IF target_profile_id IS NULL OR target_profile_id = actor_profile_id THEN RAISE EXCEPTION 'Choose another player to mute'; END IF;
  IF note IS NOT NULL AND char_length(note) > 280 THEN RAISE EXCEPTION 'Mute note must be 280 characters or fewer'; END IF;

  INSERT INTO public.social_profile_mutes (muter_profile_id, muted_profile_id, expires_at, reason)
  VALUES (actor_profile_id, target_profile_id, mute_until, NULLIF(btrim(note), ''))
  ON CONFLICT (muter_profile_id, muted_profile_id)
  DO UPDATE SET expires_at = EXCLUDED.expires_at, reason = COALESCE(EXCLUDED.reason, public.social_profile_mutes.reason), updated_at = timezone('utc', now())
  RETURNING * INTO mute_row;

  INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action) VALUES (actor_profile_id, target_profile_id, 'mute');
  RETURN mute_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.unmute_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE actor_profile_id uuid;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required'; END IF;
  DELETE FROM public.social_profile_mutes WHERE muter_profile_id = actor_profile_id AND muted_profile_id = target_profile_id;
  INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action) VALUES (actor_profile_id, target_profile_id, 'unmute');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_social_target(
  reported_profile_id uuid,
  target_type public.social_report_target_type,
  target_id uuid,
  category public.social_report_category,
  reason text,
  context jsonb DEFAULT '{}'::jsonb
)
RETURNS public.social_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_profile_id uuid;
  report_row public.social_reports;
BEGIN
  SELECT p.id INTO actor_profile_id FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
  IF actor_profile_id IS NULL THEN RAISE EXCEPTION 'Active profile is required'; END IF;
  IF reported_profile_id IS NULL AND target_id IS NULL THEN RAISE EXCEPTION 'Report target is required'; END IF;
  IF reported_profile_id = actor_profile_id THEN RAISE EXCEPTION 'You cannot report yourself'; END IF;
  IF reason IS NULL OR char_length(btrim(reason)) < 10 OR char_length(btrim(reason)) > 2000 THEN RAISE EXCEPTION 'Report reason must be 10 to 2000 characters'; END IF;
  IF context IS NULL OR jsonb_typeof(context) <> 'object' THEN RAISE EXCEPTION 'Report context must be an object'; END IF;

  INSERT INTO public.social_reports (reporter_profile_id, reported_profile_id, target_type, target_id, category, reason, context)
  VALUES (actor_profile_id, reported_profile_id, target_type, target_id, category, btrim(reason), context)
  RETURNING * INTO report_row;

  INSERT INTO public.social_action_audit_log (actor_profile_id, target_profile_id, action, target_type, target_id, metadata)
  VALUES (actor_profile_id, reported_profile_id, 'report', target_type, target_id, jsonb_build_object('category', category));
  RETURN report_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_profile_muted(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mute_profile(uuid, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmute_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_social_target(uuid, public.social_report_target_type, uuid, public.social_report_category, text, jsonb) TO authenticated;

COMMIT;
