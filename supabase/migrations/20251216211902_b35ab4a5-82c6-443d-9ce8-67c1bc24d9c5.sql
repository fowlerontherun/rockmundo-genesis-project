-- Player habits tracking
CREATE TABLE player_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  frequency TEXT DEFAULT 'daily',
  target_per_week INTEGER DEFAULT 7,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE player_habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES player_habits(id) ON DELETE CASCADE NOT NULL,
  completed_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(habit_id, completed_date)
);

-- Wellness conditions/injuries
CREATE TABLE player_wellness_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  condition_type TEXT NOT NULL,
  severity TEXT DEFAULT 'minor',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  recovery_activity TEXT,
  notes TEXT
);

-- Player wellness goals
CREATE TABLE player_wellness_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  goal_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  deadline DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE player_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_wellness_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_wellness_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for player_habits
CREATE POLICY "Users can view own habits" ON player_habits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own habits" ON player_habits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own habits" ON player_habits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own habits" ON player_habits FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for player_habit_completions
CREATE POLICY "Users can view own completions" ON player_habit_completions FOR SELECT 
  USING (habit_id IN (SELECT id FROM player_habits WHERE user_id = auth.uid()));
CREATE POLICY "Users can create own completions" ON player_habit_completions FOR INSERT 
  WITH CHECK (habit_id IN (SELECT id FROM player_habits WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own completions" ON player_habit_completions FOR DELETE 
  USING (habit_id IN (SELECT id FROM player_habits WHERE user_id = auth.uid()));

-- RLS Policies for player_wellness_conditions
CREATE POLICY "Users can view own conditions" ON player_wellness_conditions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conditions" ON player_wellness_conditions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conditions" ON player_wellness_conditions FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for player_wellness_goals
CREATE POLICY "Users can view own goals" ON player_wellness_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own goals" ON player_wellness_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON player_wellness_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON player_wellness_goals FOR DELETE USING (auth.uid() = user_id);

-- Seed default habits for new players (function to call on signup)
CREATE OR REPLACE FUNCTION create_default_habits_for_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO player_habits (user_id, name, description, category, frequency)
  VALUES 
    (p_user_id, 'Practice Instrument', 'Daily instrument practice session', 'music', 'daily'),
    (p_user_id, 'Vocal Warmups', 'Warm up your voice before singing', 'music', 'daily'),
    (p_user_id, 'Exercise', 'Stay fit with regular exercise', 'fitness', 'daily'),
    (p_user_id, 'Meditate', 'Clear your mind with meditation', 'mental', 'daily'),
    (p_user_id, 'Get 8hrs Sleep', 'Full night of rest', 'health', 'daily');
END;
$$;