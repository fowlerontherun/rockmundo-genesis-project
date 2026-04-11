
-- Add rotation columns to dikcok_challenges
ALTER TABLE public.dikcok_challenges 
ADD COLUMN IF NOT EXISTS week_number integer,
ADD COLUMN IF NOT EXISTS recurring boolean DEFAULT false;

-- Create fan tips table
CREATE TABLE public.dikcok_fan_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.dikcok_videos(id) ON DELETE CASCADE,
  tipper_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dikcok_fan_tips ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can tip (as themselves)
CREATE POLICY "Users can create tips as themselves"
ON public.dikcok_fan_tips FOR INSERT TO authenticated
WITH CHECK (
  tipper_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Users can see tips they sent
CREATE POLICY "Users can view tips they sent"
ON public.dikcok_fan_tips FOR SELECT TO authenticated
USING (
  tipper_profile_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Video owners can see tips on their videos
CREATE POLICY "Video owners can view tips on their videos"
ON public.dikcok_fan_tips FOR SELECT TO authenticated
USING (
  video_id IN (
    SELECT v.id FROM public.dikcok_videos v
    JOIN public.band_members bm ON bm.band_id = v.band_id
    JOIN public.profiles p ON p.id = bm.profile_id
    WHERE p.user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_dikcok_fan_tips_video ON public.dikcok_fan_tips(video_id);
CREATE INDEX idx_dikcok_fan_tips_tipper ON public.dikcok_fan_tips(tipper_profile_id);

-- Rotation function
CREATE OR REPLACE FUNCTION public.rotate_weekly_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_week integer;
  template record;
  themes text[] := ARRAY['Acoustic Unplugged', 'Cover Battle', 'Behind the Scenes', 'Fan Duet', 'Genre Mashup', 'Neon Nights', 'Throwback Vibes', 'Studio Sessions', 'Street Performance', 'Collaboration Clash', 'Remix Royale', 'One Take Wonder'];
  req_pool text[][] := ARRAY[
    ARRAY['Use Stage POV effect', 'Tag the challenge hashtag'],
    ARRAY['Feature merch in frame', 'Include Story Capsule effect'],
    ARRAY['Remix a fan stem', 'Use Sponsor Remix effect'],
    ARRAY['Record in one continuous take', 'Show your instrument'],
    ARRAY['Collab with another band', 'Use split screen effect'],
    ARRAY['Film at a venue', 'Include crowd reaction'],
    ARRAY['Cover a classic song', 'Add your own twist'],
    ARRAY['Show behind-the-scenes footage', 'Include band members'],
    ARRAY['Acoustic version only', 'Natural lighting required'],
    ARRAY['Film outdoors', 'Include street sounds']
  ];
  reward_pool text[][] := ARRAY[
    ARRAY['Front-page pin', '+500 hype bonus'],
    ARRAY['Co-created merch slot', '+$200 cash prize'],
    ARRAY['Studio time credit', '+1000 fame boost'],
    ARRAY['+300 hype bonus', 'Featured on trending page'],
    ARRAY['+$100 cash prize', 'Exclusive badge']
  ];
  sponsors text[] := ARRAY['Glowwave Energy', 'Pulse Threads', 'Nova Audio Lab', 'SoundForge Picks', 'VoltAmp Gear', 'BeatBox Studios', NULL, NULL];
  hooks text[] := ARRAY['Boosts arena hype meter', 'Increases merch conversion', 'Applies to recording quality', 'Unlocks bonus fan missions', NULL, NULL];
  chosen_theme text;
  chosen_reqs text[];
  chosen_rewards text[];
  chosen_sponsor text;
  chosen_hook text;
BEGIN
  current_week := EXTRACT(WEEK FROM now())::integer;
  
  -- Deactivate expired challenges
  UPDATE dikcok_challenges SET is_active = false WHERE ends_at < now() AND is_active = true;
  
  -- Check if we already have an active challenge for this week
  IF EXISTS (SELECT 1 FROM dikcok_challenges WHERE week_number = current_week AND is_active = true) THEN
    RETURN;
  END IF;
  
  -- Generate 2 new challenges
  FOR i IN 1..2 LOOP
    chosen_theme := themes[1 + floor(random() * array_length(themes, 1))::integer];
    chosen_reqs := req_pool[1 + floor(random() * array_length(req_pool, 1))::integer];
    chosen_rewards := reward_pool[1 + floor(random() * array_length(reward_pool, 1))::integer];
    chosen_sponsor := sponsors[1 + floor(random() * array_length(sponsors, 1))::integer];
    chosen_hook := hooks[1 + floor(random() * array_length(hooks, 1))::integer];
    
    INSERT INTO dikcok_challenges (name, theme, starts_at, ends_at, requirements, rewards, sponsor, cross_game_hook, is_active, week_number, recurring)
    VALUES (
      chosen_theme || ' Challenge Week ' || current_week,
      chosen_theme,
      now(),
      now() + interval '7 days',
      chosen_reqs,
      chosen_rewards,
      chosen_sponsor,
      chosen_hook,
      true,
      current_week,
      true
    );
  END LOOP;
END;
$$;
