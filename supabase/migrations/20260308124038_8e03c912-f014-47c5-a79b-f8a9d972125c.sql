-- Resolve canonical cities by name instead of production-specific UUIDs so this
-- historical tattoo-parlour seed replays on fresh databases.
DO $tattoo_parlour_city_dependencies$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required_name ORDER BY required_name)
    INTO v_missing
    FROM (VALUES ('Amsterdam'), ('Atlanta'), ('Austin'), ('Barcelona'), ('Berlin'), ('Buenos Aires'), ('Cape Town'), ('Chicago'), ('Detroit'), ('Dublin'), ('Kingston'), ('Lagos'), ('London'), ('Los Angeles'), ('Manchester'), ('Memphis'), ('Mexico City'), ('Miami'), ('Mumbai'), ('Nashville'), ('New York'), ('Paris'), ('Portland'), ('Rio de Janeiro'), ('San Francisco'), ('Seoul'), ('Stockholm'), ('Sydney'), ('Tokyo')) AS required(required_name)
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.cities c
      WHERE lower(c.name) = lower(required.required_name)
   );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Tattoo parlour seed requires canonical cities: %', v_missing;
  END IF;
END
$tattoo_parlour_city_dependencies$;

-- Seed tattoo parlours across 30 cities with varying quality
-- Format: (city_id, name, quality_tier, price_multiplier, infection_risk, specialties, description)

INSERT INTO tattoo_parlours (city_id, name, quality_tier, price_multiplier, infection_risk, specialties, description) VALUES
-- NEW YORK (3 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('New York') LIMIT 1), 'Empire Ink Studio', 5, 2.5, 0.02, ARRAY['portrait','japanese'], 'Elite Manhattan tattoo studio. Celebrity clientele, sterile environment.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('New York') LIMIT 1), 'Brooklyn Needle Works', 3, 1.2, 0.08, ARRAY['tribal','geometric'], 'Williamsburg shop with edgy designs and fair prices.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('New York') LIMIT 1), 'Bowery Basement Tattoos', 1, 0.6, 0.28, ARRAY['skull','text'], 'Sketchy underground parlour. Cheap but risky.'),

-- LONDON (3 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('London') LIMIT 1), 'Camden Ink Palace', 4, 2.0, 0.04, ARRAY['skull','tribal'], 'Legendary Camden Town parlour with decades of punk heritage.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('London') LIMIT 1), 'Shoreditch Skin Gallery', 3, 1.5, 0.06, ARRAY['abstract','geometric'], 'Trendy East London studio specializing in modern art tattoos.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('London') LIMIT 1), 'Hackney Back Alley Ink', 1, 0.5, 0.30, ARRAY['text','skull'], 'Dodgy backstreet shop. Enter at your own risk.'),

-- LOS ANGELES (3 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Los Angeles') LIMIT 1), 'Sunset Strip Tattoo', 5, 2.8, 0.01, ARRAY['portrait','sleeve'], 'Hollywood A-list tattoo destination. Flawless work.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Los Angeles') LIMIT 1), 'Venice Beach Ink', 3, 1.3, 0.07, ARRAY['tribal','abstract'], 'Beachside parlour with California vibes.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Los Angeles') LIMIT 1), 'East LA Tattoo Shack', 2, 0.8, 0.18, ARRAY['text','skull'], 'Budget shop in East LA. Hit or miss quality.'),

-- TOKYO (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Tokyo') LIMIT 1), 'Shibuya Irezumi Masters', 5, 3.0, 0.01, ARRAY['japanese','sleeve'], 'Traditional Japanese tattoo masters. Appointment only.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Tokyo') LIMIT 1), 'Harajuku Ink Lab', 4, 2.0, 0.03, ARRAY['geometric','abstract'], 'Cutting-edge designs in the heart of Harajuku.'),

-- BERLIN (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Berlin') LIMIT 1), 'Kreuzberg Tattoo Collective', 4, 1.8, 0.04, ARRAY['abstract','geometric'], 'Artist-run collective known for experimental work.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Berlin') LIMIT 1), 'Neukölln Needle Bar', 2, 0.9, 0.15, ARRAY['tribal','text'], 'Gritty neighbourhood shop with underground appeal.'),

-- SYDNEY (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Sydney') LIMIT 1), 'Bondi Ink House', 4, 1.9, 0.03, ARRAY['tribal','sleeve'], 'Premium beachside studio with ocean views.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Sydney') LIMIT 1), 'Kings Cross Tattoo', 2, 0.8, 0.16, ARRAY['skull','text'], 'Late-night parlour in the Cross. Affordable but rough.'),

-- NASHVILLE (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Nashville') LIMIT 1), 'Music Row Tattoo', 4, 1.7, 0.04, ARRAY['musical','text'], 'Where country stars get inked. Music-themed designs.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Nashville') LIMIT 1), 'Broadway Ink Shack', 2, 0.7, 0.20, ARRAY['skull','tribal'], 'Honky-tonk strip parlour. Cheap thrills.'),

-- AMSTERDAM (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Amsterdam') LIMIT 1), 'Red Light Tattoo Gallery', 3, 1.4, 0.06, ARRAY['abstract','portrait'], 'Artistic parlour in the heart of the city.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Amsterdam') LIMIT 1), 'Jordaan Ink Studio', 4, 1.8, 0.03, ARRAY['geometric','japanese'], 'Upscale canal-side studio with meticulous artists.'),

-- BARCELONA (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Barcelona') LIMIT 1), 'Gothic Quarter Tattoo', 3, 1.3, 0.07, ARRAY['tribal','abstract'], 'Atmospheric parlour in the old quarter.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Barcelona') LIMIT 1), 'Raval Underground Ink', 1, 0.5, 0.25, ARRAY['text','skull'], 'Basement shop. Cheap and cheerful... mostly.'),

-- MIAMI (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Miami') LIMIT 1), 'South Beach Ink', 4, 2.0, 0.03, ARRAY['portrait','sleeve'], 'Glamorous Miami Beach studio for the rich and famous.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Miami') LIMIT 1), 'Little Havana Tattoos', 2, 0.8, 0.14, ARRAY['tribal','text'], 'Colourful neighbourhood parlour with Cuban flair.'),

-- SEOUL (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Seoul') LIMIT 1), 'Gangnam Precision Ink', 5, 2.5, 0.02, ARRAY['geometric','japanese'], 'Ultra-clean studio with laser precision work.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Seoul') LIMIT 1), 'Hongdae Street Tattoo', 3, 1.1, 0.08, ARRAY['abstract','text'], 'Trendy youth district parlour with indie vibes.'),

-- MEXICO CITY (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Mexico City') LIMIT 1), 'Coyoacán Art Tattoo', 3, 1.2, 0.09, ARRAY['skull','portrait'], 'Frida-inspired artistic parlour with Day of the Dead motifs.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Mexico City') LIMIT 1), 'Tepito Ink Den', 1, 0.4, 0.30, ARRAY['tribal','text'], 'Street-level shop in the barrio. Extremely cheap, extremely risky.'),

-- PARIS (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Paris') LIMIT 1), 'Marais Encre Fine', 5, 2.6, 0.02, ARRAY['portrait','abstract'], 'Parisian haute couture of tattoos. Exquisite detail.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Paris') LIMIT 1), 'Pigalle Ink House', 2, 0.9, 0.12, ARRAY['skull','text'], 'Red light district parlour with edgy reputation.'),

-- CHICAGO (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Chicago') LIMIT 1), 'Wicker Park Tattoo Co', 4, 1.7, 0.04, ARRAY['geometric','sleeve'], 'Award-winning Chicago studio with incredible sleeve work.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Chicago') LIMIT 1), 'South Side Ink', 1, 0.5, 0.25, ARRAY['text','tribal'], 'Budget spot on the South Side. Bring your own bandages.'),

-- MUMBAI (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Mumbai') LIMIT 1), 'Bandra Ink Lounge', 3, 1.1, 0.10, ARRAY['geometric','japanese'], 'Bollywood-adjacent parlour with growing reputation.'),

-- ATLANTA (2 parlours)
((SELECT id FROM public.cities WHERE lower(name)=lower('Atlanta') LIMIT 1), 'Peachtree Ink Studio', 4, 1.6, 0.05, ARRAY['portrait','musical'], 'Hip-hop scene favourite with incredible portrait work.'),
((SELECT id FROM public.cities WHERE lower(name)=lower('Atlanta') LIMIT 1), 'East Point Tattoos', 2, 0.7, 0.18, ARRAY['text','tribal'], 'Neighbourhood shop with decent basics.'),

-- AUSTIN (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Austin') LIMIT 1), 'South Congress Tattoo', 3, 1.3, 0.06, ARRAY['musical','text'], 'Keep Austin Weird — eclectic designs for music lovers.'),

-- LAGOS (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Lagos') LIMIT 1), 'Lagos Ink Empire', 2, 0.7, 0.16, ARRAY['tribal','geometric'], 'West Africa''s rising tattoo scene. Bold tribal work.'),

-- KINGSTON (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Kingston') LIMIT 1), 'Kingston Roots Tattoo', 2, 0.8, 0.15, ARRAY['tribal','text'], 'Reggae-inspired designs with island soul.'),

-- DETROIT (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Detroit') LIMIT 1), 'Motor City Ink', 3, 1.1, 0.09, ARRAY['skull','sleeve'], 'Detroit grit meets artistic excellence.'),

-- CAPE TOWN (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Cape Town') LIMIT 1), 'Long Street Tattoo', 3, 1.0, 0.08, ARRAY['tribal','abstract'], 'Vibrant Cape Town parlour with African-inspired art.'),

-- DUBLIN (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Dublin') LIMIT 1), 'Temple Bar Ink', 3, 1.2, 0.07, ARRAY['text','geometric'], 'Celtic-inspired designs in Dublin''s cultural quarter.'),

-- STOCKHOLM (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Stockholm') LIMIT 1), 'Södermalm Tattoo Studio', 4, 1.8, 0.03, ARRAY['geometric','abstract'], 'Scandinavian minimalism meets tattoo artistry.'),

-- BUENOS AIRES (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Buenos Aires') LIMIT 1), 'San Telmo Tinta', 3, 1.0, 0.09, ARRAY['portrait','text'], 'Tango-district parlour with passionate artistry.'),

-- RIO DE JANEIRO (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Rio de Janeiro') LIMIT 1), 'Copacabana Ink', 2, 0.8, 0.14, ARRAY['tribal','abstract'], 'Beachside Brazilian parlour with colourful energy.'),

-- PORTLAND (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Portland') LIMIT 1), 'Hawthorne Tattoo Collective', 4, 1.5, 0.04, ARRAY['abstract','geometric'], 'Portland''s finest. Vegan ink available.'),

-- MANCHESTER (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Manchester') LIMIT 1), 'Northern Quarter Ink', 3, 1.2, 0.07, ARRAY['skull','musical'], 'Indie music scene tattoo hub in the NQ.'),

-- MEMPHIS (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('Memphis') LIMIT 1), 'Beale Street Tattoo', 2, 0.7, 0.15, ARRAY['musical','text'], 'Blues-inspired ink on the famous Beale Street.'),

-- SAN FRANCISCO (1 parlour)
((SELECT id FROM public.cities WHERE lower(name)=lower('San Francisco') LIMIT 1), 'Haight-Ashbury Ink', 3, 1.4, 0.06, ARRAY['abstract','sleeve'], 'Psychedelic-inspired designs with Summer of Love spirit.')

ON CONFLICT DO NOTHING;