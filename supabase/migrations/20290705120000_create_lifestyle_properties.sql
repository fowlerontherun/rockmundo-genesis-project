BEGIN;

CREATE TABLE IF NOT EXISTS public.lifestyle_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  city text NOT NULL,
  district text,
  property_type text NOT NULL,
  base_price numeric NOT NULL,
  bedrooms integer NOT NULL,
  bathrooms integer NOT NULL,
  area_sq_ft integer,
  lot_size_sq_ft integer,
  image_url text,
  highlight_features text[] NOT NULL DEFAULT ARRAY[]::text[],
  description text,
  energy_rating text,
  lifestyle_fit jsonb NOT NULL DEFAULT '{}'::jsonb,
  rating numeric,
  available boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_lifestyle_properties_city ON public.lifestyle_properties(city);
CREATE INDEX IF NOT EXISTS idx_lifestyle_properties_type ON public.lifestyle_properties(property_type);

ALTER TABLE public.lifestyle_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Lifestyle properties are viewable by everyone"
  ON public.lifestyle_properties
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.lifestyle_property_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.lifestyle_properties(id) ON DELETE CASCADE,
  feature_name text NOT NULL,
  feature_type text NOT NULL,
  description text,
  upgrade_cost numeric NOT NULL DEFAULT 0,
  impact jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lifestyle_property_features_property_id
  ON public.lifestyle_property_features(property_id);
CREATE INDEX IF NOT EXISTS idx_lifestyle_property_features_type
  ON public.lifestyle_property_features(feature_type);

ALTER TABLE public.lifestyle_property_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Lifestyle property features are viewable by everyone"
  ON public.lifestyle_property_features
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.lifestyle_property_financing_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.lifestyle_properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  down_payment_pct numeric NOT NULL DEFAULT 20,
  interest_rate numeric NOT NULL DEFAULT 4.5,
  term_months integer NOT NULL DEFAULT 360,
  closing_cost_pct numeric,
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lifestyle_property_financing_property_id
  ON public.lifestyle_property_financing_options(property_id);

ALTER TABLE public.lifestyle_property_financing_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Lifestyle financing options are viewable by everyone"
  ON public.lifestyle_property_financing_options
  FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS public.lifestyle_property_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.lifestyle_properties(id) ON DELETE CASCADE,
  financing_option_id uuid REFERENCES public.lifestyle_property_financing_options(id),
  selected_features jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_upgrade_cost numeric NOT NULL DEFAULT 0,
  purchase_price numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text
);

CREATE INDEX IF NOT EXISTS idx_lifestyle_property_purchases_user_id
  ON public.lifestyle_property_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_lifestyle_property_purchases_property_id
  ON public.lifestyle_property_purchases(property_id);

ALTER TABLE public.lifestyle_property_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their lifestyle purchases"
  ON public.lifestyle_property_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create lifestyle purchases"
  ON public.lifestyle_property_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Seed curated lifestyle properties
INSERT INTO public.lifestyle_properties (
  name,
  city,
  district,
  property_type,
  base_price,
  bedrooms,
  bathrooms,
  area_sq_ft,
  lot_size_sq_ft,
  image_url,
  highlight_features,
  description,
  energy_rating,
  lifestyle_fit,
  rating
) VALUES
  (
    'Skyline Loft Studio',
    'New York',
    'Brooklyn',
    'Loft',
    850000,
    2,
    2,
    1600,
    NULL,
    NULL,
    ARRAY['Panoramic skyline views', 'Integrated rehearsal studio', 'Private rooftop garden'],
    'A creative loft engineered for songwriting retreats with immersive skyline inspiration.',
    'A-',
    jsonb_build_object(
      'focus', 'Touring songwriters building a creative HQ',
      'bonuses', jsonb_build_array('+5% inspiration recovery', 'City reputation boost')
    ),
    4.9
  ),
  (
    'Hillside Retreat Villa',
    'Los Angeles',
    'Laurel Canyon',
    'Villa',
    1250000,
    4,
    3,
    3200,
    6800,
    NULL,
    ARRAY['Sunset performance deck', 'Analog mix lounge', 'Infinity plunge spa'],
    'A secluded canyon villa blending analog mixing spaces with restorative nature for between-tour resets.',
    'A',
    jsonb_build_object(
      'focus', 'Headliners balancing tour output with wellness rituals',
      'bonuses', jsonb_build_array('+7% rest efficiency', 'VIP guest hosting boost')
    ),
    4.8
  ),
  (
    'Riverview Modern House',
    'Austin',
    'South Congress',
    'Modern Home',
    640000,
    3,
    3,
    2400,
    5400,
    NULL,
    ARRAY['Modular rehearsal pods', 'Riverfront fire lounge', 'Smart touring storage'],
    'A modern creative base minutes from Austin venues with adaptive rehearsal tech and open-air inspiration zones.',
    'B+',
    jsonb_build_object(
      'focus', 'Indie acts scaling their first national run',
      'bonuses', jsonb_build_array('+4% local fan growth', 'Logistics planning boost')
    ),
    4.6
  )
;

-- Seed features for Skyline Loft Studio
INSERT INTO public.lifestyle_property_features (
  property_id,
  feature_name,
  feature_type,
  description,
  upgrade_cost,
  impact
)
SELECT
  id,
  feature_name,
  feature_type,
  description,
  upgrade_cost,
  impact
FROM (
  VALUES
    (
      'Acoustic Isolation Suite',
      'interior',
      'Floating rehearsal suite with stage-grade acoustic dampening for late-night sessions.',
      18000,
      jsonb_build_object('studio_quality', 'Tier IV', 'inspiration', '+8%')
    ),
    (
      'Immersive Lighting Scenes',
      'technology',
      'Programmable lighting rig synced to songwriting workflows and circadian rhythm cues.',
      6500,
      jsonb_build_object('mood_control', 'Dynamic presets', 'energy', '+5% night focus')
    ),
    (
      'Rooftop Wellness Spa',
      'amenity',
      'Hydrotherapy plunge with skyline vistas for post-show recovery.',
      22000,
      jsonb_build_object('recovery', '+6%', 'band_morale', '+3%')
    )
) AS feature_data(feature_name, feature_type, description, upgrade_cost, impact)
CROSS JOIN LATERAL (
  SELECT id FROM public.lifestyle_properties WHERE name = 'Skyline Loft Studio'
) AS property_ref;

-- Seed features for Hillside Retreat Villa
INSERT INTO public.lifestyle_property_features (
  property_id,
  feature_name,
  feature_type,
  description,
  upgrade_cost,
  impact
)
SELECT
  id,
  feature_name,
  feature_type,
  description,
  upgrade_cost,
  impact
FROM (
  VALUES
    (
      'Sunset Performance Deck',
      'amenity',
      'Tiered deck with built-in monitoring for intimate canyon showcases.',
      28000,
      jsonb_build_object('fan_experience', '+10%', 'content_capture', 'Golden hour ready')
    ),
    (
      'Analog Mix Retreat',
      'interior',
      'Vintage gear lounge with tape-friendly acoustics for analog mixdowns.',
      19500,
      jsonb_build_object('studio_quality', 'Analog warmth', 'creativity', '+6%')
    ),
    (
      'Wellness Pavilion',
      'amenity',
      'Yoga deck and cold plunge circuit framed by native botanicals.',
      16000,
      jsonb_build_object('recovery', '+9%', 'stress', '-12%')
    )
) AS feature_data(feature_name, feature_type, description, upgrade_cost, impact)
CROSS JOIN LATERAL (
  SELECT id FROM public.lifestyle_properties WHERE name = 'Hillside Retreat Villa'
) AS property_ref;

-- Seed features for Riverview Modern House
INSERT INTO public.lifestyle_property_features (
  property_id,
  feature_name,
  feature_type,
  description,
  upgrade_cost,
  impact
)
SELECT
  id,
  feature_name,
  feature_type,
  description,
  upgrade_cost,
  impact
FROM (
  VALUES
    (
      'Modular Practice Pods',
      'technology',
      'Sound-treated pods that reconfigure for solo practice or band lock-ins.',
      8700,
      jsonb_build_object('band_sync', '+5%', 'flexibility', 'Modular layouts')
    ),
    (
      'Riverfront Fire Lounge',
      'amenity',
      'Outdoor lounge with integrated audio for unplugged riverside sets.',
      9200,
      jsonb_build_object('fan_engagement', '+6%', 'social_buzz', '+8%')
    ),
    (
      'Tour Logistics Hub',
      'interior',
      'Custom storage grid with RFID inventory tracking for gear trunks.',
      6400,
      jsonb_build_object('logistics', '+9%', 'setup_time', '-15%')
    )
) AS feature_data(feature_name, feature_type, description, upgrade_cost, impact)
CROSS JOIN LATERAL (
  SELECT id FROM public.lifestyle_properties WHERE name = 'Riverview Modern House'
) AS property_ref;

-- Seed financing options for Skyline Loft Studio
INSERT INTO public.lifestyle_property_financing_options (
  property_id,
  name,
  description,
  down_payment_pct,
  interest_rate,
  term_months,
  closing_cost_pct,
  requirements
)
SELECT
  id,
  financing_name,
  description,
  down_payment_pct,
  interest_rate,
  term_months,
  closing_cost_pct,
  requirements
FROM (
  VALUES
    (
      'Artist Equity Partner Program',
      'Label-backed partnership exchanging future revenue share for a lighter down payment.',
      15,
      4.1,
      360,
      1.9,
      jsonb_build_object('Minimum streams', '25M total', 'Tour gross', '$150k trailing 12 months')
    ),
    (
      'Creative Accelerator Bridge Loan',
      'Short-term bridge designed for global tour launches with flexible refinancing.',
      10,
      5.4,
      180,
      1.2,
      jsonb_build_object('Management plan', 'Approved', 'Upcoming tour', 'Booked 20+ dates')
    )
) AS financing(financing_name, description, down_payment_pct, interest_rate, term_months, closing_cost_pct, requirements)
CROSS JOIN LATERAL (
  SELECT id FROM public.lifestyle_properties WHERE name = 'Skyline Loft Studio'
) AS property_ref;

-- Seed financing options for Hillside Retreat Villa
INSERT INTO public.lifestyle_property_financing_options (
  property_id,
  name,
  description,
  down_payment_pct,
  interest_rate,
  term_months,
  closing_cost_pct,
  requirements
)
SELECT
  id,
  financing_name,
  description,
  down_payment_pct,
  interest_rate,
  term_months,
  closing_cost_pct,
  requirements
FROM (
  VALUES
    (
      'Legacy Headliner Mortgage',
      'Long-horizon mortgage with wellness incentives for artists balancing heavy tour schedules.',
      20,
      3.95,
      360,
      2.1,
      jsonb_build_object('Residency status', 'Primary home', 'Wellness plan', 'Submitted')
    ),
    (
      'Canyon Residency Flex Loan',
      'Adjustable-rate option aligned to seasonal touring cashflow.',
      12,
      4.85,
      240,
      1.6,
      jsonb_build_object('Credit score', '720+', 'Residency requirement', '6 months minimum')
    )
) AS financing(financing_name, description, down_payment_pct, interest_rate, term_months, closing_cost_pct, requirements)
CROSS JOIN LATERAL (
  SELECT id FROM public.lifestyle_properties WHERE name = 'Hillside Retreat Villa'
) AS property_ref;

-- Seed financing options for Riverview Modern House
INSERT INTO public.lifestyle_property_financing_options (
  property_id,
  name,
  description,
  down_payment_pct,
  interest_rate,
  term_months,
  closing_cost_pct,
  requirements
)
SELECT
  id,
  financing_name,
  description,
  down_payment_pct,
  interest_rate,
  term_months,
  closing_cost_pct,
  requirements
FROM (
  VALUES
    (
      'Indie Momentum Mortgage',
      'Designed for emerging acts reinvesting merch surges into a creative base.',
      8,
      4.75,
      300,
      1.4,
      jsonb_build_object('Merch growth', '+20% YoY', 'Mentor endorsement', 'Required')
    ),
    (
      'Tour Dividend Plan',
      'Fixed-rate plan with payment holidays aligned to extended tour stretches.',
      12,
      5.1,
      240,
      1.3,
      jsonb_build_object('Tour calendar', 'Submitted', 'Insurance', 'Tour disruption coverage')
    )
) AS financing(financing_name, description, down_payment_pct, interest_rate, term_months, closing_cost_pct, requirements)
CROSS JOIN LATERAL (
  SELECT id FROM public.lifestyle_properties WHERE name = 'Riverview Modern House'
) AS property_ref;

COMMIT;
