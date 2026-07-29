-- Social and progression compatibility bundle.
-- The base schema already owns player_skills, so this migration extends it
-- instead of relying on CREATE TABLE IF NOT EXISTS to apply missing columns.

DO $$
BEGIN
  CREATE TYPE public.friendship_status AS ENUM (
    'pending', 'accepted', 'declined', 'blocked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.chat_participant_status AS ENUM (
    'online', 'offline', 'typing', 'away'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipment_loadout jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS experience_at_last_weekly_bonus integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_weekly_bonus_at timestamptz,
  ADD COLUMN IF NOT EXISTS weekly_bonus_streak integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_bonus_metadata jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  friend_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, friend_user_id),
  CHECK (user_id <> friend_user_id)
);

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

ALTER TABLE public.player_skills
  ADD COLUMN IF NOT EXISTS creativity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS technical integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS business integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS marketing integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS composition integer DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.experience_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type text NOT NULL,
  xp_amount integer NOT NULL DEFAULT 0,
  skill_slug text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_user_id);

DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
CREATE POLICY "Users can create friendships"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their friendships" ON public.friendships;
CREATE POLICY "Users can update their friendships"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_user_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_user_id);

DROP POLICY IF EXISTS "Chat participants are viewable by everyone" ON public.chat_participants;
CREATE POLICY "Chat participants are viewable by everyone"
  ON public.chat_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own participation" ON public.chat_participants;
CREATE POLICY "Users can manage their own participation"
  ON public.chat_participants FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view all player skills" ON public.player_skills;
CREATE POLICY "Users can view all player skills"
  ON public.player_skills FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own skills" ON public.player_skills;
CREATE POLICY "Users can manage their own skills"
  ON public.player_skills FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own experience" ON public.experience_ledger;
CREATE POLICY "Users can view their own experience"
  ON public.experience_ledger FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own experience entries" ON public.experience_ledger;
CREATE POLICY "Users can create their own experience entries"
  ON public.experience_ledger FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_friendships_updated_at ON public.friendships;
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_participants_updated_at ON public.chat_participants;
CREATE TRIGGER update_chat_participants_updated_at
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_player_skills_updated_at ON public.player_skills;
CREATE TRIGGER update_player_skills_updated_at
  BEFORE UPDATE ON public.player_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
