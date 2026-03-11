
-- Player Survey Questions table
CREATE TABLE public.player_survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('rating_1_5', 'multiple_choice', 'yes_no', 'free_text')),
  options jsonb DEFAULT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Player Survey Responses table
CREATE TABLE public.player_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.player_survey_questions(id) ON DELETE CASCADE NOT NULL,
  survey_round text NOT NULL,
  answer_value text,
  answer_numeric int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id, survey_round)
);

-- Player Survey Completions table
CREATE TABLE public.player_survey_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  survey_round text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  xp_awarded int NOT NULL DEFAULT 0,
  attribute_points_awarded int NOT NULL DEFAULT 0,
  UNIQUE (user_id, survey_round)
);

-- RLS
ALTER TABLE public.player_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_survey_completions ENABLE ROW LEVEL SECURITY;

-- Questions: anyone authenticated can read active questions
CREATE POLICY "Anyone can read active survey questions"
  ON public.player_survey_questions FOR SELECT TO authenticated
  USING (is_active = true);

-- Questions: admins can do everything
CREATE POLICY "Admins can manage survey questions"
  ON public.player_survey_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Responses: players can insert their own
CREATE POLICY "Players can insert own survey responses"
  ON public.player_survey_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Responses: players can read their own
CREATE POLICY "Players can read own survey responses"
  ON public.player_survey_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Responses: admins can read all
CREATE POLICY "Admins can read all survey responses"
  ON public.player_survey_responses FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Completions: players can insert their own
CREATE POLICY "Players can insert own survey completions"
  ON public.player_survey_completions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Completions: players can read their own
CREATE POLICY "Players can read own survey completions"
  ON public.player_survey_completions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Completions: admins can read all
CREATE POLICY "Admins can read all survey completions"
  ON public.player_survey_completions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed 32 survey questions across 8 categories
INSERT INTO public.player_survey_questions (category, question_text, question_type, options, display_order) VALUES
-- Gameplay (1-4)
('gameplay', 'How engaging do you find the gig performance system?', 'rating_1_5', NULL, 1),
('gameplay', 'Which game feature do you spend the most time on?', 'multiple_choice', '["Music Production","Touring & Gigs","Social Media","Business & Labels","Exploring Cities"]', 2),
('gameplay', 'How satisfying is the overall gameplay loop?', 'rating_1_5', NULL, 3),
('gameplay', 'Do you feel there are enough activities to keep you engaged daily?', 'yes_no', NULL, 4),

-- Music & Production (5-8)
('music', 'How satisfying is the songwriting process?', 'rating_1_5', NULL, 5),
('music', 'Do you feel the recording studio gives enough creative control?', 'yes_no', NULL, 6),
('music', 'How would you rate the variety of music genres available?', 'rating_1_5', NULL, 7),
('music', 'What aspect of music production needs the most improvement?', 'multiple_choice', '["Songwriting","Recording","Mixing/Mastering","Genre Options","Collaboration"]', 8),

-- Social & Community (9-12)
('social', 'How useful do you find Twaater for building your fanbase?', 'rating_1_5', NULL, 9),
('social', 'How engaging is the DikCok video feature?', 'rating_1_5', NULL, 10),
('social', 'Would you like more multiplayer interaction features?', 'yes_no', NULL, 11),
('social', 'How would you rate the band collaboration experience?', 'rating_1_5', NULL, 12),

-- Economy & Balance (13-16)
('economy', 'Do you feel the in-game economy is balanced?', 'rating_1_5', NULL, 13),
('economy', 'Are streaming and sales revenues at a fair level?', 'rating_1_5', NULL, 14),
('economy', 'How fair are the costs for equipment and upgrades?', 'rating_1_5', NULL, 15),
('economy', 'What economic aspect feels most unbalanced?', 'multiple_choice', '["Streaming Income","Gig Payouts","Equipment Costs","Label Contracts","Travel Costs"]', 16),

-- UI & Experience (17-20)
('ui', 'How intuitive is the game navigation?', 'rating_1_5', NULL, 17),
('ui', 'What area of the UI needs the most improvement?', 'multiple_choice', '["Main Menus","World Map","Dashboards","Mobile Experience","Notifications"]', 18),
('ui', 'How visually appealing do you find the game interface?', 'rating_1_5', NULL, 19),
('ui', 'Is the tutorial system helpful for new players?', 'rating_1_5', NULL, 20),

-- Content (21-24)
('content', 'Is there enough variety in gig venues?', 'rating_1_5', NULL, 21),
('content', 'How would you rate the world exploration experience?', 'rating_1_5', NULL, 22),
('content', 'Are there enough cities and locations to explore?', 'yes_no', NULL, 23),
('content', 'What new feature would you most like to see added?', 'free_text', NULL, 24),

-- Performance (25-28)
('performance', 'How would you rate game loading times?', 'rating_1_5', NULL, 25),
('performance', 'Do you experience lag during 3D gig scenes?', 'yes_no', NULL, 26),
('performance', 'How stable is the game overall (crashes, errors)?', 'rating_1_5', NULL, 27),
('performance', 'Does the game perform well on your device?', 'rating_1_5', NULL, 28),

-- Progression (29-32)
('progression', 'Does leveling up feel rewarding?', 'rating_1_5', NULL, 29),
('progression', 'Is the skill tree deep enough?', 'rating_1_5', NULL, 30),
('progression', 'How fair is the XP progression speed?', 'rating_1_5', NULL, 31),
('progression', 'What would make progression more satisfying?', 'free_text', NULL, 32);

-- Seed game_config entry for survey
INSERT INTO public.game_config (config_key, config_value)
VALUES ('player_survey_enabled', '{"enabled": false, "round": "2026-03", "questions_per_session": 10}')
ON CONFLICT (config_key) DO NOTHING;
