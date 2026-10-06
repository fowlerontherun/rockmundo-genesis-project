-- Resolve tattoo parlours by stable name + city rather than production UUIDs.
DO $tattoo_artist_parlour_dependencies$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required.parlour_name || ' @ ' || required.city_name ORDER BY required.city_name, required.parlour_name)
    INTO v_missing
    FROM (VALUES
      ('Harajuku Ink Lab','Tokyo'),
      ('Lagos Ink Empire','Lagos'),
      ('Neukölln Needle Bar','Berlin'),
      ('Raval Underground Ink','Barcelona'),
      ('South Congress Tattoo','Austin'),
      ('Hongdae Street Tattoo','Seoul'),
      ('Northern Quarter Ink','Manchester'),
      ('Beale Street Tattoo','Memphis'),
      ('Brooklyn Needle Works','New York'),
      ('Hawthorne Tattoo Collective','Portland'),
      ('Bowery Basement Tattoos','New York'),
      ('Shoreditch Skin Gallery','London'),
      ('Pigalle Ink House','Paris'),
      ('Motor City Ink','Detroit'),
      ('San Telmo Tinta','Buenos Aires'),
      ('Gangnam Precision Ink','Seoul'),
      ('South Side Ink','Chicago'),
      ('Peachtree Ink Studio','Atlanta'),
      ('East LA Tattoo Shack','Los Angeles'),
      ('Venice Beach Ink','Los Angeles'),
      ('Södermalm Tattoo Studio','Stockholm'),
      ('Music Row Tattoo','Nashville'),
      ('Bandra Ink Lounge','Mumbai'),
      ('Empire Ink Studio','New York'),
      ('Wicker Park Tattoo Co','Chicago'),
      ('Jordaan Ink Studio','Amsterdam'),
      ('Kings Cross Tattoo','Sydney'),
      ('Copacabana Ink','Rio de Janeiro'),
      ('East Point Tattoos','Atlanta'),
      ('Tepito Ink Den','Mexico City'),
      ('Kingston Roots Tattoo','Kingston'),
      ('Little Havana Tattoos','Miami'),
      ('Coyoacán Art Tattoo','Mexico City'),
      ('Long Street Tattoo','Cape Town'),
      ('Broadway Ink Shack','Nashville'),
      ('Red Light Tattoo Gallery','Amsterdam'),
      ('Sunset Strip Tattoo','Los Angeles'),
      ('Shibuya Irezumi Masters','Tokyo'),
      ('Haight-Ashbury Ink','San Francisco'),
      ('Camden Ink Palace','London'),
      ('Temple Bar Ink','Dublin'),
      ('Bondi Ink House','Sydney'),
      ('Marais Encre Fine','Paris'),
      ('Gothic Quarter Tattoo','Barcelona'),
      ('South Beach Ink','Miami'),
      ('Kreuzberg Tattoo Collective','Berlin'),
      ('Hackney Back Alley Ink','London')
    ) AS required(parlour_name, city_name)
   WHERE NOT EXISTS (
     SELECT 1
       FROM public.tattoo_parlours tp
       JOIN public.cities city ON city.id = tp.city_id
      WHERE lower(tp.name) = lower(required.parlour_name)
        AND lower(city.name) = lower(required.city_name)
   );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Tattoo artist seed requires canonical parlours: %', v_missing;
  END IF;
END
$tattoo_artist_parlour_dependencies$;

-- Seed tattoo artists across all parlours
-- Tier 5 parlours: 2-3 artists (fame 70-95, quality_bonus 20-30)
-- Tier 4 parlours: 2 artists (fame 50-75, quality_bonus 12-22)
-- Tier 3 parlours: 1-2 artists (fame 25-50, quality_bonus 5-12)
-- Tier 2 parlours: 1 artist (fame 10-25, quality_bonus 2-8)
-- Tier 1 parlours: 1 artist (fame 3-15, quality_bonus 0-3)

INSERT INTO tattoo_artists (parlour_id, name, nickname, fame_level, specialty, quality_bonus, price_premium, accepts_custom, bio, total_tattoos_done) VALUES

-- TIER 5: Sunset Strip Tattoo (LA)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Sunset Strip Tattoo') AND lower(city.name) = lower('Los Angeles') LIMIT 1), 'Marcus "Viper" Cole', 'Viper', 95, 'portrait', 30, 3.0, true, 'Hollywood legend. Has tattooed half the Walk of Fame.', 4200),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Sunset Strip Tattoo') AND lower(city.name) = lower('Los Angeles') LIMIT 1), 'Jade Nakamura', 'Jade', 82, 'sleeve', 24, 2.2, true, 'Japanese-American artist known for breathtaking full sleeves.', 2800),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Sunset Strip Tattoo') AND lower(city.name) = lower('Los Angeles') LIMIT 1), 'Devon "Flash" Wright', 'Flash', 71, 'geometric', 20, 1.8, true, 'Speed and precision. Gets it right the first time, every time.', 1900),

-- TIER 5: Empire Ink Studio (NY)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Empire Ink Studio') AND lower(city.name) = lower('New York') LIMIT 1), 'Isabella "Ink Queen" Torres', 'Ink Queen', 92, 'portrait', 28, 2.8, true, 'NYC royalty. Featured in every tattoo magazine that matters.', 3800),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Empire Ink Studio') AND lower(city.name) = lower('New York') LIMIT 1), 'Kai "Shadow" Chen', 'Shadow', 85, 'japanese', 25, 2.4, true, 'Master of dark Japanese imagery. Appointment waitlist: 3 months.', 3100),

-- TIER 5: Marais Encre Fine (Paris)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Marais Encre Fine') AND lower(city.name) = lower('Paris') LIMIT 1), 'Lucien Beaumont', 'Le Maître', 90, 'portrait', 28, 2.6, true, 'French master of photorealistic portraiture.', 3500),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Marais Encre Fine') AND lower(city.name) = lower('Paris') LIMIT 1), 'Céline Moreau', 'Cé', 78, 'abstract', 22, 2.0, true, 'Avant-garde artist who blurs the line between skin and canvas.', 2400),

-- TIER 5: Gangnam Precision Ink (Seoul)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Gangnam Precision Ink') AND lower(city.name) = lower('Seoul') LIMIT 1), 'Park Joon-ho', 'Precision', 88, 'geometric', 26, 2.5, true, 'Korean perfectionist. Every line is mathematically precise.', 3200),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Gangnam Precision Ink') AND lower(city.name) = lower('Seoul') LIMIT 1), 'Kim Soo-yeon', 'Sooya', 75, 'japanese', 21, 2.0, true, 'Blends Korean and Japanese aesthetics beautifully.', 2100),

-- TIER 5: Shibuya Irezumi Masters (Tokyo)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Shibuya Irezumi Masters') AND lower(city.name) = lower('Tokyo') LIMIT 1), 'Tanaka Hiroshi', 'Master Tanaka', 96, 'japanese', 30, 3.0, true, 'Living legend of traditional Japanese tattooing. 40+ years experience.', 5500),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Shibuya Irezumi Masters') AND lower(city.name) = lower('Tokyo') LIMIT 1), 'Yuki Sato', 'Yuki', 80, 'sleeve', 23, 2.2, true, 'Modern irezumi with traditional soul.', 2600),

-- TIER 4: Camden Ink Palace (London)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Camden Ink Palace') AND lower(city.name) = lower('London') LIMIT 1), 'Danny "Bones" McRae', 'Bones', 68, 'skull', 18, 1.7, true, 'Punk scene veteran. Skull work is unmatched.', 1800),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Camden Ink Palace') AND lower(city.name) = lower('London') LIMIT 1), 'Priya Sharma', NULL, 55, 'tribal', 14, 1.4, true, 'Combines South Asian patterns with modern tribal.', 1200),

-- TIER 4: Jordaan Ink Studio (Amsterdam)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Jordaan Ink Studio') AND lower(city.name) = lower('Amsterdam') LIMIT 1), 'Lars van den Berg', 'Dutch', 62, 'geometric', 16, 1.6, true, 'Amsterdam''s geometry king. Clean lines, perfect symmetry.', 1500),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Jordaan Ink Studio') AND lower(city.name) = lower('Amsterdam') LIMIT 1), 'Mika Takahashi', NULL, 52, 'japanese', 13, 1.3, false, 'Apprentice to a Tokyo master, building reputation in Europe.', 900),

-- TIER 4: Peachtree Ink Studio (Atlanta)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Peachtree Ink Studio') AND lower(city.name) = lower('Atlanta') LIMIT 1), 'Darius "King D" Johnson', 'King D', 70, 'portrait', 19, 1.8, true, 'ATL''s finest portrait artist. Hip-hop scene legend.', 2000),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Peachtree Ink Studio') AND lower(city.name) = lower('Atlanta') LIMIT 1), 'Tasha Williams', 'T-Ink', 54, 'musical', 13, 1.4, true, 'Specializes in music-themed pieces for touring artists.', 1100),

-- TIER 4: Kreuzberg Tattoo Collective (Berlin)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Kreuzberg Tattoo Collective') AND lower(city.name) = lower('Berlin') LIMIT 1), 'Nico Schwarz', 'Nico', 65, 'abstract', 17, 1.6, true, 'Berlin underground art scene pioneer.', 1600),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Kreuzberg Tattoo Collective') AND lower(city.name) = lower('Berlin') LIMIT 1), 'Lena Fischer', NULL, 50, 'geometric', 12, 1.3, true, 'Bauhaus-inspired minimalist tattoo work.', 950),

-- TIER 4: Wicker Park Tattoo Co (Chicago)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Wicker Park Tattoo Co') AND lower(city.name) = lower('Chicago') LIMIT 1), 'Mike "Chi-Town" Kowalski', 'Chi-Town', 63, 'sleeve', 16, 1.5, true, 'Chicago''s sleeve specialist. Full arm pieces in 2 sessions.', 1400),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Wicker Park Tattoo Co') AND lower(city.name) = lower('Chicago') LIMIT 1), 'Rosa Hernandez', NULL, 51, 'geometric', 12, 1.3, true, 'Precision geometric work with Latin influences.', 980),

-- TIER 4: South Beach Ink (Miami)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('South Beach Ink') AND lower(city.name) = lower('Miami') LIMIT 1), 'Carlos "Cubano" Reyes', 'Cubano', 67, 'portrait', 18, 1.7, true, 'Miami Beach celebrity artist with tropical flair.', 1700),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('South Beach Ink') AND lower(city.name) = lower('Miami') LIMIT 1), 'Valentina Cruz', 'Val', 53, 'sleeve', 13, 1.4, true, 'Colourful sleeve work inspired by the Miami art scene.', 1050),

-- TIER 4: Music Row Tattoo (Nashville)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Music Row Tattoo') AND lower(city.name) = lower('Nashville') LIMIT 1), 'Billy Ray "Strings" Turner', 'Strings', 60, 'musical', 15, 1.5, true, 'Country music tattoo legend. Guitar-shaped pieces are his signature.', 1350),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Music Row Tattoo') AND lower(city.name) = lower('Nashville') LIMIT 1), 'Savannah Brooks', NULL, 48, 'text', 11, 1.2, false, 'Beautiful script work, popular with songwriters.', 850),

-- TIER 4: Bondi Ink House (Sydney)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Bondi Ink House') AND lower(city.name) = lower('Sydney') LIMIT 1), 'Shane "Bondi" O''Brien', 'Bondi', 64, 'tribal', 17, 1.6, true, 'Polynesian-inspired tribal from Down Under.', 1550),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Bondi Ink House') AND lower(city.name) = lower('Sydney') LIMIT 1), 'Mei Lin', NULL, 50, 'sleeve', 12, 1.3, true, 'Asian-Australian fusion sleeve artist.', 920),

-- TIER 4: Harajuku Ink Lab (Tokyo)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Harajuku Ink Lab') AND lower(city.name) = lower('Tokyo') LIMIT 1), 'Aoi Yamamoto', 'Pixel', 58, 'geometric', 15, 1.5, true, 'Digital-age tattoo art. Pixel and glitch aesthetics.', 1250),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Harajuku Ink Lab') AND lower(city.name) = lower('Tokyo') LIMIT 1), 'Ren Fujita', NULL, 52, 'abstract', 13, 1.3, true, 'Avant-garde Tokyo ink with anime influences.', 980),

-- TIER 4: Hawthorne Tattoo Collective (Portland)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Hawthorne Tattoo Collective') AND lower(city.name) = lower('Portland') LIMIT 1), 'River Stone', NULL, 61, 'abstract', 16, 1.5, true, 'Portland''s eco-conscious tattoo artist. Vegan inks only.', 1300),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Hawthorne Tattoo Collective') AND lower(city.name) = lower('Portland') LIMIT 1), 'Sage Mathews', NULL, 50, 'geometric', 12, 1.3, true, 'Pacific Northwest nature-inspired geometric work.', 900),

-- TIER 4: Södermalm Tattoo Studio (Stockholm)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Södermalm Tattoo Studio') AND lower(city.name) = lower('Stockholm') LIMIT 1), 'Erik Lindqvist', 'Viking', 66, 'tribal', 17, 1.6, true, 'Norse mythology meets modern tattoo art.', 1650),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Södermalm Tattoo Studio') AND lower(city.name) = lower('Stockholm') LIMIT 1), 'Astrid Nilsson', NULL, 52, 'geometric', 13, 1.3, true, 'Scandinavian minimalist design philosophy.', 1000),

-- TIER 3: Brooklyn Needle Works (NY)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Brooklyn Needle Works') AND lower(city.name) = lower('New York') LIMIT 1), 'Tony "BK" Russo', 'BK', 42, 'tribal', 10, 1.2, false, 'Old-school Brooklyn tattooer with street cred.', 750),
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Brooklyn Needle Works') AND lower(city.name) = lower('New York') LIMIT 1), 'Zara Okafor', NULL, 30, 'geometric', 7, 1.1, false, 'Up-and-coming artist with a growing Instagram following.', 400),

-- TIER 3: Shoreditch Skin Gallery (London)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Shoreditch Skin Gallery') AND lower(city.name) = lower('London') LIMIT 1), 'Felix Gray', NULL, 45, 'abstract', 11, 1.2, false, 'Art school graduate turned tattoo artist. Bold colours.', 800),

-- TIER 3: Venice Beach Ink (LA)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Venice Beach Ink') AND lower(city.name) = lower('Los Angeles') LIMIT 1), 'Skyler James', 'Sky', 38, 'tribal', 9, 1.1, false, 'Surfer by day, tattoo artist by afternoon.', 600),

-- TIER 3: Red Light Tattoo Gallery (Amsterdam)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Red Light Tattoo Gallery') AND lower(city.name) = lower('Amsterdam') LIMIT 1), 'Pieter de Vries', NULL, 40, 'abstract', 10, 1.2, false, 'Abstract expressionism on skin.', 700),

-- TIER 3: Gothic Quarter Tattoo (Barcelona)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Gothic Quarter Tattoo') AND lower(city.name) = lower('Barcelona') LIMIT 1), 'Alejandro Ruiz', 'Alex', 35, 'tribal', 8, 1.1, false, 'Catalonian artist with Mediterranean flair.', 550),

-- TIER 3: Hongdae Street Tattoo (Seoul)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Hongdae Street Tattoo') AND lower(city.name) = lower('Seoul') LIMIT 1), 'Lee Min-jun', NULL, 43, 'abstract', 10, 1.2, false, 'K-pop inspired designs popular with young Koreans.', 780),

-- TIER 3: Coyoacán Art Tattoo (Mexico City)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Coyoacán Art Tattoo') AND lower(city.name) = lower('Mexico City') LIMIT 1), 'Diego "Catrina" Flores', 'Catrina', 44, 'skull', 11, 1.2, false, 'Day of the Dead specialist. Incredible sugar skull work.', 820),

-- TIER 3: South Congress Tattoo (Austin)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('South Congress Tattoo') AND lower(city.name) = lower('Austin') LIMIT 1), 'Jake "Lone Star" Murphy', 'Lone Star', 37, 'musical', 8, 1.1, false, 'Austin music scene regular. Guitar and amp designs.', 580),

-- TIER 3: Motor City Ink (Detroit)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Motor City Ink') AND lower(city.name) = lower('Detroit') LIMIT 1), 'Andre "Motor" Jackson', 'Motor', 40, 'skull', 9, 1.2, false, 'Detroit grit in every piece. Mechanical skull mashups.', 680),

-- TIER 3: Temple Bar Ink (Dublin)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Temple Bar Ink') AND lower(city.name) = lower('Dublin') LIMIT 1), 'Sean O''Malley', 'Celtic', 36, 'geometric', 8, 1.1, false, 'Celtic knot specialist with generations of Irish heritage.', 520),

-- TIER 3: Long Street Tattoo (Cape Town)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Long Street Tattoo') AND lower(city.name) = lower('Cape Town') LIMIT 1), 'Thabo Mokoena', NULL, 33, 'tribal', 7, 1.1, false, 'African tribal patterns with modern interpretation.', 450),

-- TIER 3: Bandra Ink Lounge (Mumbai)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Bandra Ink Lounge') AND lower(city.name) = lower('Mumbai') LIMIT 1), 'Arjun Mehta', NULL, 35, 'geometric', 8, 1.1, false, 'Bollywood stars'' secret tattoo artist.', 500),

-- TIER 3: San Telmo Tinta (Buenos Aires)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('San Telmo Tinta') AND lower(city.name) = lower('Buenos Aires') LIMIT 1), 'Mateo "Tango" Herrera', 'Tango', 38, 'portrait', 9, 1.1, false, 'Argentine passion in every portrait.', 600),

-- TIER 3: Haight-Ashbury Ink (SF)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Haight-Ashbury Ink') AND lower(city.name) = lower('San Francisco') LIMIT 1), 'Phoenix Reed', NULL, 41, 'abstract', 10, 1.2, false, 'Psychedelic art meets modern tattoo. Trippy but precise.', 720),

-- TIER 3: Northern Quarter Ink (Manchester)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Northern Quarter Ink') AND lower(city.name) = lower('Manchester') LIMIT 1), 'Tommy "Manc" Brennan', 'Manc', 39, 'skull', 9, 1.1, false, 'Oasis fan. Manchester music heritage in every piece.', 640),

-- TIER 2: East LA Tattoo Shack (LA)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('East LA Tattoo Shack') AND lower(city.name) = lower('Los Angeles') LIMIT 1), 'Jorge "Lobo" Gutierrez', 'Lobo', 22, 'text', 6, 1.0, false, 'Chicano lettering specialist. Affordable and solid.', 350),

-- TIER 2: Neukölln Needle Bar (Berlin)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Neukölln Needle Bar') AND lower(city.name) = lower('Berlin') LIMIT 1), 'Klaus Weber', NULL, 18, 'tribal', 4, 1.0, false, 'Berlin underground scene regular. Cheap but decent.', 280),

-- TIER 2: Kings Cross Tattoo (Sydney)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Kings Cross Tattoo') AND lower(city.name) = lower('Sydney') LIMIT 1), 'Bazza Thompson', 'Bazza', 20, 'skull', 5, 1.0, false, 'Late-night ink for the brave. Cash only.', 320),

-- TIER 2: East Point Tattoos (Atlanta)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('East Point Tattoos') AND lower(city.name) = lower('Atlanta') LIMIT 1), 'Marcus Brown', NULL, 16, 'text', 4, 1.0, false, 'Solid text and basic designs at fair prices.', 240),

-- TIER 2: Broadway Ink Shack (Nashville)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Broadway Ink Shack') AND lower(city.name) = lower('Nashville') LIMIT 1), 'Dusty Rhodes', NULL, 19, 'musical', 5, 1.0, false, 'Honky-tonk tattoo artist. Cheap and cheerful.', 300),

-- TIER 2: Little Havana Tattoos (Miami)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Little Havana Tattoos') AND lower(city.name) = lower('Miami') LIMIT 1), 'Ramon "Havana" Diaz', 'Havana', 21, 'tribal', 5, 1.0, false, 'Cuban flair with Caribbean colours.', 330),

-- TIER 2: Pigalle Ink House (Paris)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Pigalle Ink House') AND lower(city.name) = lower('Paris') LIMIT 1), 'Bruno Petit', NULL, 17, 'skull', 4, 1.0, false, 'Parisian edgewalker. Dark designs at budget prices.', 260),

-- TIER 2: Lagos Ink Empire
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Lagos Ink Empire') AND lower(city.name) = lower('Lagos') LIMIT 1), 'Chidi Okafor', NULL, 20, 'tribal', 5, 1.0, false, 'Nigerian tribal art pioneer.', 310),

-- TIER 2: Kingston Roots Tattoo
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Kingston Roots Tattoo') AND lower(city.name) = lower('Kingston') LIMIT 1), 'Marlon "Roots" Campbell', 'Roots', 18, 'tribal', 4, 1.0, false, 'Rastafari-inspired ink with reggae soul.', 270),

-- TIER 2: Beale Street Tattoo (Memphis)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Beale Street Tattoo') AND lower(city.name) = lower('Memphis') LIMIT 1), 'Earl "Blues" Washington', 'Blues', 23, 'musical', 6, 1.0, false, 'Blues music tattoos on the legendary Beale Street.', 360),

-- TIER 2: Copacabana Ink (Rio)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Copacabana Ink') AND lower(city.name) = lower('Rio de Janeiro') LIMIT 1), 'Rafael Santos', 'Rafa', 19, 'tribal', 5, 1.0, false, 'Brazilian tribal meets beach culture.', 290),

-- TIER 1: Bowery Basement Tattoos (NY)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Bowery Basement Tattoos') AND lower(city.name) = lower('New York') LIMIT 1), 'Nick "Needles" Petrova', 'Needles', 12, 'skull', 2, 1.0, false, 'Self-taught. What he lacks in finesse he makes up in speed.', 180),

-- TIER 1: Hackney Back Alley Ink (London)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Hackney Back Alley Ink') AND lower(city.name) = lower('London') LIMIT 1), 'Gaz "Dodgy" Smith', 'Dodgy', 8, 'text', 1, 1.0, false, 'You get what you pay for. Bring your own antiseptic.', 120),

-- TIER 1: South Side Ink (Chicago)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('South Side Ink') AND lower(city.name) = lower('Chicago') LIMIT 1), 'Eddie "Scratch" Novak', 'Scratch', 10, 'tribal', 2, 1.0, false, 'Budget ink. Results may vary. Significantly.', 150),

-- TIER 1: Raval Underground Ink (Barcelona)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Raval Underground Ink') AND lower(city.name) = lower('Barcelona') LIMIT 1), 'Paco "El Rata" Moreno', 'El Rata', 6, 'text', 0, 1.0, false, 'Basement operation. No questions asked, no refunds given.', 90),

-- TIER 1: Tepito Ink Den (Mexico City)
((SELECT tp.id FROM public.tattoo_parlours tp JOIN public.cities city ON city.id = tp.city_id WHERE lower(tp.name) = lower('Tepito Ink Den') AND lower(city.name) = lower('Mexico City') LIMIT 1), 'El Chucho', NULL, 5, 'tribal', 0, 1.0, false, 'Street-level tattoo artist. Cheap as it gets.', 70)

ON CONFLICT DO NOTHING;