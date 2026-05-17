
-- =========================================================
-- Unified Social Hub: direct messages + invites
-- =========================================================

-- Invite kind / status enums
DO $$ BEGIN
  CREATE TYPE public.social_invite_kind AS ENUM ('gig','recording','jam','songwriting','meetup','date');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.social_invite_status AS ENUM ('pending','accepted','declined','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------
-- direct_messages
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  sender_profile_id UUID NOT NULL,
  recipient_profile_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_channel_created
  ON public.direct_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_unread
  ON public.direct_messages (recipient_profile_id) WHERE read_at IS NULL;

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- helper: profile belongs to current user
CREATE OR REPLACE FUNCTION public.profile_belongs_to_current_user(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _profile_id AND user_id = auth.uid()
  );
$$;

CREATE POLICY "DM read by participants"
ON public.direct_messages FOR SELECT
USING (
  public.profile_belongs_to_current_user(sender_profile_id)
  OR public.profile_belongs_to_current_user(recipient_profile_id)
);

CREATE POLICY "DM insert by sender"
ON public.direct_messages FOR INSERT
WITH CHECK (
  public.profile_belongs_to_current_user(sender_profile_id)
  AND sender_profile_id <> recipient_profile_id
);

CREATE POLICY "DM mark read by recipient"
ON public.direct_messages FOR UPDATE
USING (public.profile_belongs_to_current_user(recipient_profile_id))
WITH CHECK (public.profile_belongs_to_current_user(recipient_profile_id));

CREATE POLICY "DM delete by sender"
ON public.direct_messages FOR DELETE
USING (public.profile_belongs_to_current_user(sender_profile_id));

-- ---------------------------------------------------------
-- social_invites
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_profile_id UUID NOT NULL,
  to_profile_id UUID NOT NULL,
  kind public.social_invite_kind NOT NULL,
  ref_id UUID,
  scheduled_at TIMESTAMPTZ,
  location_city_id UUID,
  message TEXT,
  status public.social_invite_status NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_invites_distinct_parties CHECK (from_profile_id <> to_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_social_invites_to_status
  ON public.social_invites (to_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_social_invites_from_status
  ON public.social_invites (from_profile_id, status);

ALTER TABLE public.social_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Invite visible to both parties"
ON public.social_invites FOR SELECT
USING (
  public.profile_belongs_to_current_user(from_profile_id)
  OR public.profile_belongs_to_current_user(to_profile_id)
);

CREATE POLICY "Invite created by sender"
ON public.social_invites FOR INSERT
WITH CHECK (public.profile_belongs_to_current_user(from_profile_id));

CREATE POLICY "Invite updated by either party"
ON public.social_invites FOR UPDATE
USING (
  public.profile_belongs_to_current_user(from_profile_id)
  OR public.profile_belongs_to_current_user(to_profile_id)
)
WITH CHECK (
  public.profile_belongs_to_current_user(from_profile_id)
  OR public.profile_belongs_to_current_user(to_profile_id)
);

CREATE POLICY "Invite deleted by sender"
ON public.social_invites FOR DELETE
USING (public.profile_belongs_to_current_user(from_profile_id));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_social_invites_touch ON public.social_invites;
CREATE TRIGGER trg_social_invites_touch
BEFORE UPDATE ON public.social_invites
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.social_invites REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.social_invites;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
