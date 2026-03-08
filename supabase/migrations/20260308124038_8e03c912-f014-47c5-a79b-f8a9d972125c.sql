-- Seed tattoo parlours across 30 cities with varying quality
-- Format: (city_id, name, quality_tier, price_multiplier, infection_risk, specialties, description)

INSERT INTO tattoo_parlours (city_id, name, quality_tier, price_multiplier, infection_risk, specialties, description) VALUES
-- NEW YORK (3 parlours)
('a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 'Empire Ink Studio', 5, 2.5, 0.02, ARRAY['portrait','japanese'], 'Elite Manhattan tattoo studio. Celebrity clientele, sterile environment.'),
('a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 'Brooklyn Needle Works', 3, 1.2, 0.08, ARRAY['tribal','geometric'], 'Williamsburg shop with edgy designs and fair prices.'),
('a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 'Bowery Basement Tattoos', 1, 0.6, 0.28, ARRAY['skull','text'], 'Sketchy underground parlour. Cheap but risky.'),

-- LONDON (3 parlours)
('9f26ad86-51ed-4477-856d-610f14979310', 'Camden Ink Palace', 4, 2.0, 0.04, ARRAY['skull','tribal'], 'Legendary Camden Town parlour with decades of punk heritage.'),
('9f26ad86-51ed-4477-856d-610f14979310', 'Shoreditch Skin Gallery', 3, 1.5, 0.06, ARRAY['abstract','geometric'], 'Trendy East London studio specializing in modern art tattoos.'),
('9f26ad86-51ed-4477-856d-610f14979310', 'Hackney Back Alley Ink', 1, 0.5, 0.30, ARRAY['text','skull'], 'Dodgy backstreet shop. Enter at your own risk.'),

-- LOS ANGELES (3 parlours)
('cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 'Sunset Strip Tattoo', 5, 2.8, 0.01, ARRAY['portrait','sleeve'], 'Hollywood A-list tattoo destination. Flawless work.'),
('cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 'Venice Beach Ink', 3, 1.3, 0.07, ARRAY['tribal','abstract'], 'Beachside parlour with California vibes.'),
('cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 'East LA Tattoo Shack', 2, 0.8, 0.18, ARRAY['text','skull'], 'Budget shop in East LA. Hit or miss quality.'),

-- TOKYO (2 parlours)
('89b8b930-4fce-4776-a470-8943364ea120', 'Shibuya Irezumi Masters', 5, 3.0, 0.01, ARRAY['japanese','sleeve'], 'Traditional Japanese tattoo masters. Appointment only.'),
('89b8b930-4fce-4776-a470-8943364ea120', 'Harajuku Ink Lab', 4, 2.0, 0.03, ARRAY['geometric','abstract'], 'Cutting-edge designs in the heart of Harajuku.'),

-- BERLIN (2 parlours)
('cc1fd801-c4b3-448f-ad55-f307e10e14a0', 'Kreuzberg Tattoo Collective', 4, 1.8, 0.04, ARRAY['abstract','geometric'], 'Artist-run collective known for experimental work.'),
('cc1fd801-c4b3-448f-ad55-f307e10e14a0', 'Neukölln Needle Bar', 2, 0.9, 0.15, ARRAY['tribal','text'], 'Gritty neighbourhood shop with underground appeal.'),

-- SYDNEY (2 parlours)
('06a16e6b-5888-4046-90d8-dfca01eda238', 'Bondi Ink House', 4, 1.9, 0.03, ARRAY['tribal','sleeve'], 'Premium beachside studio with ocean views.'),
('06a16e6b-5888-4046-90d8-dfca01eda238', 'Kings Cross Tattoo', 2, 0.8, 0.16, ARRAY['skull','text'], 'Late-night parlour in the Cross. Affordable but rough.'),

-- NASHVILLE (2 parlours)
('2a518758-067c-4d34-8ff6-666a31169fe7', 'Music Row Tattoo', 4, 1.7, 0.04, ARRAY['musical','text'], 'Where country stars get inked. Music-themed designs.'),
('2a518758-067c-4d34-8ff6-666a31169fe7', 'Broadway Ink Shack', 2, 0.7, 0.20, ARRAY['skull','tribal'], 'Honky-tonk strip parlour. Cheap thrills.'),

-- AMSTERDAM (2 parlours)
('de4787a9-f69a-44d8-8747-1cb02cae0c1c', 'Red Light Tattoo Gallery', 3, 1.4, 0.06, ARRAY['abstract','portrait'], 'Artistic parlour in the heart of the city.'),
('de4787a9-f69a-44d8-8747-1cb02cae0c1c', 'Jordaan Ink Studio', 4, 1.8, 0.03, ARRAY['geometric','japanese'], 'Upscale canal-side studio with meticulous artists.'),

-- BARCELONA (2 parlours)
('6c2386aa-a874-4c36-b153-8e10376f4a6e', 'Gothic Quarter Tattoo', 3, 1.3, 0.07, ARRAY['tribal','abstract'], 'Atmospheric parlour in the old quarter.'),
('6c2386aa-a874-4c36-b153-8e10376f4a6e', 'Raval Underground Ink', 1, 0.5, 0.25, ARRAY['text','skull'], 'Basement shop. Cheap and cheerful... mostly.'),

-- MIAMI (2 parlours)
('96c964de-4dbd-4bbe-80b7-6c9f68d4ba32', 'South Beach Ink', 4, 2.0, 0.03, ARRAY['portrait','sleeve'], 'Glamorous Miami Beach studio for the rich and famous.'),
('96c964de-4dbd-4bbe-80b7-6c9f68d4ba32', 'Little Havana Tattoos', 2, 0.8, 0.14, ARRAY['tribal','text'], 'Colourful neighbourhood parlour with Cuban flair.'),

-- SEOUL (2 parlours)
('65b3346d-0fc9-4319-b711-84a3d553d22b', 'Gangnam Precision Ink', 5, 2.5, 0.02, ARRAY['geometric','japanese'], 'Ultra-clean studio with laser precision work.'),
('65b3346d-0fc9-4319-b711-84a3d553d22b', 'Hongdae Street Tattoo', 3, 1.1, 0.08, ARRAY['abstract','text'], 'Trendy youth district parlour with indie vibes.'),

-- MEXICO CITY (2 parlours)
('057581ce-13de-4db3-bf7d-35a067fa2e92', 'Coyoacán Art Tattoo', 3, 1.2, 0.09, ARRAY['skull','portrait'], 'Frida-inspired artistic parlour with Day of the Dead motifs.'),
('057581ce-13de-4db3-bf7d-35a067fa2e92', 'Tepito Ink Den', 1, 0.4, 0.30, ARRAY['tribal','text'], 'Street-level shop in the barrio. Extremely cheap, extremely risky.'),

-- PARIS (2 parlours)
('13d450a9-eab3-430c-b5d1-377e5d3f2539', 'Marais Encre Fine', 5, 2.6, 0.02, ARRAY['portrait','abstract'], 'Parisian haute couture of tattoos. Exquisite detail.'),
('13d450a9-eab3-430c-b5d1-377e5d3f2539', 'Pigalle Ink House', 2, 0.9, 0.12, ARRAY['skull','text'], 'Red light district parlour with edgy reputation.'),

-- CHICAGO (2 parlours)
('29809134-e947-408b-9786-6d7b51181548', 'Wicker Park Tattoo Co', 4, 1.7, 0.04, ARRAY['geometric','sleeve'], 'Award-winning Chicago studio with incredible sleeve work.'),
('29809134-e947-408b-9786-6d7b51181548', 'South Side Ink', 1, 0.5, 0.25, ARRAY['text','tribal'], 'Budget spot on the South Side. Bring your own bandages.'),

-- MUMBAI (1 parlour)
('e61cf950-1934-4c6c-833a-1d3b0d85af85', 'Bandra Ink Lounge', 3, 1.1, 0.10, ARRAY['geometric','japanese'], 'Bollywood-adjacent parlour with growing reputation.'),

-- ATLANTA (2 parlours)
('872150e0-6fa6-4150-b622-b0f8e60ea6fb', 'Peachtree Ink Studio', 4, 1.6, 0.05, ARRAY['portrait','musical'], 'Hip-hop scene favourite with incredible portrait work.'),
('872150e0-6fa6-4150-b622-b0f8e60ea6fb', 'East Point Tattoos', 2, 0.7, 0.18, ARRAY['text','tribal'], 'Neighbourhood shop with decent basics.'),

-- AUSTIN (1 parlour)
('8215d23e-5714-478e-9ac8-b7b82994fdc6', 'South Congress Tattoo', 3, 1.3, 0.06, ARRAY['musical','text'], 'Keep Austin Weird — eclectic designs for music lovers.'),

-- LAGOS (1 parlour)
('bdb69b1e-8449-4116-afa3-ffa38549b057', 'Lagos Ink Empire', 2, 0.7, 0.16, ARRAY['tribal','geometric'], 'West Africa''s rising tattoo scene. Bold tribal work.'),

-- KINGSTON (1 parlour)
('eac6911c-26a5-40b5-8775-6c777c0426ad', 'Kingston Roots Tattoo', 2, 0.8, 0.15, ARRAY['tribal','text'], 'Reggae-inspired designs with island soul.'),

-- DETROIT (1 parlour)
('0f6c3eea-29c4-443b-b505-171a6d97c3f5', 'Motor City Ink', 3, 1.1, 0.09, ARRAY['skull','sleeve'], 'Detroit grit meets artistic excellence.'),

-- CAPE TOWN (1 parlour)
('2d9e6eca-87f9-45c4-8d19-b431032ea46b', 'Long Street Tattoo', 3, 1.0, 0.08, ARRAY['tribal','abstract'], 'Vibrant Cape Town parlour with African-inspired art.'),

-- DUBLIN (1 parlour)
('31f54d08-a832-417a-8db1-3f0900e11b6a', 'Temple Bar Ink', 3, 1.2, 0.07, ARRAY['text','geometric'], 'Celtic-inspired designs in Dublin''s cultural quarter.'),

-- STOCKHOLM (1 parlour)
('2e670249-4f15-4089-b3cf-a1c2545bb5fa', 'Södermalm Tattoo Studio', 4, 1.8, 0.03, ARRAY['geometric','abstract'], 'Scandinavian minimalism meets tattoo artistry.'),

-- BUENOS AIRES (1 parlour)
('03074fa3-94d0-450d-9520-092f3461daab', 'San Telmo Tinta', 3, 1.0, 0.09, ARRAY['portrait','text'], 'Tango-district parlour with passionate artistry.'),

-- RIO DE JANEIRO (1 parlour)
('0c9c8a7e-c6b4-4927-932a-8491c2b40a06', 'Copacabana Ink', 2, 0.8, 0.14, ARRAY['tribal','abstract'], 'Beachside Brazilian parlour with colourful energy.'),

-- PORTLAND (1 parlour)
('b1ecef49-6ba4-47d3-b6dd-08621fb85e78', 'Hawthorne Tattoo Collective', 4, 1.5, 0.04, ARRAY['abstract','geometric'], 'Portland''s finest. Vegan ink available.'),

-- MANCHESTER (1 parlour)
('8bb73a75-bd57-49b3-9a03-a68f37a19f56', 'Northern Quarter Ink', 3, 1.2, 0.07, ARRAY['skull','musical'], 'Indie music scene tattoo hub in the NQ.'),

-- MEMPHIS (1 parlour)
('b4d3f32e-d174-4b55-85e3-e37e4f29fe11', 'Beale Street Tattoo', 2, 0.7, 0.15, ARRAY['musical','text'], 'Blues-inspired ink on the famous Beale Street.'),

-- SAN FRANCISCO (1 parlour)
('73fae343-9a12-4ecb-867f-ad6ec3699364', 'Haight-Ashbury Ink', 3, 1.4, 0.06, ARRAY['abstract','sleeve'], 'Psychedelic-inspired designs with Summer of Love spirit.')

ON CONFLICT DO NOTHING;