-- Twaater Social Media System - Phase 1: Core Schema

-- Create enum types
CREATE TYPE twaater_owner_type AS ENUM ('persona', 'band');
CREATE TYPE twaater_linked_type AS ENUM ('single', 'album', 'gig', 'tour', 'busking');
CREATE TYPE twaater_visibility AS ENUM ('public', 'followers');
CREATE TYPE twaater_outcome_group AS ENUM (
  'engagement', 'growth', 'commerce', 'press', 'collab', 'backfire', 'algo', 'serendipity'
);

-- Twaater Accounts (one per persona or band)
CREATE TABLE twaater_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type twaater_owner_type NOT NULL,
  owner_id UUID NOT NULL, -- references profiles.id or bands.id
  handle VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  verified BOOLEAN DEFAULT false,
  fame_score NUMERIC DEFAULT 0,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Twaats (posts)
CREATE TABLE twaats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 500),
  lang VARCHAR(5) DEFAULT 'en',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  linked_type twaater_linked_type,
  linked_id UUID,
  sentiment INTEGER DEFAULT 0 CHECK (sentiment BETWEEN -2 AND 2),
  outcome_code VARCHAR(10),
  visibility twaater_visibility DEFAULT 'public',
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_system_review BOOLEAN DEFAULT false
);

-- Twaat Metrics
CREATE TABLE twaat_metrics (
  twaat_id UUID PRIMARY KEY REFERENCES twaats(id) ON DELETE CASCADE,
  likes INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  retwaats INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  rsvps INTEGER DEFAULT 0,
  sales INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Follows
CREATE TABLE twaater_follows (
  follower_account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  followed_account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  weight NUMERIC DEFAULT 1.0,
  PRIMARY KEY (follower_account_id, followed_account_id),
  CHECK (follower_account_id != followed_account_id)
);

-- Feed Index (denormalized for ranking)
CREATE TABLE twaater_feed_index (
  account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  twaat_id UUID NOT NULL REFERENCES twaats(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL,
  rank_bucket INTEGER DEFAULT 0,
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (account_id, twaat_id)
);

-- Mentions
CREATE TABLE twaater_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentioned_account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  source_twaat_id UUID NOT NULL REFERENCES twaats(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Replies
CREATE TABLE twaat_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_twaat_id UUID NOT NULL REFERENCES twaats(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sentiment INTEGER DEFAULT 0 CHECK (sentiment BETWEEN -2 AND 2),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Outcome Catalog
CREATE TABLE twaater_outcome_catalog (
  code VARCHAR(10) PRIMARY KEY,
  outcome_group twaater_outcome_group NOT NULL,
  weight_base NUMERIC DEFAULT 1.0,
  description_template TEXT NOT NULL,
  effects JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Daily Awards (XP tracking)
CREATE TABLE twaater_daily_awards (
  account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  twaats_awarded INTEGER DEFAULT 0,
  xp_awarded INTEGER DEFAULT 0,
  PRIMARY KEY (account_id, date)
);

-- Reactions (likes, retwaats)
CREATE TABLE twaater_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twaat_id UUID NOT NULL REFERENCES twaats(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('like', 'retwaat')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (twaat_id, account_id, reaction_type)
);

-- Indexes for performance
CREATE INDEX idx_twaats_account_created ON twaats(account_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_twaats_created ON twaats(created_at DESC) WHERE deleted_at IS NULL AND visibility = 'public';
CREATE INDEX idx_twaater_follows_follower ON twaater_follows(follower_account_id);
CREATE INDEX idx_twaater_follows_followed ON twaater_follows(followed_account_id);
CREATE INDEX idx_twaater_mentions_account ON twaater_mentions(mentioned_account_id, created_at DESC);
CREATE INDEX idx_twaater_feed_score ON twaater_feed_index(account_id, score DESC);
CREATE INDEX idx_twaat_replies_parent ON twaat_replies(parent_twaat_id, created_at DESC);
CREATE INDEX idx_twaater_reactions_twaat ON twaater_reactions(twaat_id);

-- Full-text search on twaats
CREATE INDEX idx_twaats_body_search ON twaats USING gin(to_tsvector('english', body));

-- Triggers for updated_at
CREATE TRIGGER update_twaater_accounts_updated_at
  BEFORE UPDATE ON twaater_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update metrics when reactions change
CREATE OR REPLACE FUNCTION update_twaat_metrics_from_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reaction_type = 'like' THEN
      UPDATE twaat_metrics SET likes = likes + 1, updated_at = now() WHERE twaat_id = NEW.twaat_id;
    ELSIF NEW.reaction_type = 'retwaat' THEN
      UPDATE twaat_metrics SET retwaats = retwaats + 1, updated_at = now() WHERE twaat_id = NEW.twaat_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.reaction_type = 'like' THEN
      UPDATE twaat_metrics SET likes = GREATEST(0, likes - 1), updated_at = now() WHERE twaat_id = OLD.twaat_id;
    ELSIF OLD.reaction_type = 'retwaat' THEN
      UPDATE twaat_metrics SET retwaats = GREATEST(0, retwaats - 1), updated_at = now() WHERE twaat_id = OLD.twaat_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_metrics_on_reaction
  AFTER INSERT OR DELETE ON twaater_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_twaat_metrics_from_reaction();

-- Trigger to update reply count
CREATE OR REPLACE FUNCTION update_twaat_reply_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE twaat_metrics SET replies = replies + 1, updated_at = now() WHERE twaat_id = NEW.parent_twaat_id;
  ELSIF TG_OP = 'DELETE' AND OLD.deleted_at IS NULL THEN
    UPDATE twaat_metrics SET replies = GREATEST(0, replies - 1), updated_at = now() WHERE twaat_id = OLD.parent_twaat_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_reply_count
  AFTER INSERT OR UPDATE OF deleted_at ON twaat_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_twaat_reply_count();

-- Trigger to update follower counts
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE twaater_accounts SET following_count = following_count + 1 WHERE id = NEW.follower_account_id;
    UPDATE twaater_accounts SET follower_count = follower_count + 1 WHERE id = NEW.followed_account_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE twaater_accounts SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_account_id;
    UPDATE twaater_accounts SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.followed_account_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_follower_counts
  AFTER INSERT OR DELETE ON twaater_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follower_counts();

-- RLS Policies
ALTER TABLE twaater_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaats ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaat_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_feed_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaat_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_outcome_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_daily_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_reactions ENABLE ROW LEVEL SECURITY;

-- Twaater Accounts: Everyone can view, owners can update
CREATE POLICY "Twaater accounts are viewable by everyone"
  ON twaater_accounts FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own persona twaater account"
  ON twaater_accounts FOR INSERT
  WITH CHECK (
    owner_type = 'persona' AND 
    owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Band leaders can create band twaater accounts"
  ON twaater_accounts FOR INSERT
  WITH CHECK (
    owner_type = 'band' AND 
    owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid())
  );

CREATE POLICY "Account owners can update their accounts"
  ON twaater_accounts FOR UPDATE
  USING (
    (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
    (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
  );

-- Twaats: Public posts viewable by all, private by followers
CREATE POLICY "Public twaats are viewable by everyone"
  ON twaats FOR SELECT
  USING (visibility = 'public' AND deleted_at IS NULL);

CREATE POLICY "Follower twaats viewable by followers"
  ON twaats FOR SELECT
  USING (
    visibility = 'followers' AND deleted_at IS NULL AND
    account_id IN (
      SELECT followed_account_id FROM twaater_follows WHERE follower_account_id IN (
        SELECT id FROM twaater_accounts WHERE 
        (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
        (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
      )
    )
  );

CREATE POLICY "Account owners can create twaats"
  ON twaats FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM twaater_accounts WHERE
      (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
      (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
    )
  );

CREATE POLICY "Account owners can delete their twaats"
  ON twaats FOR UPDATE
  USING (
    account_id IN (
      SELECT id FROM twaater_accounts WHERE
      (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
      (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
    )
  );

-- Metrics: Everyone can view
CREATE POLICY "Twaat metrics are viewable by everyone"
  ON twaat_metrics FOR SELECT
  USING (true);

-- Follows: Everyone can view, users can manage their own
CREATE POLICY "Follows are viewable by everyone"
  ON twaater_follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow accounts"
  ON twaater_follows FOR INSERT
  WITH CHECK (
    follower_account_id IN (
      SELECT id FROM twaater_accounts WHERE
      (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
      (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
    )
  );

CREATE POLICY "Users can unfollow accounts"
  ON twaater_follows FOR DELETE
  USING (
    follower_account_id IN (
      SELECT id FROM twaater_accounts WHERE
      (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
      (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
    )
  );

-- Mentions: Everyone can view
CREATE POLICY "Mentions are viewable by everyone"
  ON twaater_mentions FOR SELECT
  USING (true);

-- Replies: Everyone can view, account owners can create
CREATE POLICY "Replies are viewable by everyone"
  ON twaat_replies FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Account owners can create replies"
  ON twaat_replies FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM twaater_accounts WHERE
      (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
      (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
    )
  );

-- Outcome catalog: Everyone can view, admins can manage
CREATE POLICY "Outcome catalog is viewable by everyone"
  ON twaater_outcome_catalog FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage outcome catalog"
  ON twaater_outcome_catalog FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Daily awards: Users can view their own
CREATE POLICY "Users can view their own daily awards"
  ON twaater_daily_awards FOR SELECT
  USING (
    account_id IN (
      SELECT id FROM twaater_accounts WHERE
      (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
      (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
    )
  );

-- Reactions: Everyone can view, users can manage their own
CREATE POLICY "Reactions are viewable by everyone"
  ON twaater_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can create reactions"
  ON twaater_reactions FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT id FROM twaater_accounts WHERE
      (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
      (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
    )
  );

CREATE POLICY "Users can delete their own reactions"
  ON twaater_reactions FOR DELETE
  USING (
    account_id IN (
      SELECT id FROM twaater_accounts WHERE
      (owner_type = 'persona' AND owner_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) OR
      (owner_type = 'band' AND owner_id IN (SELECT id FROM bands WHERE leader_id = auth.uid()))
    )
  );