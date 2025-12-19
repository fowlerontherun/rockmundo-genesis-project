-- Add label ownership columns to labels table
ALTER TABLE labels ADD COLUMN IF NOT EXISTS balance BIGINT DEFAULT 1000000;
ALTER TABLE labels ADD COLUMN IF NOT EXISTS balance_went_negative_at TIMESTAMPTZ;
ALTER TABLE labels ADD COLUMN IF NOT EXISTS is_bankrupt BOOLEAN DEFAULT FALSE;
ALTER TABLE labels ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);
ALTER TABLE labels ADD COLUMN IF NOT EXISTS headquarters_city_id UUID REFERENCES cities(id);
ALTER TABLE labels ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create label financial transactions table
CREATE TABLE IF NOT EXISTS label_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  description TEXT,
  initiated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on label_transactions
ALTER TABLE label_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for label_transactions
CREATE POLICY "Users can view transactions for labels they own"
ON label_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM labels 
    WHERE labels.id = label_transactions.label_id 
    AND labels.owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert transactions for labels they own"
ON label_transactions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM labels 
    WHERE labels.id = label_transactions.label_id 
    AND labels.owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- Create label upgrades table
CREATE TABLE IF NOT EXISTS label_upgrades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE NOT NULL,
  upgrade_type TEXT NOT NULL,
  upgrade_level INTEGER DEFAULT 1,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on label_upgrades
ALTER TABLE label_upgrades ENABLE ROW LEVEL SECURITY;

-- Policies for label_upgrades
CREATE POLICY "Users can view upgrades for labels they own"
ON label_upgrades FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM labels 
    WHERE labels.id = label_upgrades.label_id 
    AND labels.owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert upgrades for labels they own"
ON label_upgrades FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM labels 
    WHERE labels.id = label_upgrades.label_id 
    AND labels.owner_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_label_transactions_label_id ON label_transactions(label_id);
CREATE INDEX IF NOT EXISTS idx_label_transactions_created_at ON label_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_label_upgrades_label_id ON label_upgrades(label_id);
CREATE INDEX IF NOT EXISTS idx_labels_owner_id ON labels(owner_id);
CREATE INDEX IF NOT EXISTS idx_labels_is_bankrupt ON labels(is_bankrupt);