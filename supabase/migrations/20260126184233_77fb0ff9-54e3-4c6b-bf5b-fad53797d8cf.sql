-- Create enum types for inbox
CREATE TYPE inbox_category AS ENUM (
  'random_event', 'gig_result', 'pr_media', 'record_label', 
  'sponsorship', 'financial', 'social', 'achievement', 'system'
);

CREATE TYPE inbox_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Create player_inbox table
CREATE TABLE player_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category inbox_category NOT NULL,
  priority inbox_priority NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  action_type text, -- 'accept_decline', 'view_details', 'navigate', null
  action_data jsonb, -- { route: '/gigs', offerId: 'xxx', etc }
  related_entity_type text, -- 'gig', 'sponsorship', 'contract', etc
  related_entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_player_inbox_user_unread ON player_inbox(user_id, is_read) WHERE is_archived = false;
CREATE INDEX idx_player_inbox_user_category ON player_inbox(user_id, category) WHERE is_archived = false;
CREATE INDEX idx_player_inbox_created_at ON player_inbox(created_at DESC);

-- Enable RLS
ALTER TABLE player_inbox ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own inbox" ON player_inbox
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own inbox" ON player_inbox
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own inbox messages" ON player_inbox
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "System can insert inbox messages" ON player_inbox
  FOR INSERT WITH CHECK (true);