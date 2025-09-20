-- Create missing enums
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');
CREATE TYPE chat_participant_status AS ENUM ('online', 'offline', 'typing', 'away');

-- Add missing columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS equipment_loadout jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS experience_at_last_weekly_bonus integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_weekly_bonus_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS weekly_bonus_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_bonus_metadata jsonb DEFAULT '{}'::jsonb;

-- Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  friend_user_id uuid NOT NULL,
  user_profile_id uuid,
  friend_profile_id uuid,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, friend_user_id)
);

-- Enable RLS on friendships
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for friendships
CREATE POLICY "Users can view their own friendships" 
ON public.friendships 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() = friend_user_id);

CREATE POLICY "Users can create friendships" 
ON public.friendships 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their friendships" 
ON public.friendships 
FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() = friend_user_id);

-- Create chat_participants table
CREATE TABLE IF NOT EXISTS public.chat_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'general',
  status chat_participant_status NOT NULL DEFAULT 'offline',
  last_seen timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, channel)
);

-- Enable RLS on chat_participants
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for chat_participants
CREATE POLICY "Chat participants are viewable by everyone" 
ON public.chat_participants 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own participation" 
ON public.chat_participants 
FOR ALL 
USING (auth.uid() = user_id);

-- Create player_skills table
CREATE TABLE IF NOT EXISTS public.player_skills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  vocals integer DEFAULT 1,
  guitar integer DEFAULT 1,
  bass integer DEFAULT 1,
  drums integer DEFAULT 1,
  songwriting integer DEFAULT 1,
  performance integer DEFAULT 1,
  creativity integer DEFAULT 1,
  technical integer DEFAULT 1,
  business integer DEFAULT 1,
  marketing integer DEFAULT 1,
  composition integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on player_skills
ALTER TABLE public.player_skills ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_skills
CREATE POLICY "Users can view all player skills" 
ON public.player_skills 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own skills" 
ON public.player_skills 
FOR ALL 
USING (auth.uid() = user_id);

-- Create experience_ledger table
CREATE TABLE IF NOT EXISTS public.experience_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  profile_id uuid,
  activity_type text NOT NULL,
  xp_amount integer NOT NULL DEFAULT 0,
  skill_slug text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on experience_ledger
ALTER TABLE public.experience_ledger ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for experience_ledger
CREATE POLICY "Users can view their own experience" 
ON public.experience_ledger 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own experience entries" 
ON public.experience_ledger 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at columns
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chat_participants_updated_at
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_player_skills_updated_at
  BEFORE UPDATE ON public.player_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();