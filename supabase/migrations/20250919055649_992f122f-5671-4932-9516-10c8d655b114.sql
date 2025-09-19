-- Add missing attribute columns to player_attributes table
ALTER TABLE public.player_attributes 
ADD COLUMN IF NOT EXISTS musical_ability integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS vocal_talent integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS rhythm_sense integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS creative_insight integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS technical_mastery integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS business_acumen integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS marketing_savvy integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS attribute_points_spent integer DEFAULT 0;

-- Update existing records to have the new attributes
UPDATE public.player_attributes 
SET 
  musical_ability = COALESCE(musical_ability, 10),
  vocal_talent = COALESCE(vocal_talent, 10),
  rhythm_sense = COALESCE(rhythm_sense, 10),
  creative_insight = COALESCE(creative_insight, 10),
  technical_mastery = COALESCE(technical_mastery, 10),
  business_acumen = COALESCE(business_acumen, 10),
  marketing_savvy = COALESCE(marketing_savvy, 10),
  attribute_points_spent = COALESCE(attribute_points_spent, 0)
WHERE musical_ability IS NULL 
   OR vocal_talent IS NULL 
   OR rhythm_sense IS NULL 
   OR creative_insight IS NULL 
   OR technical_mastery IS NULL 
   OR business_acumen IS NULL 
   OR marketing_savvy IS NULL 
   OR attribute_points_spent IS NULL;

-- Add missing XP progression tables
CREATE TABLE IF NOT EXISTS public.player_xp_wallet (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_balance integer DEFAULT 0,
  lifetime_xp integer DEFAULT 0,
  xp_spent integer DEFAULT 0,
  attribute_points_earned integer DEFAULT 0,
  skill_points_earned integer DEFAULT 0,
  last_recalculated timestamptz DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.player_xp_wallet ENABLE ROW LEVEL SECURITY;

-- Create policies for player_xp_wallet
CREATE POLICY "Users can view their own XP wallet" 
ON public.player_xp_wallet 
FOR SELECT 
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own XP wallet" 
ON public.player_xp_wallet 
FOR UPDATE 
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own XP wallet" 
ON public.player_xp_wallet 
FOR INSERT 
WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create missing chat_messages table for realtime chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat_messages
CREATE POLICY "Chat messages are viewable by everyone" 
ON public.chat_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Users can post messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create missing skill_parent_links table for skill system
CREATE TABLE IF NOT EXISTS public.skill_parent_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  parent_skill_id uuid NOT NULL REFERENCES public.skill_definitions(id) ON DELETE CASCADE,
  unlock_threshold integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on skill_parent_links
ALTER TABLE public.skill_parent_links ENABLE ROW LEVEL SECURITY;

-- Create policies for skill_parent_links
CREATE POLICY "Skill parent links are viewable by everyone" 
ON public.skill_parent_links 
FOR SELECT 
USING (true);

-- Initialize XP wallets for existing profiles
INSERT INTO public.player_xp_wallet (profile_id, xp_balance, lifetime_xp)
SELECT id, experience, experience 
FROM public.profiles 
WHERE id NOT IN (SELECT profile_id FROM public.player_xp_wallet)
ON CONFLICT (profile_id) DO NOTHING;