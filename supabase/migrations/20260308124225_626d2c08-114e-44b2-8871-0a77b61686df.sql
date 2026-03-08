-- Seed tattoo artists across all parlours
-- Tier 5 parlours: 2-3 artists (fame 70-95, quality_bonus 20-30)
-- Tier 4 parlours: 2 artists (fame 50-75, quality_bonus 12-22)
-- Tier 3 parlours: 1-2 artists (fame 25-50, quality_bonus 5-12)
-- Tier 2 parlours: 1 artist (fame 10-25, quality_bonus 2-8)
-- Tier 1 parlours: 1 artist (fame 3-15, quality_bonus 0-3)

INSERT INTO tattoo_artists (parlour_id, name, nickname, fame_level, specialty, quality_bonus, price_premium, accepts_custom, bio, total_tattoos_done) VALUES

-- TIER 5: Sunset Strip Tattoo (LA)
('cfd0de1f-8257-4bc2-b735-d7e40dac274e', 'Marcus "Viper" Cole', 'Viper', 95, 'portrait', 30, 3.0, true, 'Hollywood legend. Has tattooed half the Walk of Fame.', 4200),
('cfd0de1f-8257-4bc2-b735-d7e40dac274e', 'Jade Nakamura', 'Jade', 82, 'sleeve', 24, 2.2, true, 'Japanese-American artist known for breathtaking full sleeves.', 2800),
('cfd0de1f-8257-4bc2-b735-d7e40dac274e', 'Devon "Flash" Wright', 'Flash', 71, 'geometric', 20, 1.8, true, 'Speed and precision. Gets it right the first time, every time.', 1900),

-- TIER 5: Empire Ink Studio (NY)
('8f16a127-14b4-4785-9c83-8294e8ee30cf', 'Isabella "Ink Queen" Torres', 'Ink Queen', 92, 'portrait', 28, 2.8, true, 'NYC royalty. Featured in every tattoo magazine that matters.', 3800),
('8f16a127-14b4-4785-9c83-8294e8ee30cf', 'Kai "Shadow" Chen', 'Shadow', 85, 'japanese', 25, 2.4, true, 'Master of dark Japanese imagery. Appointment waitlist: 3 months.', 3100),

-- TIER 5: Marais Encre Fine (Paris)
('eebec28c-ef69-473a-a6aa-66a8fc6ab124', 'Lucien Beaumont', 'Le Maître', 90, 'portrait', 28, 2.6, true, 'French master of photorealistic portraiture.', 3500),
('eebec28c-ef69-473a-a6aa-66a8fc6ab124', 'Céline Moreau', 'Cé', 78, 'abstract', 22, 2.0, true, 'Avant-garde artist who blurs the line between skin and canvas.', 2400),

-- TIER 5: Gangnam Precision Ink (Seoul)
('70a25f27-21b1-4d54-8326-eb4df4801927', 'Park Joon-ho', 'Precision', 88, 'geometric', 26, 2.5, true, 'Korean perfectionist. Every line is mathematically precise.', 3200),
('70a25f27-21b1-4d54-8326-eb4df4801927', 'Kim Soo-yeon', 'Sooya', 75, 'japanese', 21, 2.0, true, 'Blends Korean and Japanese aesthetics beautifully.', 2100),

-- TIER 5: Shibuya Irezumi Masters (Tokyo)
('d3d97c11-3305-45f7-8564-a4f86cd71f13', 'Tanaka Hiroshi', 'Master Tanaka', 96, 'japanese', 30, 3.0, true, 'Living legend of traditional Japanese tattooing. 40+ years experience.', 5500),
('d3d97c11-3305-45f7-8564-a4f86cd71f13', 'Yuki Sato', 'Yuki', 80, 'sleeve', 23, 2.2, true, 'Modern irezumi with traditional soul.', 2600),

-- TIER 4: Camden Ink Palace (London)
('e077a84f-b24b-4a25-bde4-db02a9d75f57', 'Danny "Bones" McRae', 'Bones', 68, 'skull', 18, 1.7, true, 'Punk scene veteran. Skull work is unmatched.', 1800),
('e077a84f-b24b-4a25-bde4-db02a9d75f57', 'Priya Sharma', NULL, 55, 'tribal', 14, 1.4, true, 'Combines South Asian patterns with modern tribal.', 1200),

-- TIER 4: Jordaan Ink Studio (Amsterdam)
('9d0f007b-35a7-4adf-bf52-4ae0b6f89631', 'Lars van den Berg', 'Dutch', 62, 'geometric', 16, 1.6, true, 'Amsterdam''s geometry king. Clean lines, perfect symmetry.', 1500),
('9d0f007b-35a7-4adf-bf52-4ae0b6f89631', 'Mika Takahashi', NULL, 52, 'japanese', 13, 1.3, false, 'Apprentice to a Tokyo master, building reputation in Europe.', 900),

-- TIER 4: Peachtree Ink Studio (Atlanta)
('77389104-efb5-40d0-befc-d19b5cf39e9c', 'Darius "King D" Johnson', 'King D', 70, 'portrait', 19, 1.8, true, 'ATL''s finest portrait artist. Hip-hop scene legend.', 2000),
('77389104-efb5-40d0-befc-d19b5cf39e9c', 'Tasha Williams', 'T-Ink', 54, 'musical', 13, 1.4, true, 'Specializes in music-themed pieces for touring artists.', 1100),

-- TIER 4: Kreuzberg Tattoo Collective (Berlin)
('fa6f8c77-61e7-4036-a07b-3a3fe6ae55b9', 'Nico Schwarz', 'Nico', 65, 'abstract', 17, 1.6, true, 'Berlin underground art scene pioneer.', 1600),
('fa6f8c77-61e7-4036-a07b-3a3fe6ae55b9', 'Lena Fischer', NULL, 50, 'geometric', 12, 1.3, true, 'Bauhaus-inspired minimalist tattoo work.', 950),

-- TIER 4: Wicker Park Tattoo Co (Chicago)
('92646482-28d1-4fd5-81f3-79208e929953', 'Mike "Chi-Town" Kowalski', 'Chi-Town', 63, 'sleeve', 16, 1.5, true, 'Chicago''s sleeve specialist. Full arm pieces in 2 sessions.', 1400),
('92646482-28d1-4fd5-81f3-79208e929953', 'Rosa Hernandez', NULL, 51, 'geometric', 12, 1.3, true, 'Precision geometric work with Latin influences.', 980),

-- TIER 4: South Beach Ink (Miami)
('f83ac900-8459-4215-824a-afd4c09bfe17', 'Carlos "Cubano" Reyes', 'Cubano', 67, 'portrait', 18, 1.7, true, 'Miami Beach celebrity artist with tropical flair.', 1700),
('f83ac900-8459-4215-824a-afd4c09bfe17', 'Valentina Cruz', 'Val', 53, 'sleeve', 13, 1.4, true, 'Colourful sleeve work inspired by the Miami art scene.', 1050),

-- TIER 4: Music Row Tattoo (Nashville)
('8d2f4e91-9776-442d-a219-c8a8ca84fbf0', 'Billy Ray "Strings" Turner', 'Strings', 60, 'musical', 15, 1.5, true, 'Country music tattoo legend. Guitar-shaped pieces are his signature.', 1350),
('8d2f4e91-9776-442d-a219-c8a8ca84fbf0', 'Savannah Brooks', NULL, 48, 'text', 11, 1.2, false, 'Beautiful script work, popular with songwriters.', 850),

-- TIER 4: Bondi Ink House (Sydney)
('e7378a51-eb89-4d0c-b100-7a55343397e8', 'Shane "Bondi" O''Brien', 'Bondi', 64, 'tribal', 17, 1.6, true, 'Polynesian-inspired tribal from Down Under.', 1550),
('e7378a51-eb89-4d0c-b100-7a55343397e8', 'Mei Lin', NULL, 50, 'sleeve', 12, 1.3, true, 'Asian-Australian fusion sleeve artist.', 920),

-- TIER 4: Harajuku Ink Lab (Tokyo)
('05ce609e-7794-4130-a267-bdf32f00e6d6', 'Aoi Yamamoto', 'Pixel', 58, 'geometric', 15, 1.5, true, 'Digital-age tattoo art. Pixel and glitch aesthetics.', 1250),
('05ce609e-7794-4130-a267-bdf32f00e6d6', 'Ren Fujita', NULL, 52, 'abstract', 13, 1.3, true, 'Avant-garde Tokyo ink with anime influences.', 980),

-- TIER 4: Hawthorne Tattoo Collective (Portland)
('42874d31-6847-45d7-b636-dc75927f4f3b', 'River Stone', NULL, 61, 'abstract', 16, 1.5, true, 'Portland''s eco-conscious tattoo artist. Vegan inks only.', 1300),
('42874d31-6847-45d7-b636-dc75927f4f3b', 'Sage Mathews', NULL, 50, 'geometric', 12, 1.3, true, 'Pacific Northwest nature-inspired geometric work.', 900),

-- TIER 4: Södermalm Tattoo Studio (Stockholm)
('8b04d2de-3e38-46e6-9c01-7db47d7df2ad', 'Erik Lindqvist', 'Viking', 66, 'tribal', 17, 1.6, true, 'Norse mythology meets modern tattoo art.', 1650),
('8b04d2de-3e38-46e6-9c01-7db47d7df2ad', 'Astrid Nilsson', NULL, 52, 'geometric', 13, 1.3, true, 'Scandinavian minimalist design philosophy.', 1000),

-- TIER 3: Brooklyn Needle Works (NY)
('37897689-a5dd-4b0e-96df-d35effa078b9', 'Tony "BK" Russo', 'BK', 42, 'tribal', 10, 1.2, false, 'Old-school Brooklyn tattooer with street cred.', 750),
('37897689-a5dd-4b0e-96df-d35effa078b9', 'Zara Okafor', NULL, 30, 'geometric', 7, 1.1, false, 'Up-and-coming artist with a growing Instagram following.', 400),

-- TIER 3: Shoreditch Skin Gallery (London)
('455204ce-3ad1-4eec-a03a-6f2979da8e3a', 'Felix Gray', NULL, 45, 'abstract', 11, 1.2, false, 'Art school graduate turned tattoo artist. Bold colours.', 800),

-- TIER 3: Venice Beach Ink (LA)
('8aac82d0-8a11-4225-ac0f-9a078424d8f7', 'Skyler James', 'Sky', 38, 'tribal', 9, 1.1, false, 'Surfer by day, tattoo artist by afternoon.', 600),

-- TIER 3: Red Light Tattoo Gallery (Amsterdam)
('cef71cd4-7e8d-4ff3-9f28-b34aabb99938', 'Pieter de Vries', NULL, 40, 'abstract', 10, 1.2, false, 'Abstract expressionism on skin.', 700),

-- TIER 3: Gothic Quarter Tattoo (Barcelona)
('ef182134-e887-48e5-a06d-03a27dafab41', 'Alejandro Ruiz', 'Alex', 35, 'tribal', 8, 1.1, false, 'Catalonian artist with Mediterranean flair.', 550),

-- TIER 3: Hongdae Street Tattoo (Seoul)
('2a104cc0-73b0-4b5c-8755-6fc1a792d532', 'Lee Min-jun', NULL, 43, 'abstract', 10, 1.2, false, 'K-pop inspired designs popular with young Koreans.', 780),

-- TIER 3: Coyoacán Art Tattoo (Mexico City)
('b7400f48-91df-434c-8dae-9f10868a418a', 'Diego "Catrina" Flores', 'Catrina', 44, 'skull', 11, 1.2, false, 'Day of the Dead specialist. Incredible sugar skull work.', 820),

-- TIER 3: South Congress Tattoo (Austin)
('270f9b9e-aa70-492b-91bd-104b0f51ffa1', 'Jake "Lone Star" Murphy', 'Lone Star', 37, 'musical', 8, 1.1, false, 'Austin music scene regular. Guitar and amp designs.', 580),

-- TIER 3: Motor City Ink (Detroit)
('59658179-010a-40b1-b858-dd211b7736ef', 'Andre "Motor" Jackson', 'Motor', 40, 'skull', 9, 1.2, false, 'Detroit grit in every piece. Mechanical skull mashups.', 680),

-- TIER 3: Temple Bar Ink (Dublin)
('e5682765-1798-4cf0-9a41-42d7c6497cc7', 'Sean O''Malley', 'Celtic', 36, 'geometric', 8, 1.1, false, 'Celtic knot specialist with generations of Irish heritage.', 520),

-- TIER 3: Long Street Tattoo (Cape Town)
('b89e7f29-ac8e-448c-822d-bc77ba2f74ae', 'Thabo Mokoena', NULL, 33, 'tribal', 7, 1.1, false, 'African tribal patterns with modern interpretation.', 450),

-- TIER 3: Bandra Ink Lounge (Mumbai)
('8e97a1ee-84bb-4d3d-9acd-b64f81a39b22', 'Arjun Mehta', NULL, 35, 'geometric', 8, 1.1, false, 'Bollywood stars'' secret tattoo artist.', 500),

-- TIER 3: San Telmo Tinta (Buenos Aires)
('67f7e5b6-c2bc-489f-89b4-42f1c9032992', 'Mateo "Tango" Herrera', 'Tango', 38, 'portrait', 9, 1.1, false, 'Argentine passion in every portrait.', 600),

-- TIER 3: Haight-Ashbury Ink (SF)
('d7629b71-e51a-4d96-ad81-dd1f7dccf0c1', 'Phoenix Reed', NULL, 41, 'abstract', 10, 1.2, false, 'Psychedelic art meets modern tattoo. Trippy but precise.', 720),

-- TIER 3: Northern Quarter Ink (Manchester)
('31f2eae7-9976-48ca-9369-3159bc64cb34', 'Tommy "Manc" Brennan', 'Manc', 39, 'skull', 9, 1.1, false, 'Oasis fan. Manchester music heritage in every piece.', 640),

-- TIER 2: East LA Tattoo Shack (LA)
('7e5ddff4-2b08-4f14-a577-c87518aaf8bd', 'Jorge "Lobo" Gutierrez', 'Lobo', 22, 'text', 6, 1.0, false, 'Chicano lettering specialist. Affordable and solid.', 350),

-- TIER 2: Neukölln Needle Bar (Berlin)
('0c799142-cb00-471a-91f0-33d9d4a6f9da', 'Klaus Weber', NULL, 18, 'tribal', 4, 1.0, false, 'Berlin underground scene regular. Cheap but decent.', 280),

-- TIER 2: Kings Cross Tattoo (Sydney)
('a144c5fb-61bd-4d1e-b0f8-34dda614885c', 'Bazza Thompson', 'Bazza', 20, 'skull', 5, 1.0, false, 'Late-night ink for the brave. Cash only.', 320),

-- TIER 2: East Point Tattoos (Atlanta)
('a99ca8cc-6b7e-477f-afa7-0cc2c7045714', 'Marcus Brown', NULL, 16, 'text', 4, 1.0, false, 'Solid text and basic designs at fair prices.', 240),

-- TIER 2: Broadway Ink Shack (Nashville)
('c138f186-262e-4664-b190-50c1f24c35f4', 'Dusty Rhodes', NULL, 19, 'musical', 5, 1.0, false, 'Honky-tonk tattoo artist. Cheap and cheerful.', 300),

-- TIER 2: Little Havana Tattoos (Miami)
('b710bbf6-1ebb-4adc-9e18-6d324aecf17c', 'Ramon "Havana" Diaz', 'Havana', 21, 'tribal', 5, 1.0, false, 'Cuban flair with Caribbean colours.', 330),

-- TIER 2: Pigalle Ink House (Paris)
('47f49861-819c-46aa-bc4d-be283aa9e9c2', 'Bruno Petit', NULL, 17, 'skull', 4, 1.0, false, 'Parisian edgewalker. Dark designs at budget prices.', 260),

-- TIER 2: Lagos Ink Empire
('0b380bc4-6701-46a0-ae89-b1ed62405fc3', 'Chidi Okafor', NULL, 20, 'tribal', 5, 1.0, false, 'Nigerian tribal art pioneer.', 310),

-- TIER 2: Kingston Roots Tattoo
('b36ae8a0-da75-4b00-a271-77dcd007744f', 'Marlon "Roots" Campbell', 'Roots', 18, 'tribal', 4, 1.0, false, 'Rastafari-inspired ink with reggae soul.', 270),

-- TIER 2: Beale Street Tattoo (Memphis)
('351dca09-2692-4a66-b933-c784900d8a02', 'Earl "Blues" Washington', 'Blues', 23, 'musical', 6, 1.0, false, 'Blues music tattoos on the legendary Beale Street.', 360),

-- TIER 2: Copacabana Ink (Rio)
('a8b589fc-ed80-4aea-ae63-de4092857988', 'Rafael Santos', 'Rafa', 19, 'tribal', 5, 1.0, false, 'Brazilian tribal meets beach culture.', 290),

-- TIER 1: Bowery Basement Tattoos (NY)
('42d4c06b-2ef4-4420-b8a7-b90eff477300', 'Nick "Needles" Petrova', 'Needles', 12, 'skull', 2, 1.0, false, 'Self-taught. What he lacks in finesse he makes up in speed.', 180),

-- TIER 1: Hackney Back Alley Ink (London)
('fc2510e0-6bf4-43d4-88c9-f3223efdf252', 'Gaz "Dodgy" Smith', 'Dodgy', 8, 'text', 1, 1.0, false, 'You get what you pay for. Bring your own antiseptic.', 120),

-- TIER 1: South Side Ink (Chicago)
('760862c8-8a0f-4c7f-b89f-9c581961a14a', 'Eddie "Scratch" Novak', 'Scratch', 10, 'tribal', 2, 1.0, false, 'Budget ink. Results may vary. Significantly.', 150),

-- TIER 1: Raval Underground Ink (Barcelona)
('251a7f5b-8759-4dcb-a71d-271673cd7a2e', 'Paco "El Rata" Moreno', 'El Rata', 6, 'text', 0, 1.0, false, 'Basement operation. No questions asked, no refunds given.', 90),

-- TIER 1: Tepito Ink Den (Mexico City)
('aa8fcd22-13f5-4de5-be41-7d4ce099fc17', 'El Chucho', NULL, 5, 'tribal', 0, 1.0, false, 'Street-level tattoo artist. Cheap as it gets.', 70)

ON CONFLICT DO NOTHING;