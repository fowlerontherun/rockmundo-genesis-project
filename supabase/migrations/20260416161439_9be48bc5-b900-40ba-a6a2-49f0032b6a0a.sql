
-- 1. charity_organizations
CREATE TABLE public.charity_organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'humanitarian',
  description TEXT,
  fame_bonus_pct INT NOT NULL DEFAULT 1,
  reputation_boost INT NOT NULL DEFAULT 5,
  tax_deduction_pct INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.charity_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view charities" ON public.charity_organizations FOR SELECT USING (true);

-- Seed charities
INSERT INTO public.charity_organizations (name, category, description, fame_bonus_pct, reputation_boost, tax_deduction_pct) VALUES
('Music for Youth Foundation', 'music_education', 'Provides instruments and lessons to underprivileged youth worldwide.', 2, 10, 8),
('Harmony in Schools', 'music_education', 'Funds music programs in public schools across developing nations.', 1, 8, 6),
('Green Planet Initiative', 'environment', 'Fighting climate change through reforestation and clean energy projects.', 1, 7, 5),
('Ocean Sound Project', 'environment', 'Protecting marine ecosystems and reducing ocean noise pollution.', 1, 6, 5),
('Artists Against Hunger', 'humanitarian', 'Mobilizing the creative community to end world hunger.', 3, 15, 10),
('Shelter the Beat', 'humanitarian', 'Building homes and community centers in disaster-affected regions.', 2, 12, 8),
('Rock Health Alliance', 'health', 'Mental health support and addiction recovery for musicians.', 2, 10, 7),
('Hearing Tomorrow', 'health', 'Providing hearing protection and treatment for music professionals.', 1, 8, 6),
('Canvas & Chord Foundation', 'arts', 'Cross-disciplinary arts grants for emerging creators.', 2, 9, 6),
('Stage for All', 'arts', 'Making live performance accessible to disabled communities.', 2, 11, 7),
('Global Rhythm Relief', 'humanitarian', 'Emergency musical therapy programs in conflict zones.', 3, 14, 9),
('Indie Creator Fund', 'music_education', 'Micro-grants for independent musicians and producers.', 1, 7, 5);

-- 2. charity_donations
CREATE TABLE public.charity_donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  charity_id UUID NOT NULL REFERENCES public.charity_organizations(id) ON DELETE CASCADE,
  amount INT NOT NULL DEFAULT 0,
  fame_gained INT NOT NULL DEFAULT 0,
  reputation_gained INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.charity_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own donations" ON public.charity_donations FOR SELECT USING (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users can insert own donations" ON public.charity_donations FOR INSERT WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 3. sponsorship_types
CREATE TABLE public.sponsorship_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  fame_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  streaming_bonus_pct INT NOT NULL DEFAULT 0,
  merch_discount_pct INT NOT NULL DEFAULT 0,
  gig_pay_bonus_pct INT NOT NULL DEFAULT 0,
  tour_cost_reduction_pct INT NOT NULL DEFAULT 0,
  description TEXT,
  icon_name TEXT NOT NULL DEFAULT 'Star',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sponsorship_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sponsorship types" ON public.sponsorship_types FOR SELECT USING (true);

INSERT INTO public.sponsorship_types (name, category, fame_multiplier, streaming_bonus_pct, merch_discount_pct, gig_pay_bonus_pct, tour_cost_reduction_pct, description, icon_name) VALUES
('Gear Endorsement', 'gear', 1.05, 0, 15, 0, 0, 'Equipment manufacturers sponsor your sound. Reduces merch production costs through shared branding.', 'Guitar'),
('Energy Drink', 'beverage', 1.10, 5, 0, 10, 0, 'High-energy brand partnerships that boost your gig earnings and streaming presence.', 'Zap'),
('Fashion Brand', 'fashion', 1.15, 0, 20, 5, 0, 'Designer collaborations that elevate your image and slash merchandise costs.', 'Shirt'),
('Tech Partner', 'technology', 1.05, 10, 0, 0, 10, 'Technology companies backing your digital presence with streaming and tour logistics support.', 'Cpu'),
('Streaming Platform', 'streaming', 1.0, 25, 0, 0, 0, 'Exclusive platform deals that massively boost your streaming revenue.', 'Radio'),
('Automotive', 'automotive', 1.10, 0, 0, 0, 25, 'Vehicle brand sponsorships providing tour transport savings and fame exposure.', 'Car');

-- 4. city_treasury
CREATE TABLE public.city_treasury (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE UNIQUE,
  balance BIGINT NOT NULL DEFAULT 0,
  total_tax_collected BIGINT NOT NULL DEFAULT 0,
  total_spent BIGINT NOT NULL DEFAULT 0,
  tax_rate_pct INT NOT NULL DEFAULT 10,
  last_collection_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.city_treasury ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view city treasury" ON public.city_treasury FOR SELECT USING (true);

-- Seed city treasuries for all cities
INSERT INTO public.city_treasury (city_id, balance, total_tax_collected, tax_rate_pct)
SELECT id,
  CASE
    WHEN population > 10000000 THEN 5000000
    WHEN population > 5000000 THEN 3000000
    WHEN population > 1000000 THEN 1500000
    WHEN population > 500000 THEN 750000
    ELSE 250000
  END,
  0,
  CASE
    WHEN country IN ('United States', 'United Kingdom', 'Germany', 'France', 'Japan') THEN 12
    WHEN country IN ('Brazil', 'India', 'Mexico', 'Nigeria') THEN 8
    ELSE 10
  END
FROM public.cities;

-- 5. city_treasury_ledger
CREATE TABLE public.city_treasury_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  amount INT NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'tax_collection',
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.city_treasury_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view treasury ledger" ON public.city_treasury_ledger FOR SELECT USING (true);

-- 6. Alter sponsorship_offers and sponsorship_contracts
ALTER TABLE public.sponsorship_offers ADD COLUMN sponsorship_type_id UUID REFERENCES public.sponsorship_types(id);
ALTER TABLE public.sponsorship_contracts ADD COLUMN sponsorship_type_id UUID REFERENCES public.sponsorship_types(id);
