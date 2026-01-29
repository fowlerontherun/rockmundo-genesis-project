-- =============================================
-- DRUMS & PERCUSSION (~15 items)
-- =============================================
INSERT INTO public.equipment_items (name, category, subcategory, price, price_cash, price_fame, rarity, description, brand, color_options, skill_boost_slug, stat_boosts, stock)
VALUES
-- Common
('Pearl Export EXX', 'drums', 'kit', 800, 800, 160, 'common', 'Best-selling drum kit with poplar shells and quality hardware.', 'Pearl', '["Jet Black", "Pure White", "Smoky Chrome"]', 'instruments_basic_drum_kit', '{"rhythm": 2, "performance": 1}', 30),
('Tama Imperialstar', 'drums', 'kit', 700, 700, 140, 'common', 'Entry-level kit with full-sized drums and Meinl cymbals included.', 'Tama', '["Hairline Black", "Candy Apple Mist", "Vintage Red"]', 'instruments_basic_drum_kit', '{"rhythm": 2, "performance": 1}', 35),
('Ludwig Accent Drive', 'drums', 'kit', 650, 650, 130, 'common', 'Affordable Ludwig quality with matching snare and complete hardware.', 'Ludwig', '["Black Cortex", "Red Sparkle", "Silver Sparkle"]', 'instruments_basic_drum_kit', '{"rhythm": 1, "performance": 1}', 40),
-- Uncommon
('Gretsch Catalina Maple', 'drums', 'kit', 1200, 1200, 240, 'uncommon', 'All-maple shells with warm vintage tone and 30-degree edges.', 'Gretsch', '["Deep Cherry Burst", "Black Gold Sparkle", "Walnut Glaze"]', 'instruments_basic_drum_kit', '{"rhythm": 3, "performance": 2}', 20),
('Pearl Decade Maple', 'drums', 'kit', 1100, 1100, 220, 'uncommon', 'Professional maple shells at intermediate pricing.', 'Pearl', '["Satin Brown Burst", "Ultramarine Blue", "Gloss Deep Red Burst"]', 'instruments_basic_drum_kit', '{"rhythm": 3, "performance": 2}', 22),
('Meinl HCS Cymbal Pack', 'drums', 'cymbals', 300, 300, 60, 'uncommon', 'Complete cymbal set for developing drummers.', 'Meinl', '["Natural Brass"]', 'instruments_basic_drum_kit', '{"rhythm": 2}', 40),
-- Rare
('Tama Starclassic Walnut/Birch', 'drums', 'kit', 2500, 2500, 500, 'rare', 'Hybrid shell kit with punchy attack and warm resonance.', 'Tama', '["Lacquer Phantasm Oyster", "Neon Orange", "Gloss Sapphire Fade"]', 'instruments_professional_drum_kit', '{"rhythm": 5, "performance": 4}', 10),
('Roland TD-27KV', 'drums', 'electronic', 3500, 3500, 700, 'rare', 'Premium V-Drums with digital hi-hat and ride cymbals.', 'Roland', '["Black"]', 'instruments_professional_drum_kit', '{"rhythm": 5, "production": 4}', 8),
('Zildjian A Custom Cymbal Pack', 'drums', 'cymbals', 1200, 1200, 240, 'rare', 'Brilliant finish A Customs for cutting live sound.', 'Zildjian', '["Brilliant"]', 'instruments_professional_drum_kit', '{"rhythm": 4, "performance": 3}', 15),
('Sabian HHX Complex Performance Set', 'drums', 'cymbals', 1800, 1800, 360, 'rare', 'Dark, complex cymbals for jazz and studio work.', 'Sabian', '["Natural"]', 'instruments_professional_drum_kit', '{"rhythm": 5, "creativity": 3}', 12),
-- Epic
('DW Performance Series', 'drums', 'kit', 3500, 3500, 700, 'epic', 'American-made maple shells with True Pitch tuning.', 'DW', '["Black Mirra", "Cherry Stain", "Tobacco Satin Oil"]', 'instruments_mastery_drum_kit', '{"rhythm": 8, "performance": 6}', 5),
('Ludwig Classic Maple', 'drums', 'kit', 3000, 3000, 600, 'epic', 'The sound of classic rock and roll with American maple shells.', 'Ludwig', '["Sky Blue Pearl", "Vintage Black Oyster", "Ruby Strata"]', 'instruments_mastery_drum_kit', '{"rhythm": 8, "performance": 5}', 6),
('Roland TD-50KV2', 'drums', 'electronic', 8000, 8000, 1600, 'epic', 'Flagship electronic kit with prismatic technology.', 'Roland', '["Black"]', 'instruments_mastery_drum_kit', '{"rhythm": 10, "production": 8}', 3),
('Meinl Byzance Vintage Pure Cymbal Set', 'drums', 'cymbals', 2500, 2500, 500, 'epic', 'Hand-hammered Turkish cymbals with dry, dark character.', 'Meinl', '["Unlathed"]', 'instruments_mastery_drum_kit', '{"rhythm": 7, "creativity": 5}', 6),
-- Legendary
('DW Collectors Series', 'drums', 'kit', 6000, 6000, 1200, 'legendary', 'Custom shop quality with hand-selected shells.', 'DW', '["Exotic Rainbow Eucalyptus", "Purple Stardust", "Peacock Oyster"]', 'instruments_mastery_drum_kit', '{"rhythm": 12, "performance": 10}', 2),
('Sonor SQ2', 'drums', 'kit', 8000, 8000, 1600, 'legendary', 'German engineering with infinite configuration options.', 'Sonor', '["Scandinavian Birch", "Solid Black", "Walnut Roots"]', 'instruments_mastery_drum_kit', '{"rhythm": 14, "performance": 10}', 1),

-- =============================================
-- WIND INSTRUMENTS (~12 items)
-- =============================================
-- Common
('Yamaha YAS-280 Alto Saxophone', 'wind', 'saxophone', 1400, 1400, 280, 'common', 'Student-friendly alto with excellent intonation and response.', 'Yamaha', '["Gold Lacquer"]', 'instruments_basic_saxophone', '{"performance": 2, "creativity": 1}', 25),
('Yamaha YFL-222 Flute', 'wind', 'flute', 700, 700, 140, 'common', 'Student flute with nickel silver body and offset G.', 'Yamaha', '["Silver"]', 'instruments_basic_flute', '{"performance": 1, "creativity": 2}', 30),
('Yamaha YCL-255 Clarinet', 'wind', 'clarinet', 600, 600, 120, 'common', 'ABS resin clarinet perfect for beginners.', 'Yamaha', '["Black"]', 'instruments_basic_clarinet', '{"performance": 1, "creativity": 1}', 35),
('Hohner Special 20 Harmonica', 'wind', 'harmonica', 50, 50, 10, 'common', 'The classic blues harp with plastic comb.', 'Hohner', '["Red", "Blue", "Black"]', 'instruments_basic_harmonica', '{"performance": 1}', 100),
-- Uncommon
('Yamaha YTS-280 Tenor Saxophone', 'wind', 'saxophone', 2200, 2200, 440, 'uncommon', 'Student tenor with balanced sound and comfortable ergonomics.', 'Yamaha', '["Gold Lacquer"]', 'instruments_basic_saxophone', '{"performance": 3, "creativity": 2}', 18),
('Jupiter JOB-1000E Oboe', 'wind', 'oboe', 2000, 2000, 400, 'uncommon', 'Composite body oboe for advanced students.', 'Jupiter', '["Black"]', 'instruments_basic_oboe', '{"performance": 3, "creativity": 2}', 12),
-- Rare
('Selmer AS42 Alto Saxophone', 'wind', 'saxophone', 3500, 3500, 700, 'rare', 'Professional features at intermediate pricing.', 'Selmer', '["Gold Lacquer", "Black Nickel"]', 'instruments_professional_saxophone', '{"performance": 6, "creativity": 4}', 10),
('Muramatsu DS Flute', 'wind', 'flute', 4000, 4000, 800, 'rare', 'Handmade Japanese flute with sterling silver headjoint.', 'Muramatsu', '["Silver"]', 'instruments_professional_flute', '{"performance": 6, "creativity": 5}', 6),
('Buffet Crampon E13 Clarinet', 'wind', 'clarinet', 2200, 2200, 440, 'rare', 'African blackwood clarinet for serious students.', 'Buffet', '["Black"]', 'instruments_professional_clarinet', '{"performance": 5, "creativity": 4}', 10),
-- Epic
('Selmer Paris Reference 54 Alto', 'wind', 'saxophone', 8000, 8000, 1600, 'epic', 'Vintage-inspired professional saxophone with legendary tone.', 'Selmer', '["Vintage Matte", "Lacquer"]', 'instruments_mastery_saxophone', '{"performance": 10, "creativity": 8}', 3),
('Buffet Crampon R13 Clarinet', 'wind', 'clarinet', 4000, 4000, 800, 'epic', 'The industry standard professional clarinet since 1955.', 'Buffet', '["Black"]', 'instruments_mastery_clarinet', '{"performance": 9, "creativity": 7}', 5),
('Powell Handmade Flute', 'wind', 'flute', 12000, 12000, 2400, 'epic', 'Boston-made sterling silver flute with hand-cut embouchure.', 'Powell', '["Silver"]', 'instruments_mastery_flute', '{"performance": 12, "creativity": 9}', 2),

-- =============================================
-- BRASS INSTRUMENTS (~10 items)
-- =============================================
-- Common
('Yamaha YTR-2330 Trumpet', 'brass', 'trumpet', 600, 600, 120, 'common', 'Standard student trumpet with yellow brass bell.', 'Yamaha', '["Gold Lacquer", "Silver"]', 'instruments_basic_trumpet', '{"performance": 1, "creativity": 1}', 35),
('King 606 Trombone', 'brass', 'trombone', 700, 700, 140, 'common', 'Student trombone with nickel silver slide.', 'King', '["Gold Lacquer"]', 'instruments_basic_trombone', '{"performance": 1, "creativity": 1}', 30),
('Yamaha YBB-105 Tuba', 'brass', 'tuba', 3500, 3500, 700, 'common', 'Compact 3/4 size BBb tuba for young players.', 'Yamaha', '["Gold Lacquer"]', 'instruments_basic_tuba', '{"performance": 2}', 15),
-- Uncommon
('Yamaha YFH-631G Flugelhorn', 'brass', 'flugelhorn', 2200, 2200, 440, 'uncommon', 'Professional flugelhorn with dark, mellow tone.', 'Yamaha', '["Gold Lacquer"]', 'instruments_basic_flugelhorn', '{"performance": 3, "creativity": 3}', 12),
('Conn 8D French Horn', 'brass', 'french_horn', 4500, 4500, 900, 'uncommon', 'The most recorded double horn in history.', 'Conn', '["Lacquer", "Raw Brass"]', 'instruments_basic_french_horn', '{"performance": 4, "creativity": 3}', 8),
-- Rare
('Bach 180S37 Stradivarius Trumpet', 'brass', 'trumpet', 3500, 3500, 700, 'rare', 'The professional standard with #37 bell.', 'Bach', '["Silver Plated"]', 'instruments_professional_trumpet', '{"performance": 6, "creativity": 5}', 10),
('Bach 42BO Stradivarius Trombone', 'brass', 'trombone', 4000, 4000, 800, 'rare', 'Open wrap F-attachment professional trombone.', 'Bach', '["Gold Lacquer", "Silver"]', 'instruments_professional_trombone', '{"performance": 6, "creativity": 4}', 8),
-- Epic
('Yamaha YTR-9335CHS Xeno Trumpet', 'brass', 'trumpet', 4500, 4500, 900, 'epic', 'Top-tier Xeno with reversed leadpipe and hand-hammered bell.', 'Yamaha', '["Silver Plated"]', 'instruments_mastery_trumpet', '{"performance": 10, "creativity": 7}', 4),
('Alexander 103 French Horn', 'brass', 'french_horn', 8000, 8000, 1600, 'epic', 'The legendary Mainz horn with dark German sound.', 'Alexander', '["Yellow Brass"]', 'instruments_mastery_french_horn', '{"performance": 11, "creativity": 8}', 3),
-- Legendary
('Monette PRANA Trumpet', 'brass', 'trumpet', 12000, 12000, 2400, 'legendary', 'Handmade innovation with constant pitch center technology.', 'Monette', '["Raw Brass", "Black"]', 'instruments_mastery_trumpet', '{"performance": 14, "creativity": 10}', 1),

-- =============================================
-- DJ & ELECTRONIC EQUIPMENT (~10 items)
-- =============================================
-- Common
('Numark Mixtrack Pro FX', 'dj', 'controller', 350, 350, 70, 'common', 'All-in-one DJ controller with built-in effects paddles.', 'Numark', '["Black"]', 'instruments_basic_turntablism', '{"creativity": 2, "production": 1}', 40),
('Pioneer DDJ-200', 'dj', 'controller', 150, 150, 30, 'common', 'Smartphone-compatible controller for DJ beginners.', 'Pioneer DJ', '["Black"]', 'instruments_basic_turntablism', '{"creativity": 1}', 60),
('Audio-Technica AT-LP120XUSB', 'dj', 'turntable', 250, 250, 50, 'common', 'Direct-drive turntable with USB output for vinyl digitization.', 'Audio-Technica', '["Black", "Silver"]', 'instruments_basic_turntablism', '{"creativity": 2, "production": 1}', 35),
-- Uncommon
('Pioneer DDJ-400', 'dj', 'controller', 300, 300, 60, 'uncommon', 'Rekordbox controller with professional layout.', 'Pioneer DJ', '["Black"]', 'instruments_basic_turntablism', '{"creativity": 3, "production": 2}', 30),
('Native Instruments Traktor Kontrol S2', 'dj', 'controller', 400, 400, 80, 'uncommon', 'Compact Traktor controller with high-quality jog wheels.', 'Native Instruments', '["Black"]', 'instruments_basic_turntablism', '{"creativity": 3, "production": 3}', 25),
-- Rare
('Pioneer DDJ-1000', 'dj', 'controller', 1200, 1200, 240, 'rare', 'Club-style controller with full-size jog wheels.', 'Pioneer DJ', '["Black"]', 'instruments_professional_turntablism', '{"creativity": 5, "production": 5}', 15),
('Rane Twelve MKII', 'dj', 'controller', 800, 800, 160, 'rare', 'Motorized turntable controller for the vinyl feel.', 'Rane', '["Black"]', 'instruments_professional_turntablism', '{"creativity": 5, "production": 4}', 12),
-- Epic
('Technics SL-1200MK7', 'dj', 'turntable', 1100, 1100, 220, 'epic', 'The legendary turntable reborn with coreless motor.', 'Technics', '["Black", "Silver"]', 'instruments_mastery_turntablism', '{"creativity": 8, "production": 6}', 6),
('Pioneer CDJ-2000NXS2', 'dj', 'cdj', 2400, 2400, 480, 'epic', 'Industry standard club media player.', 'Pioneer DJ', '["Black"]', 'instruments_mastery_turntablism', '{"creativity": 9, "production": 8}', 4),
-- Legendary
('Pioneer CDJ-3000', 'dj', 'cdj', 2600, 2600, 520, 'legendary', 'Next-generation flagship with 9-inch touchscreen.', 'Pioneer DJ', '["Black"]', 'instruments_mastery_turntablism', '{"creativity": 12, "production": 10}', 2),
('Allen and Heath Xone:96', 'dj', 'mixer', 2800, 2800, 560, 'legendary', 'Analog DJ mixer with dual filters and USB audio.', 'Allen and Heath', '["Black"]', 'instruments_mastery_turntablism', '{"creativity": 10, "production": 12}', 3),

-- =============================================
-- MICROPHONES (Expand existing ~8 items)
-- =============================================
-- Common
('Shure SM58', 'microphone', 'dynamic', 100, 100, 20, 'common', 'The legendary vocal mic that has defined live sound.', 'Shure', '["Black"]', NULL, '{"performance": 2}', 80),
('Audio-Technica AT2020', 'microphone', 'condenser', 100, 100, 20, 'common', 'Entry-level large diaphragm condenser for home studios.', 'Audio-Technica', '["Black"]', NULL, '{"production": 2}', 70),
('Sennheiser e835', 'microphone', 'dynamic', 100, 100, 20, 'common', 'Robust vocal mic with enhanced clarity.', 'Sennheiser', '["Black"]', NULL, '{"performance": 2}', 65),
-- Uncommon
('Shure SM7B', 'microphone', 'dynamic', 400, 400, 80, 'uncommon', 'Broadcast and vocal recording legend.', 'Shure', '["Black"]', NULL, '{"production": 4, "performance": 2}', 30),
('Rode NT1-A', 'microphone', 'condenser', 230, 230, 45, 'uncommon', 'Ultra-quiet studio condenser with warm character.', 'Rode', '["Nickel"]', NULL, '{"production": 3}', 35),
-- Rare
('Neumann TLM 103', 'microphone', 'condenser', 1100, 1100, 220, 'rare', 'Large diaphragm condenser with classic Neumann sound.', 'Neumann', '["Nickel", "Black"]', NULL, '{"production": 6, "performance": 3}', 15),
('AKG C414 XLII', 'microphone', 'condenser', 1100, 1100, 220, 'rare', 'Multi-pattern condenser with legendary flexibility.', 'AKG', '["Black Gold"]', NULL, '{"production": 6, "creativity": 3}', 12),
-- Epic
('Neumann U87 Ai', 'microphone', 'condenser', 3600, 3600, 720, 'epic', 'The most recognized studio microphone in the world.', 'Neumann', '["Nickel", "Black"]', NULL, '{"production": 10, "performance": 5}', 4),
('Shure KSM44A', 'microphone', 'condenser', 1100, 1100, 220, 'epic', 'Premium dual-diaphragm with three polar patterns.', 'Shure', '["Champagne"]', NULL, '{"production": 8, "creativity": 4}', 6),
-- Legendary
('Neumann M 149 Tube', 'microphone', 'condenser', 6000, 6000, 1200, 'legendary', 'Tube microphone masterpiece with nine polar patterns.', 'Neumann', '["Nickel"]', NULL, '{"production": 14, "creativity": 8}', 2),

-- =============================================
-- AUDIO INTERFACES & STUDIO GEAR (~8 items)
-- =============================================
-- Common
('Focusrite Scarlett 2i2', 'audio', 'interface', 170, 170, 35, 'common', 'Best-selling 2-in/2-out USB interface.', 'Focusrite', '["Red"]', NULL, '{"production": 2}', 60),
('PreSonus AudioBox USB 96', 'audio', 'interface', 100, 100, 20, 'common', 'Simple bus-powered recording interface.', 'PreSonus', '["Black Blue"]', NULL, '{"production": 1}', 70),
('Behringer UMC202HD', 'audio', 'interface', 70, 70, 15, 'common', 'Budget interface with Midas preamps.', 'Behringer', '["Black"]', NULL, '{"production": 1}', 80),
-- Uncommon
('Focusrite Scarlett 18i8', 'audio', 'interface', 450, 450, 90, 'uncommon', 'Expandable interface with 4 preamps and ADAT.', 'Focusrite', '["Red"]', NULL, '{"production": 4}', 25),
('MOTU M4', 'audio', 'interface', 250, 250, 50, 'uncommon', 'ESS Sabre DAC with metering display.', 'MOTU', '["Black"]', NULL, '{"production": 3}', 30),
-- Rare
('Universal Audio Apollo Twin X', 'audio', 'interface', 1300, 1300, 260, 'rare', 'Premium interface with UAD processing.', 'Universal Audio', '["Silver"]', NULL, '{"production": 6, "creativity": 4}', 12),
('RME Babyface Pro FS', 'audio', 'interface', 900, 900, 180, 'rare', 'Portable interface with reference-class converters.', 'RME', '["Black Silver"]', NULL, '{"production": 6}', 10),
-- Epic
('Universal Audio Apollo x8', 'audio', 'interface', 3500, 3500, 700, 'epic', 'Thunderbolt interface with 8 Unison preamps.', 'Universal Audio', '["Black"]', NULL, '{"production": 10, "creativity": 6}', 4),
-- Legendary
('Apogee Symphony Desktop', 'audio', 'interface', 1300, 1300, 260, 'legendary', 'Symphony-quality conversion in a desktop format.', 'Apogee', '["Black"]', NULL, '{"production": 12, "creativity": 5}', 3)