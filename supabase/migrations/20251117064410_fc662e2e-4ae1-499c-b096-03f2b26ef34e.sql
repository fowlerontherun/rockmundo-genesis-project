-- Create jam_session_participants table
CREATE TABLE IF NOT EXISTS public.jam_session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jam_session_id UUID NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_ready BOOLEAN DEFAULT false,
  skill_tier TEXT,
  co_play_count INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(jam_session_id, profile_id)
);

-- Create jam_session_messages table
CREATE TABLE IF NOT EXISTS public.jam_session_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jam_session_id UUID NOT NULL REFERENCES jam_sessions(id) ON DELETE CASCADE,
  sender_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create community_mentorship_profiles table
CREATE TABLE IF NOT EXISTS public.community_mentorship_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  headline TEXT,
  mentor_capacity INTEGER DEFAULT 0,
  mentorship_style TEXT,
  focus_areas TEXT[],
  experience_level TEXT,
  availability_status TEXT DEFAULT 'available',
  is_open_to_mentor BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create community_mentorship_matches table
CREATE TABLE IF NOT EXISTS public.community_mentorship_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_profile_id UUID NOT NULL REFERENCES community_mentorship_profiles(id) ON DELETE CASCADE,
  mentee_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  match_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(mentor_profile_id, mentee_profile_id)
);

-- Create community_mentorship_goals table
CREATE TABLE IF NOT EXISTS public.community_mentorship_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES community_mentorship_matches(id) ON DELETE CASCADE,
  goal_text TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  target_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audio_generation_prompts table
CREATE TABLE IF NOT EXISTS public.audio_generation_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES recording_sessions(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  target_model TEXT DEFAULT 'default',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create audio_generation_results table
CREATE TABLE IF NOT EXISTS public.audio_generation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES audio_generation_prompts(id) ON DELETE CASCADE,
  session_id UUID REFERENCES recording_sessions(id) ON DELETE SET NULL,
  audio_url TEXT,
  is_preferred BOOLEAN DEFAULT false,
  quality_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create lifestyle_properties table
CREATE TABLE IF NOT EXISTS public.lifestyle_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  property_type TEXT NOT NULL,
  base_price INTEGER NOT NULL,
  bedrooms INTEGER NOT NULL,
  bathrooms INTEGER NOT NULL,
  area_sq_ft INTEGER,
  lot_size_sq_ft INTEGER,
  image_url TEXT,
  highlight_features TEXT[],
  description TEXT,
  energy_rating TEXT,
  lifestyle_fit JSONB DEFAULT '{}'::jsonb,
  rating NUMERIC,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create lifestyle_property_features table
CREATE TABLE IF NOT EXISTS public.lifestyle_property_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES lifestyle_properties(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  feature_type TEXT NOT NULL,
  description TEXT,
  upgrade_cost INTEGER NOT NULL DEFAULT 0,
  impact JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create lifestyle_property_financing_options table
CREATE TABLE IF NOT EXISTS public.lifestyle_property_financing_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES lifestyle_properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  down_payment_pct NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  term_months INTEGER NOT NULL,
  closing_cost_pct NUMERIC,
  requirements JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create lifestyle_property_purchases table
CREATE TABLE IF NOT EXISTS public.lifestyle_property_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES lifestyle_properties(id) ON DELETE CASCADE,
  financing_option_id UUID REFERENCES lifestyle_property_financing_options(id) ON DELETE SET NULL,
  selected_features JSONB DEFAULT '[]'::jsonb,
  total_upgrade_cost INTEGER DEFAULT 0,
  purchase_price INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create community_feed_posts table
CREATE TABLE IF NOT EXISTS public.community_feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_spotlight BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.jam_session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jam_session_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_mentorship_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_mentorship_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_mentorship_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_generation_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_generation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifestyle_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifestyle_property_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifestyle_property_financing_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifestyle_property_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_feed_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jam_session_participants
CREATE POLICY "Participants can view session participants"
  ON public.jam_session_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join jam sessions"
  ON public.jam_session_participants FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their participation"
  ON public.jam_session_participants FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for jam_session_messages
CREATE POLICY "Messages are viewable by participants"
  ON public.jam_session_messages FOR SELECT
  USING (true);

CREATE POLICY "Participants can send messages"
  ON public.jam_session_messages FOR INSERT
  WITH CHECK (sender_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for community_mentorship_profiles
CREATE POLICY "Mentorship profiles are viewable by everyone"
  ON public.community_mentorship_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can create their mentorship profile"
  ON public.community_mentorship_profiles FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their mentorship profile"
  ON public.community_mentorship_profiles FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- RLS Policies for community_mentorship_matches
CREATE POLICY "Matches are viewable by involved parties"
  ON public.community_mentorship_matches FOR SELECT
  USING (
    mentee_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR mentor_profile_id IN (
      SELECT id FROM community_mentorship_profiles 
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Mentees can create match requests"
  ON public.community_mentorship_matches FOR INSERT
  WITH CHECK (mentee_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Involved parties can update matches"
  ON public.community_mentorship_matches FOR UPDATE
  USING (
    mentee_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR mentor_profile_id IN (
      SELECT id FROM community_mentorship_profiles 
      WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- RLS Policies for community_mentorship_goals
CREATE POLICY "Goals are viewable by involved parties"
  ON public.community_mentorship_goals FOR SELECT
  USING (
    match_id IN (
      SELECT id FROM community_mentorship_matches
      WHERE mentee_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR mentor_profile_id IN (
          SELECT id FROM community_mentorship_profiles 
          WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Involved parties can manage goals"
  ON public.community_mentorship_goals FOR ALL
  USING (
    match_id IN (
      SELECT id FROM community_mentorship_matches
      WHERE mentee_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR mentor_profile_id IN (
          SELECT id FROM community_mentorship_profiles 
          WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        )
    )
  );

-- RLS Policies for audio_generation tables (admin only)
CREATE POLICY "Admins can manage audio generation prompts"
  ON public.audio_generation_prompts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage audio generation results"
  ON public.audio_generation_results FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for lifestyle_properties
CREATE POLICY "Properties are viewable by everyone"
  ON public.lifestyle_properties FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage properties"
  ON public.lifestyle_properties FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for lifestyle_property_features
CREATE POLICY "Property features are viewable by everyone"
  ON public.lifestyle_property_features FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage property features"
  ON public.lifestyle_property_features FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for lifestyle_property_financing_options
CREATE POLICY "Financing options are viewable by everyone"
  ON public.lifestyle_property_financing_options FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage financing options"
  ON public.lifestyle_property_financing_options FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for lifestyle_property_purchases
CREATE POLICY "Users can view their own purchases"
  ON public.lifestyle_property_purchases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create purchases"
  ON public.lifestyle_property_purchases FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their purchases"
  ON public.lifestyle_property_purchases FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for community_feed_posts
CREATE POLICY "Feed posts are viewable by everyone"
  ON public.community_feed_posts FOR SELECT
  USING (true);

CREATE POLICY "Users can create feed posts"
  ON public.community_feed_posts FOR INSERT
  WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their posts"
  ON public.community_feed_posts FOR UPDATE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their posts"
  ON public.community_feed_posts FOR DELETE
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jam_participants_session ON public.jam_session_participants(jam_session_id);
CREATE INDEX IF NOT EXISTS idx_jam_participants_profile ON public.jam_session_participants(profile_id);
CREATE INDEX IF NOT EXISTS idx_jam_messages_session ON public.jam_session_messages(jam_session_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_profiles_open ON public.community_mentorship_profiles(is_open_to_mentor) WHERE is_open_to_mentor = true;
CREATE INDEX IF NOT EXISTS idx_mentorship_matches_mentor ON public.community_mentorship_matches(mentor_profile_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_matches_mentee ON public.community_mentorship_matches(mentee_profile_id);
CREATE INDEX IF NOT EXISTS idx_audio_prompts_session ON public.audio_generation_prompts(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_results_prompt ON public.audio_generation_results(prompt_id);
CREATE INDEX IF NOT EXISTS idx_lifestyle_properties_available ON public.lifestyle_properties(available) WHERE available = true;
CREATE INDEX IF NOT EXISTS idx_property_purchases_user ON public.lifestyle_property_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_spotlight ON public.community_feed_posts(is_spotlight, created_at DESC) WHERE is_spotlight = true;
CREATE INDEX IF NOT EXISTS idx_feed_posts_profile ON public.community_feed_posts(profile_id, created_at DESC);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_jam_session_participants_updated_at
  BEFORE UPDATE ON public.jam_session_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mentorship_profiles_updated_at
  BEFORE UPDATE ON public.community_mentorship_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mentorship_matches_updated_at
  BEFORE UPDATE ON public.community_mentorship_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mentorship_goals_updated_at
  BEFORE UPDATE ON public.community_mentorship_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audio_prompts_updated_at
  BEFORE UPDATE ON public.audio_generation_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lifestyle_properties_updated_at
  BEFORE UPDATE ON public.lifestyle_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_purchases_updated_at
  BEFORE UPDATE ON public.lifestyle_property_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feed_posts_updated_at
  BEFORE UPDATE ON public.community_feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();