-- Create song themes table
CREATE TABLE public.song_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  mood VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chord progressions table
CREATE TABLE public.chord_progressions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL,
  progression VARCHAR NOT NULL,
  difficulty INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create songwriting projects table
CREATE TABLE public.songwriting_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title VARCHAR NOT NULL,
  theme_id UUID REFERENCES public.song_themes(id),
  chord_progression_id UUID REFERENCES public.chord_progressions(id),
  initial_lyrics TEXT,
  music_progress INTEGER DEFAULT 0,
  lyrics_progress INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  estimated_sessions INTEGER DEFAULT 3,
  quality_score INTEGER DEFAULT 0,
  status VARCHAR DEFAULT 'writing',
  is_locked BOOLEAN DEFAULT false,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create songwriting sessions table
CREATE TABLE public.songwriting_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.songwriting_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  music_progress_gained INTEGER DEFAULT 0,
  lyrics_progress_gained INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.song_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chord_progressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songwriting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songwriting_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for song_themes
CREATE POLICY "Song themes are viewable by everyone" 
ON public.song_themes 
FOR SELECT 
USING (true);

-- RLS Policies for chord_progressions
CREATE POLICY "Chord progressions are viewable by everyone" 
ON public.chord_progressions 
FOR SELECT 
USING (true);

-- RLS Policies for songwriting_projects
CREATE POLICY "Users can view their own songwriting projects" 
ON public.songwriting_projects 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own songwriting projects" 
ON public.songwriting_projects 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own songwriting projects" 
ON public.songwriting_projects 
FOR UPDATE 
USING (auth.uid() = user_id);

-- RLS Policies for songwriting_sessions
CREATE POLICY "Users can view their own songwriting sessions" 
ON public.songwriting_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own songwriting sessions" 
ON public.songwriting_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add new columns to songs table
ALTER TABLE public.songs 
ADD COLUMN IF NOT EXISTS music_progress INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS lyrics_progress INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS theme_id UUID REFERENCES public.song_themes(id),
ADD COLUMN IF NOT EXISTS chord_progression_id UUID REFERENCES public.chord_progressions(id),
ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS songwriting_project_id UUID REFERENCES public.songwriting_projects(id);

-- Create update trigger for songwriting projects
CREATE TRIGGER update_songwriting_projects_updated_at
BEFORE UPDATE ON public.songwriting_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample themes
INSERT INTO public.song_themes (name, description, mood) VALUES
('Love & Romance', 'Songs about love, relationships, and romance', 'romantic'),
('Heartbreak & Loss', 'Songs about breakups, loss, and sadness', 'melancholic'),
('Party & Celebration', 'Upbeat songs for parties and celebrations', 'energetic'),
('Freedom & Adventure', 'Songs about freedom, travel, and adventure', 'adventurous'),
('Social Issues', 'Songs addressing social and political issues', 'serious'),
('Dreams & Aspirations', 'Songs about hopes, dreams, and goals', 'hopeful'),
('Nostalgia & Memories', 'Songs about the past and memories', 'nostalgic'),
('Rebellion & Protest', 'Songs about rebellion and standing up', 'rebellious'),
('Friendship & Unity', 'Songs about friendship and togetherness', 'uplifting'),
('Nature & Environment', 'Songs inspired by nature and the environment', 'peaceful'),
('City Life', 'Songs about urban life and city experiences', 'urban'),
('Small Town', 'Songs about small town life and community', 'folksy'),
('Success & Fame', 'Songs about making it and achieving success', 'triumphant'),
('Struggle & Hardship', 'Songs about overcoming difficulties', 'determined'),
('Faith & Spirituality', 'Songs about faith, spirituality, and belief', 'spiritual'),
('Youth & Growing Up', 'Songs about youth and coming of age', 'youthful'),
('Work & Labor', 'Songs about work, jobs, and labor', 'working'),
('Fun & Humor', 'Light-hearted and funny songs', 'playful'),
('Mystery & Intrigue', 'Songs with mysterious or dark themes', 'mysterious'),
('Hope & Inspiration', 'Uplifting and inspirational songs', 'inspiring');

-- Insert sample chord progressions
INSERT INTO public.chord_progressions (name, progression, difficulty) VALUES
('I-V-vi-IV (Pop)', 'C-G-Am-F', 1),
('vi-IV-I-V (Pop/Rock)', 'Am-F-C-G', 1),
('I-vi-IV-V (50s Progression)', 'C-Am-F-G', 1),
('ii-V-I (Jazz)', 'Dm-G-C', 2),
('I-VII-IV-I (Rock)', 'C-Bb-F-C', 2),
('vi-V-IV-V (Sad)', 'Am-G-F-G', 1),
('I-bVII-IV-I (Mixolydian)', 'C-Bb-F-C', 2),
('i-VI-III-VII (Minor)', 'Am-F-C-G', 2),
('I-iii-vi-IV (Circle)', 'C-Em-Am-F', 2),
('I-IV-vi-V (Classic)', 'C-F-Am-G', 1);

-- Create function to calculate songwriting progress
CREATE OR REPLACE FUNCTION calculate_songwriting_progress(
  p_skill_songwriting INTEGER,
  p_skill_creativity INTEGER,
  p_skill_composition INTEGER,
  p_attr_creative_insight INTEGER,
  p_attr_musical_ability INTEGER,
  p_current_music INTEGER,
  p_current_lyrics INTEGER
) RETURNS JSONB AS $$
DECLARE
  skill_bonus NUMERIC;
  attr_bonus NUMERIC;
  base_progress INTEGER;
  music_gain INTEGER;
  lyrics_gain INTEGER;
  remaining_music INTEGER;
  remaining_lyrics INTEGER;
BEGIN
  -- Calculate skill and attribute bonuses
  skill_bonus := (COALESCE(p_skill_songwriting, 1) + COALESCE(p_skill_creativity, 1) + COALESCE(p_skill_composition, 1)) / 3.0;
  attr_bonus := (COALESCE(p_attr_creative_insight, 10) + COALESCE(p_attr_musical_ability, 10)) / 20.0;
  
  -- Base progress per session (30-50% range)
  base_progress := 600 + FLOOR(RANDOM() * 400); -- 600-1000 base points
  
  -- Apply bonuses
  base_progress := FLOOR(base_progress * (1 + skill_bonus / 100.0) * attr_bonus);
  
  -- Calculate remaining work
  remaining_music := GREATEST(0, 2000 - COALESCE(p_current_music, 0));
  remaining_lyrics := GREATEST(0, 2000 - COALESCE(p_current_lyrics, 0));
  
  -- Distribute progress between music and lyrics
  music_gain := FLOOR(base_progress * (0.4 + RANDOM() * 0.2)); -- 40-60% to music
  lyrics_gain := base_progress - music_gain;
  
  -- Cap gains to remaining work
  music_gain := LEAST(music_gain, remaining_music);
  lyrics_gain := LEAST(lyrics_gain, remaining_lyrics);
  
  RETURN jsonb_build_object(
    'music_gain', music_gain,
    'lyrics_gain', lyrics_gain,
    'xp_earned', FLOOR((music_gain + lyrics_gain) / 10),
    'skill_bonus', skill_bonus,
    'attr_bonus', attr_bonus
  );
END;
$$ LANGUAGE plpgsql;