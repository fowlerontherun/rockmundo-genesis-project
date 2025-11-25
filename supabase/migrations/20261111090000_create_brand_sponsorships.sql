-- Create brand sponsorship foundations
CREATE TYPE IF NOT EXISTS brand_wealth_tier AS ENUM ('emerging', 'growth', 'established', 'titan');

CREATE TABLE IF NOT EXISTS brand_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  wealth_tier brand_wealth_tier DEFAULT 'growth',
  size_index INTEGER DEFAULT 50 CHECK (size_index >= 0 AND size_index <= 200),
  fame_floor INTEGER DEFAULT 0,
  cooldown_days INTEGER DEFAULT 7,
  exclusivity_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  focus_slots TEXT[] DEFAULT ARRAY['general'],
  base_offer NUMERIC DEFAULT 5000,
  bonus_profile JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brand_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_partners(id) ON DELETE CASCADE,
  cash_offer NUMERIC NOT NULL,
  fame_required INTEGER DEFAULT 0,
  slot_type TEXT DEFAULT 'general' CHECK (slot_type IN ('general', 'tour', 'festival', 'venue')),
  exclusivity_category TEXT,
  weighting_score NUMERIC DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_offers_band_status ON brand_offers(band_id, status);
CREATE INDEX IF NOT EXISTS idx_brand_offers_expiry ON brand_offers(expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS brand_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES brand_offers(id) ON DELETE SET NULL,
  band_id UUID REFERENCES bands(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_partners(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'terminated', 'expired')),
  exclusivity_category TEXT,
  slot_type TEXT DEFAULT 'general' CHECK (slot_type IN ('general', 'tour', 'festival', 'venue')),
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  payout_terms JSONB DEFAULT '{}'::jsonb,
  bonuses_applied JSONB DEFAULT '[]'::jsonb,
  termination_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_contracts_band_status ON brand_contracts(band_id, status);

CREATE TABLE IF NOT EXISTS brand_contract_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES brand_contracts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('offer_generated', 'activation', 'payout', 'termination', 'expiry', 'fame_bonus')),
  event_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_contract_history_contract ON brand_contract_history(contract_id);

CREATE TABLE IF NOT EXISTS brand_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES brand_contracts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('tour', 'festival', 'venue', 'fame_gain', 'expiry')),
  event_reference TEXT,
  base_amount NUMERIC DEFAULT 0,
  bonus_amount NUMERIC DEFAULT 0,
  fame_delta INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_payouts_contract ON brand_payouts(contract_id);
