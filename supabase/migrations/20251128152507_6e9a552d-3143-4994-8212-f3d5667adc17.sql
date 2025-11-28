-- Add rate limiting and quality tracking to twaater_accounts
ALTER TABLE twaater_accounts
ADD COLUMN IF NOT EXISTS posts_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_post_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS followers_gained_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_follower_reset TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS engagement_score NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_rating NUMERIC DEFAULT 1.0 CHECK (quality_rating >= 0 AND quality_rating <= 5);

-- Add XP tracking to twaats
ALTER TABLE twaats
ADD COLUMN IF NOT EXISTS xp_awarded INTEGER DEFAULT 0;

-- Create function to reset daily limits
CREATE OR REPLACE FUNCTION reset_twaater_daily_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Reset daily post counts
  UPDATE twaater_accounts
  SET posts_today = 0
  WHERE last_post_at < CURRENT_DATE;
  
  -- Reset daily follower gains
  UPDATE twaater_accounts
  SET followers_gained_today = 0,
      last_follower_reset = now()
  WHERE last_follower_reset < CURRENT_DATE;
END;
$$;

-- Create function to calculate XP for twaat
CREATE OR REPLACE FUNCTION calculate_twaat_xp(p_account_id UUID, p_posts_today INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp INTEGER := 0;
BEGIN
  -- First 3 posts per day: 5 XP each
  IF p_posts_today < 3 THEN
    v_xp := 5;
  -- Next 7 posts: 1 XP each (posts 4-10)
  ELSIF p_posts_today < 10 THEN
    v_xp := 1;
  -- After 10 posts: 0 XP
  ELSE
    v_xp := 0;
  END IF;
  
  RETURN v_xp;
END;
$$;

-- Create function to calculate follower quality weight
CREATE OR REPLACE FUNCTION calculate_follower_quality(p_follower_account_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weight NUMERIC := 1.0;
  v_verified BOOLEAN;
  v_fame_score NUMERIC;
  v_follower_count INTEGER;
BEGIN
  SELECT verified, fame_score, follower_count
  INTO v_verified, v_fame_score, v_follower_count
  FROM twaater_accounts
  WHERE id = p_follower_account_id;
  
  -- Verified accounts: 2x weight
  IF v_verified THEN
    v_weight := v_weight * 2.0;
  END IF;
  
  -- Fame-based multiplier (0.5x to 3x based on fame)
  v_weight := v_weight * (1.0 + LEAST(v_fame_score / 5000, 2.0));
  
  -- High follower count accounts: additional 1.5x
  IF v_follower_count > 1000 THEN
    v_weight := v_weight * 1.5;
  END IF;
  
  RETURN v_weight;
END;
$$;

-- Create table for AI feed preferences
CREATE TABLE IF NOT EXISTS twaater_ai_preferences (
  account_id UUID PRIMARY KEY REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  preferred_genres TEXT[] DEFAULT '{}',
  interaction_history JSONB DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on AI preferences
ALTER TABLE twaater_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI preferences"
ON twaater_ai_preferences FOR SELECT
USING (
  account_id IN (
    SELECT id FROM twaater_accounts ta
    WHERE (ta.owner_type = 'persona' AND ta.owner_id = auth.uid())
    OR (ta.owner_type = 'band' AND ta.owner_id IN (
      SELECT band_id FROM band_members WHERE user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Users can insert own AI preferences"
ON twaater_ai_preferences FOR INSERT
WITH CHECK (
  account_id IN (
    SELECT id FROM twaater_accounts ta
    WHERE (ta.owner_type = 'persona' AND ta.owner_id = auth.uid())
    OR (ta.owner_type = 'band' AND ta.owner_id IN (
      SELECT band_id FROM band_members WHERE user_id = auth.uid()
    ))
  )
);

CREATE POLICY "Users can update own AI preferences"
ON twaater_ai_preferences FOR UPDATE
USING (
  account_id IN (
    SELECT id FROM twaater_accounts ta
    WHERE (ta.owner_type = 'persona' AND ta.owner_id = auth.uid())
    OR (ta.owner_type = 'band' AND ta.owner_id IN (
      SELECT band_id FROM band_members WHERE user_id = auth.uid()
    ))
  )
);

-- Trigger to update engagement score
CREATE OR REPLACE FUNCTION update_engagement_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_engagement NUMERIC;
  v_post_count INTEGER;
  v_account_id UUID;
BEGIN
  -- Get account_id from the twaat
  SELECT account_id INTO v_account_id
  FROM twaats
  WHERE id = NEW.twaat_id;
  
  -- Calculate average engagement per post
  SELECT 
    COALESCE(SUM(tm.likes + (tm.replies * 2) + (tm.retwaats * 3)), 0) as total,
    COUNT(*) as posts
  INTO v_total_engagement, v_post_count
  FROM twaats t
  JOIN twaat_metrics tm ON t.id = tm.twaat_id
  WHERE t.account_id = v_account_id
    AND t.created_at > now() - INTERVAL '30 days';
  
  -- Update engagement score (average per post)
  IF v_post_count > 0 THEN
    UPDATE twaater_accounts
    SET engagement_score = v_total_engagement / v_post_count
    WHERE id = v_account_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_account_engagement ON twaat_metrics;
CREATE TRIGGER update_account_engagement
AFTER INSERT OR UPDATE ON twaat_metrics
FOR EACH ROW EXECUTE FUNCTION update_engagement_score();