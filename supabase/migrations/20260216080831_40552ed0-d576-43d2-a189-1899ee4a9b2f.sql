
-- =============================================
-- Housing & Rentals System (v1.0.711)
-- =============================================

-- 1. Create housing_types table
CREATE TABLE public.housing_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  tier INT NOT NULL CHECK (tier BETWEEN 1 AND 20),
  base_price INT NOT NULL,
  image_url TEXT,
  style_tags TEXT[] DEFAULT '{}',
  bedrooms INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create player_properties table
CREATE TABLE public.player_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  housing_type_id UUID NOT NULL REFERENCES public.housing_types(id),
  country TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purchase_price INT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create rental_types table
CREATE TABLE public.rental_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_weekly_cost INT NOT NULL,
  tier INT NOT NULL CHECK (tier BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create player_rentals table
CREATE TABLE public.player_rentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rental_type_id UUID NOT NULL REFERENCES public.rental_types(id),
  country TEXT NOT NULL,
  weekly_cost INT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_charged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'defaulted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_housing_types_country ON public.housing_types(country);
CREATE INDEX idx_housing_types_tier ON public.housing_types(tier);
CREATE INDEX idx_player_properties_user ON public.player_properties(user_id);
CREATE INDEX idx_player_rentals_user ON public.player_rentals(user_id);
CREATE INDEX idx_player_rentals_status ON public.player_rentals(status);

-- =============================================
-- RLS
-- =============================================
ALTER TABLE public.housing_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_rentals ENABLE ROW LEVEL SECURITY;

-- housing_types: anyone authenticated can read
CREATE POLICY "Anyone can view housing types" ON public.housing_types FOR SELECT TO authenticated USING (true);

-- rental_types: anyone authenticated can read
CREATE POLICY "Anyone can view rental types" ON public.rental_types FOR SELECT TO authenticated USING (true);

-- player_properties: users manage their own
CREATE POLICY "Users can view own properties" ON public.player_properties FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own properties" ON public.player_properties FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own properties" ON public.player_properties FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own properties" ON public.player_properties FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- player_rentals: users manage their own
CREATE POLICY "Users can view own rentals" ON public.player_rentals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rentals" ON public.player_rentals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rentals" ON public.player_rentals FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- =============================================
-- Seed 5 rental types
-- =============================================
INSERT INTO public.rental_types (name, description, base_weekly_cost, tier) VALUES
  ('1 Bed Flat', 'A simple one-bedroom apartment', 200, 1),
  ('2 Bed Flat', 'A comfortable two-bedroom apartment', 350, 2),
  ('Deluxe Studio', 'A stylish open-plan studio with premium finishes', 600, 3),
  ('Luxury Studio', 'A high-end studio apartment in a prime location', 1200, 4),
  ('Villa', 'A luxurious villa with private amenities', 3000, 5);

-- =============================================
-- Seed 20 housing types per country (procedural)
-- =============================================
DO $$
DECLARE
  c RECORD;
  col_avg NUMERIC;
  price_scale NUMERIC;
  tier_names TEXT[];
  tier_descs TEXT[];
  tier_prices INT[];
  tier_beds INT[];
  i INT;
BEGIN
  -- Base tier definitions (generic names, will be used for all countries)
  tier_names := ARRAY[
    'Bedsit', 'Studio Flat', 'Small Apartment', '1-Bed Apartment', '2-Bed Apartment',
    'Townhouse', 'Semi-Detached House', 'Detached House', 'Large Family Home', 'Period Home',
    'Modern Villa', 'Waterfront Apartment', 'Penthouse Suite', 'Country Cottage', 'Luxury Townhouse',
    'Designer Home', 'Heritage Mansion', 'Grand Estate', 'Country Manor', 'Royal Estate'
  ];
  tier_descs := ARRAY[
    'A tiny single room with shared facilities',
    'A compact open-plan living space',
    'A small but functional apartment',
    'A comfortable one-bedroom apartment',
    'A spacious two-bedroom apartment',
    'A charming multi-level townhouse',
    'A comfortable family semi-detached home',
    'A standalone detached house with garden',
    'A large home with multiple bedrooms and living areas',
    'A character home with period features',
    'A modern villa with contemporary design',
    'A premium apartment overlooking water',
    'A top-floor penthouse with panoramic views',
    'A quaint cottage in the countryside',
    'A luxury townhouse in a prime location',
    'An architect-designed contemporary home',
    'A historic mansion with grand interiors',
    'A sprawling estate with extensive grounds',
    'A magnificent country manor house',
    'An exclusive royal-grade estate'
  ];
  tier_prices := ARRAY[15000, 30000, 50000, 75000, 120000, 180000, 250000, 350000, 500000, 700000, 1000000, 1500000, 2000000, 2500000, 3000000, 4000000, 5000000, 10000000, 15000000, 25000000];
  tier_beds := ARRAY[1, 1, 1, 1, 2, 2, 3, 3, 4, 3, 4, 2, 3, 2, 3, 4, 6, 8, 10, 12];

  FOR c IN (SELECT country, AVG(cost_of_living) as avg_col FROM cities GROUP BY country ORDER BY country) LOOP
    col_avg := c.avg_col;
    -- Price scale: 0.4 + (col/100)*1.2
    price_scale := 0.4 + (col_avg / 100.0) * 1.2;

    FOR i IN 1..20 LOOP
      INSERT INTO public.housing_types (country, name, description, tier, base_price, bedrooms, style_tags)
      VALUES (
        c.country,
        tier_names[i],
        tier_descs[i],
        i,
        ROUND(tier_prices[i] * price_scale)::INT,
        tier_beds[i],
        ARRAY['local']
      );
    END LOOP;
  END LOOP;
END $$;

-- Create storage bucket for housing images
INSERT INTO storage.buckets (id, name, public) VALUES ('housing-images', 'housing-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Housing images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'housing-images');
CREATE POLICY "Service role can upload housing images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'housing-images');
CREATE POLICY "Service role can update housing images" ON storage.objects FOR UPDATE USING (bucket_id = 'housing-images');
