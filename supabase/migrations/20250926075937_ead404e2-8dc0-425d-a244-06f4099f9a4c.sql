-- Create missing player_skills table
CREATE TABLE public.player_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  vocals INTEGER NOT NULL DEFAULT 1,
  guitar INTEGER NOT NULL DEFAULT 1,
  bass INTEGER NOT NULL DEFAULT 1,
  drums INTEGER NOT NULL DEFAULT 1,
  songwriting INTEGER NOT NULL DEFAULT 1,
  performance INTEGER NOT NULL DEFAULT 1,
  creativity INTEGER NOT NULL DEFAULT 1,
  technical INTEGER NOT NULL DEFAULT 1,
  business INTEGER NOT NULL DEFAULT 1,
  marketing INTEGER NOT NULL DEFAULT 1,
  composition INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for player_skills
ALTER TABLE public.player_skills ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_skills
CREATE POLICY "Users can view their own skills" 
ON public.player_skills 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own skills" 
ON public.player_skills 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own skills" 
ON public.player_skills 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create missing profile_daily_xp_grants table
CREATE TABLE public.profile_daily_xp_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  grant_date DATE NOT NULL DEFAULT CURRENT_DATE,
  xp_amount INTEGER NOT NULL DEFAULT 0,
  source VARCHAR NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for profile_daily_xp_grants
ALTER TABLE public.profile_daily_xp_grants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profile_daily_xp_grants
CREATE POLICY "Users can view their own XP grants" 
ON public.profile_daily_xp_grants 
FOR SELECT 
USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their own XP grants" 
ON public.profile_daily_xp_grants 
FOR INSERT 
WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Create missing education_youtube_resources table
CREATE TABLE public.education_youtube_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR NOT NULL,
  description TEXT,
  video_url VARCHAR NOT NULL,
  category VARCHAR,
  difficulty_level INTEGER DEFAULT 1,
  duration_minutes INTEGER,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for education_youtube_resources
ALTER TABLE public.education_youtube_resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for education_youtube_resources (viewable by everyone)
CREATE POLICY "YouTube resources are viewable by everyone" 
ON public.education_youtube_resources 
FOR SELECT 
USING (true);

-- Add missing current_city_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN current_city_id UUID;

-- Create trigger for player_skills updated_at
CREATE TRIGGER update_player_skills_updated_at
BEFORE UPDATE ON public.player_skills
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for education_youtube_resources updated_at  
CREATE TRIGGER update_education_youtube_resources_updated_at
BEFORE UPDATE ON public.education_youtube_resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();