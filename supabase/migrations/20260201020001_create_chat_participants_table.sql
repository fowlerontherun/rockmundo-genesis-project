-- Upgrade the canonical chat presence schema created by
-- 20250920135913_6eb1b596-a672-4450-a6b9-557068e5b641.sql.
--
-- The original version of this migration attempted to recreate both the enum
-- and table, which fails on a clean rebuild. Preserve the existing multi-channel
-- presence model and apply only the intended moderation/realtime changes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'chat_participant_status'
  ) THEN
    ALTER TYPE public.chat_participant_status ADD VALUE IF NOT EXISTS 'muted';
  ELSE
    CREATE TYPE public.chat_participant_status AS ENUM (
      'online', 'offline', 'typing', 'away', 'muted'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'general',
  status public.chat_participant_status NOT NULL DEFAULT 'offline',
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel)
);

DROP TRIGGER IF EXISTS update_chat_participants_updated_at
  ON public.chat_participants;
CREATE TRIGGER update_chat_participants_updated_at
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Remove the earlier permissive ALL policy before installing the moderated
-- operation-specific policies. PostgreSQL combines permissive policies with OR,
-- so leaving it in place would allow users to bypass the muted-state checks.
DROP POLICY IF EXISTS "Users can manage their own participation"
  ON public.chat_participants;
DROP POLICY IF EXISTS "Chat participants are viewable by everyone"
  ON public.chat_participants;
DROP POLICY IF EXISTS "Users manage their own presence"
  ON public.chat_participants;
DROP POLICY IF EXISTS "Users update presence when not muted"
  ON public.chat_participants;
DROP POLICY IF EXISTS "Users can leave chat when not muted"
  ON public.chat_participants;
DROP POLICY IF EXISTS "Admins manage chat participants"
  ON public.chat_participants;

CREATE POLICY "Chat participants are viewable by everyone"
  ON public.chat_participants
  FOR SELECT
  USING (true);

CREATE POLICY "Users manage their own presence"
  ON public.chat_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status::text <> 'muted'
  );

CREATE POLICY "Users update presence when not muted"
  ON public.chat_participants
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status::text <> 'muted'
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status::text <> 'muted'
  );

CREATE POLICY "Users can leave chat when not muted"
  ON public.chat_participants
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND status::text <> 'muted'
  );

CREATE POLICY "Admins manage chat participants"
  ON public.chat_participants
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
  END IF;
END
$$;
