-- Add dual currency columns to player_xp_wallet
ALTER TABLE player_xp_wallet 
ADD COLUMN IF NOT EXISTS skill_xp_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skill_xp_lifetime INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skill_xp_spent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS attribute_points_balance INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS attribute_points_lifetime INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stipend_claim_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_stipend_claim_date DATE;

-- Add source column to profile_daily_xp_grants if not exists
ALTER TABLE profile_daily_xp_grants
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'daily_stipend',
ADD COLUMN IF NOT EXISTS grant_date DATE,
ADD COLUMN IF NOT EXISTS attribute_points_amount INTEGER DEFAULT 0;

-- Migrate existing data: copy current XP to skill_xp
UPDATE player_xp_wallet SET
  skill_xp_balance = COALESCE(xp_balance, 0),
  skill_xp_lifetime = COALESCE(lifetime_xp, 0),
  skill_xp_spent = COALESCE(xp_spent, 0),
  attribute_points_balance = GREATEST(0, FLOOR(COALESCE(lifetime_xp, 0) * 0.10)::INTEGER),
  attribute_points_lifetime = FLOOR(COALESCE(lifetime_xp, 0) * 0.10)::INTEGER
WHERE skill_xp_balance = 0 OR skill_xp_balance IS NULL;

-- Update existing grants to have grant_date
UPDATE profile_daily_xp_grants 
SET grant_date = DATE(created_at)
WHERE grant_date IS NULL;

-- Delete existing dual_xp config if any, then insert fresh
DELETE FROM game_balance_config WHERE category = 'dual_xp';

-- Insert dual XP configuration values
INSERT INTO game_balance_config (category, key, value, description) VALUES
  ('dual_xp', 'daily_stipend_sxp', '100', 'Base daily Skill XP stipend'),
  ('dual_xp', 'daily_stipend_ap', '10', 'Base daily Attribute Points stipend'),
  ('dual_xp', 'daily_activity_xp_cap', '250', 'Max XP from activities per day'),
  ('dual_xp', 'streak_7_bonus_sxp', '50', '7-day streak SXP bonus'),
  ('dual_xp', 'streak_7_bonus_ap', '10', '7-day streak AP bonus'),
  ('dual_xp', 'streak_14_bonus_sxp', '100', '14-day streak SXP bonus'),
  ('dual_xp', 'streak_14_bonus_ap', '20', '14-day streak AP bonus'),
  ('dual_xp', 'streak_30_bonus_sxp', '200', '30-day streak SXP bonus'),
  ('dual_xp', 'streak_30_bonus_ap', '40', '30-day streak AP bonus'),
  ('dual_xp', 'streak_100_bonus_sxp', '500', '100-day streak SXP bonus'),
  ('dual_xp', 'streak_100_bonus_ap', '100', '100-day streak AP bonus'),
  ('dual_xp', 'streak_365_bonus_sxp', '1000', '365-day streak SXP bonus'),
  ('dual_xp', 'streak_365_bonus_ap', '200', '365-day streak AP bonus'),
  ('dual_xp', 'exercise_ap_rate', '0.60', 'Exercise AP rate'),
  ('dual_xp', 'therapy_ap_rate', '0.60', 'Therapy AP rate'),
  ('dual_xp', 'meditation_ap_rate', '0.55', 'Meditation AP rate'),
  ('dual_xp', 'mentor_ap_rate', '0.55', 'Mentor AP rate'),
  ('dual_xp', 'performance_ap_rate', '0.50', 'Gigs/Busking AP rate'),
  ('dual_xp', 'rest_ap_rate', '0.50', 'Rest AP rate'),
  ('dual_xp', 'nutrition_ap_rate', '0.50', 'Nutrition AP rate'),
  ('dual_xp', 'education_ap_rate', '0.45', 'University/Books AP rate'),
  ('dual_xp', 'default_ap_rate', '0.50', 'Default AP rate for other activities');