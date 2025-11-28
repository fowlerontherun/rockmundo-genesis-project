-- Phase 1-4: Complete Twaater Implementation

-- Add new columns to twaats table
ALTER TABLE twaats 
ADD COLUMN IF NOT EXISTS quoted_twaat_id UUID REFERENCES twaats(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video')),
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- Create index for scheduled twaats
CREATE INDEX IF NOT EXISTS idx_twaats_scheduled ON twaats(scheduled_for) WHERE scheduled_for IS NOT NULL AND deleted_at IS NULL;

-- Create twaater_notifications table
CREATE TABLE IF NOT EXISTS twaater_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'reply', 'like', 'retwaat', 'follow', 'quote')),
  source_account_id UUID REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  related_twaat_id UUID REFERENCES twaats(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_account ON twaater_notifications(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON twaater_notifications(account_id, read_at) WHERE read_at IS NULL;

-- Enable RLS on notifications
ALTER TABLE twaater_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON twaater_notifications FOR SELECT
  USING (account_id IN (
    SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid()
  ));

CREATE POLICY "System can create notifications"
  ON twaater_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON twaater_notifications FOR UPDATE
  USING (account_id IN (
    SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid()
  ));

-- Create twaater_polls tables
CREATE TABLE IF NOT EXISTS twaater_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  twaat_id UUID NOT NULL REFERENCES twaats(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS twaater_poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES twaater_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twaater_poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES twaater_polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES twaater_poll_options(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, account_id)
);

-- Enable RLS on polls
ALTER TABLE twaater_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view polls" ON twaater_polls FOR SELECT USING (true);
CREATE POLICY "Poll creators can create polls" ON twaater_polls FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view poll options" ON twaater_poll_options FOR SELECT USING (true);
CREATE POLICY "Poll creators can create options" ON twaater_poll_options FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view poll votes" ON twaater_poll_votes FOR SELECT USING (true);
CREATE POLICY "Users can vote on polls" ON twaater_poll_votes FOR INSERT WITH CHECK (
  account_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
);

-- Create twaater_conversations table
CREATE TABLE IF NOT EXISTS twaater_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participant_1_id, participant_2_id),
  CHECK (participant_1_id < participant_2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON twaater_conversations(participant_1_id, participant_2_id);

-- Create twaater_messages table
CREATE TABLE IF NOT EXISTS twaater_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES twaater_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON twaater_messages(conversation_id, created_at DESC);

-- Enable RLS on conversations and messages
ALTER TABLE twaater_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE twaater_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversations"
  ON twaater_conversations FOR SELECT
  USING (
    participant_1_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
    OR participant_2_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
  );

CREATE POLICY "Users can create conversations"
  ON twaater_conversations FOR INSERT
  WITH CHECK (
    participant_1_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
    OR participant_2_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
  );

CREATE POLICY "Users can view messages in their conversations"
  ON twaater_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM twaater_conversations WHERE
        participant_1_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
        OR participant_2_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON twaater_messages FOR INSERT
  WITH CHECK (
    sender_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
  );

CREATE POLICY "Users can mark their messages as read"
  ON twaater_messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM twaater_conversations WHERE
        participant_1_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
        OR participant_2_id IN (SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid())
    )
  );

-- Create twaater_bookmarks table
CREATE TABLE IF NOT EXISTS twaater_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  twaat_id UUID NOT NULL REFERENCES twaats(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, twaat_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_account ON twaater_bookmarks(account_id, created_at DESC);

ALTER TABLE twaater_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their bookmarks"
  ON twaater_bookmarks FOR SELECT
  USING (account_id IN (
    SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid()
  ));

CREATE POLICY "Users can create bookmarks"
  ON twaater_bookmarks FOR INSERT
  WITH CHECK (account_id IN (
    SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete their bookmarks"
  ON twaater_bookmarks FOR DELETE
  USING (account_id IN (
    SELECT id FROM twaater_accounts WHERE owner_type = 'persona' AND owner_id = auth.uid()
  ));

-- Create storage bucket for twaater media
INSERT INTO storage.buckets (id, name, public)
VALUES ('twaater-media', 'twaater-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for twaater media
CREATE POLICY "Anyone can view twaater media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'twaater-media');

CREATE POLICY "Authenticated users can upload twaater media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'twaater-media' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own twaater media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'twaater-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to auto-verify accounts based on fame
CREATE OR REPLACE FUNCTION auto_verify_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE twaater_accounts
  SET verified = true
  WHERE verified = false
    AND (
      fame_score >= 10000
      OR owner_id IN (
        SELECT DISTINCT user_id FROM songs 
        WHERE id IN (SELECT song_id FROM chart_entries WHERE rank <= 100)
      )
      OR owner_id IN (
        SELECT user_id FROM player_achievements 
        WHERE unlocked_at IS NOT NULL
      )
    );
END;
$$;

-- Trigger to create notification on reply
CREATE OR REPLACE FUNCTION notify_on_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_account_id UUID;
BEGIN
  -- Get the account_id of the parent twaat owner
  SELECT account_id INTO parent_account_id
  FROM twaats
  WHERE id = NEW.parent_twaat_id;
  
  -- Don't notify if replying to yourself
  IF parent_account_id != NEW.account_id THEN
    INSERT INTO twaater_notifications (account_id, type, source_account_id, related_twaat_id)
    VALUES (parent_account_id, 'reply', NEW.account_id, NEW.parent_twaat_id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_reply
  AFTER INSERT ON twaat_replies
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_reply();

-- Trigger to create notification on reaction
CREATE OR REPLACE FUNCTION notify_on_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  twaat_account_id UUID;
  notification_type TEXT;
BEGIN
  -- Get the account_id of the twaat owner
  SELECT account_id INTO twaat_account_id
  FROM twaats
  WHERE id = NEW.twaat_id;
  
  -- Don't notify if reacting to your own twaat
  IF twaat_account_id != NEW.account_id THEN
    notification_type := CASE 
      WHEN NEW.reaction_type = 'like' THEN 'like'
      WHEN NEW.reaction_type = 'retwaat' THEN 'retwaat'
      ELSE NEW.reaction_type
    END;
    
    INSERT INTO twaater_notifications (account_id, type, source_account_id, related_twaat_id)
    VALUES (twaat_account_id, notification_type, NEW.account_id, NEW.twaat_id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_reaction
  AFTER INSERT ON twaater_reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_reaction();

-- Trigger to create notification on follow
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO twaater_notifications (account_id, type, source_account_id)
  VALUES (NEW.followed_account_id, 'follow', NEW.follower_account_id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_follow
  AFTER INSERT ON twaater_follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_follow();

-- Trigger to create notification on quote twaat
CREATE OR REPLACE FUNCTION notify_on_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  quoted_account_id UUID;
BEGIN
  IF NEW.quoted_twaat_id IS NOT NULL THEN
    SELECT account_id INTO quoted_account_id
    FROM twaats
    WHERE id = NEW.quoted_twaat_id;
    
    -- Don't notify if quoting yourself
    IF quoted_account_id != NEW.account_id THEN
      INSERT INTO twaater_notifications (account_id, type, source_account_id, related_twaat_id)
      VALUES (quoted_account_id, 'quote', NEW.account_id, NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_on_quote
  AFTER INSERT ON twaats
  FOR EACH ROW
  WHEN (NEW.quoted_twaat_id IS NOT NULL)
  EXECUTE FUNCTION notify_on_quote();

-- Update vote count trigger
CREATE OR REPLACE FUNCTION update_poll_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE twaater_poll_options
    SET vote_count = vote_count + 1
    WHERE id = NEW.option_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE twaater_poll_options
    SET vote_count = GREATEST(0, vote_count - 1)
    WHERE id = OLD.option_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_poll_vote_count
  AFTER INSERT OR DELETE ON twaater_poll_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_vote_count();

-- Update conversation last message timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE twaater_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON twaater_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();