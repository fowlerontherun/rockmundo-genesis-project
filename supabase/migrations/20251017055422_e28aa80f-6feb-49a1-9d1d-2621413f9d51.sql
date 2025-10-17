-- Create suggested follows table
CREATE TABLE twaater_suggested_follows (
  account_id UUID REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  suggested_account_id UUID REFERENCES twaater_accounts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, suggested_account_id)
);

-- Add indexes for performance
CREATE INDEX idx_suggested_follows_account ON twaater_suggested_follows(account_id, score DESC);
CREATE INDEX idx_suggested_follows_created ON twaater_suggested_follows(created_at);

-- Enable RLS
ALTER TABLE twaater_suggested_follows ENABLE ROW LEVEL SECURITY;

-- Users can view their own suggestions
CREATE POLICY "Users can view their own suggestions"
ON twaater_suggested_follows
FOR SELECT
USING (
  account_id IN (
    SELECT id FROM twaater_accounts 
    WHERE owner_type = 'persona' AND owner_id = auth.uid()
  )
  OR
  account_id IN (
    SELECT ta.id FROM twaater_accounts ta
    JOIN band_members bm ON bm.band_id = ta.owner_id
    WHERE ta.owner_type = 'band' AND bm.user_id = auth.uid()
  )
);

-- System can insert suggestions
CREATE POLICY "System can insert suggestions"
ON twaater_suggested_follows
FOR INSERT
WITH CHECK (true);

-- System can delete old suggestions
CREATE POLICY "System can delete suggestions"
ON twaater_suggested_follows
FOR DELETE
USING (true);

-- Schedule cron job to refresh suggestions daily
SELECT cron.schedule(
  'refresh-twaater-suggestions',
  '0 2 * * *', -- 2 AM daily
  $$
  SELECT net.http_post(
    url:='https://yztogmdixmchsmimtent.supabase.co/functions/v1/suggest-accounts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6dG9nbWRpeG1jaHNtaW10ZW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5ODU0ODcsImV4cCI6MjA3MzU2MTQ4N30.vqfz_ZIvCIEXAuoSYmydg-XA6oUiPbcCc6yjfb2zL0g"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);