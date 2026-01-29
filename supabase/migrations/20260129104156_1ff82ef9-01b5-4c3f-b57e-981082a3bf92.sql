-- Add brand, color, and currency support to equipment_items
ALTER TABLE public.equipment_items 
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS brand_logo_url text,
ADD COLUMN IF NOT EXISTS color_options jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS skill_boost_slug text,
ADD COLUMN IF NOT EXISTS price_cash integer,
ADD COLUMN IF NOT EXISTS price_fame integer DEFAULT 0;

-- Backfill price_cash from price for existing items
UPDATE public.equipment_items SET price_cash = price WHERE price_cash IS NULL;

-- =============================================
-- ELECTRIC GUITARS (~20 items)
-- =============================================
INSERT INTO public.equipment_items (name, category, subcategory, price, price_cash, price_fame, rarity, description, brand, color_options, skill_boost_slug, stat_boosts, stock)
VALUES
-- Common
('Squier Affinity Stratocaster', 'guitar', 'electric', 250, 250, 50, 'common', 'The perfect beginner electric guitar with classic Stratocaster styling and versatile tone.', 'Squier', '["Jet Black", "Arctic White", "Vintage Sunburst"]', 'instruments_basic_electric_guitar', '{"performance": 1, "creativity": 1}', 50),
('Epiphone Les Paul Special II', 'guitar', 'electric', 180, 180, 35, 'common', 'Budget-friendly Les Paul with warm humbuckers and solid build quality.', 'Epiphone', '["Ebony", "Vintage Sunburst"]', 'instruments_basic_electric_guitar', '{"performance": 1}', 60),
('Yamaha Pacifica 012', 'guitar', 'electric', 200, 200, 40, 'common', 'Reliable beginner guitar with excellent playability and HSS pickup configuration.', 'Yamaha', '["Black", "Red Metallic", "Natural Satin"]', 'instruments_basic_electric_guitar', '{"performance": 1, "creativity": 1}', 55),
-- Uncommon
('Epiphone Les Paul Standard', 'guitar', 'electric', 450, 450, 90, 'uncommon', 'Classic Les Paul tone with ProBucker pickups and premium finishes.', 'Epiphone', '["Heritage Cherry Sunburst", "Ebony", "Honeyburst"]', 'instruments_basic_electric_guitar', '{"performance": 2, "creativity": 1}', 35),
('Squier Classic Vibe 60s Stratocaster', 'guitar', 'electric', 430, 430, 85, 'uncommon', 'Vintage-inspired Strat with alnico pickups and period-correct appointments.', 'Squier', '["Lake Placid Blue", "Candy Apple Red", "Olympic White"]', 'instruments_basic_electric_guitar', '{"performance": 2, "creativity": 2}', 30),
('Ibanez GRG170DX', 'guitar', 'electric', 350, 350, 70, 'uncommon', 'Fast-playing metal machine with Infinity pickups and Edge-Zero II tremolo.', 'Ibanez', '["Black Night", "Jewel Blue"]', 'instruments_basic_electric_guitar', '{"performance": 2}', 40),
-- Rare
('Fender Player Stratocaster', 'guitar', 'electric', 850, 850, 170, 'rare', 'Mexican-made Strat with alnico V pickups and modern C-shaped neck.', 'Fender', '["3-Color Sunburst", "Polar White", "Tidepool Blue", "Buttercream"]', 'instruments_professional_electric_guitar', '{"performance": 4, "creativity": 3}', 20),
('Gibson SG Standard', 'guitar', 'electric', 1600, 1600, 320, 'rare', 'Lightweight rock machine with 490R/490T humbuckers and slim taper neck.', 'Gibson', '["Heritage Cherry", "Ebony", "TV Yellow"]', 'instruments_professional_electric_guitar', '{"performance": 5, "creativity": 3}', 15),
('PRS SE Custom 24', 'guitar', 'electric', 900, 900, 180, 'rare', 'Versatile workhorse with 85/15 S pickups and tremolo system.', 'PRS', '["Charcoal Burst", "Faded Blue Burst", "Black Gold Burst"]', 'instruments_professional_electric_guitar', '{"performance": 4, "creativity": 4}', 18),
('Ibanez RG550', 'guitar', 'electric', 1000, 1000, 200, 'rare', 'Shred legend reborn with Edge tremolo and V7/V8 pickups.', 'Ibanez', '["Road Flare Red", "Desert Sun Yellow", "Purple Neon"]', 'instruments_professional_electric_guitar', '{"performance": 5, "creativity": 2}', 12),
('Jackson Pro Series Soloist SL2', 'guitar', 'electric', 1100, 1100, 220, 'rare', 'Metal specialist with Seymour Duncan pickups and compound radius fretboard.', 'Jackson', '["Metallic Black", "Snow White", "Deep Purple"]', 'instruments_professional_electric_guitar', '{"performance": 5, "creativity": 2}', 10),
('Gretsch G5420T Electromatic', 'guitar', 'electric', 950, 950, 190, 'rare', 'Hollow body beauty with Black Top Filter Tron pickups and Bigsby tremolo.', 'Gretsch', '["Orange Stain", "Fairlane Blue", "Black"]', 'instruments_professional_electric_guitar', '{"performance": 4, "creativity": 4}', 14),
-- Epic
('Fender American Professional II Stratocaster', 'guitar', 'electric', 1800, 1800, 360, 'epic', 'Top-tier American Strat with V-Mod II pickups and Deep C neck.', 'Fender', '["3-Color Sunburst", "Miami Blue", "Dark Night", "Olympic White"]', 'instruments_mastery_electric_guitar', '{"performance": 7, "creativity": 5}', 8),
('Gibson Les Paul Standard 50s', 'guitar', 'electric', 2700, 2700, 540, 'epic', 'Classic burst-era specs with Burstbucker pickups and vintage wiring.', 'Gibson', '["Heritage Cherry Sunburst", "Gold Top", "Tobacco Burst"]', 'instruments_mastery_electric_guitar', '{"performance": 8, "creativity": 5}', 6),
('PRS Custom 24', 'guitar', 'electric', 4200, 4200, 840, 'epic', 'The definitive PRS with Pattern Regular neck and 85/15 pickups.', 'PRS', '["Aquamarine", "McCarty Sunburst", "Violet Blue Burst"]', 'instruments_mastery_electric_guitar', '{"performance": 8, "creativity": 6}', 5),
('Music Man JP15', 'guitar', 'electric', 3200, 3200, 640, 'epic', 'John Petrucci signature with DiMarzio Illuminator pickups and piezo system.', 'Music Man', '["Sahara Burst", "Purple Nebula", "Cerulean Paradise"]', 'instruments_mastery_electric_guitar', '{"performance": 9, "creativity": 5}', 4),
('ESP E-II Eclipse', 'guitar', 'electric', 2400, 2400, 480, 'epic', 'Japanese-made single-cut with EMG pickups and set-thru construction.', 'ESP', '["Black Satin", "Tobacco Sunburst", "Reindeer Blue"]', 'instruments_mastery_electric_guitar', '{"performance": 8, "creativity": 4}', 7),
-- Legendary
('Gibson Custom Shop 1959 Les Paul Standard', 'guitar', 'electric', 6500, 6500, 1300, 'legendary', 'Holy grail reissue with hand-selected tonewoods and Custombuckers.', 'Gibson', '["Aged Cherry Sunburst", "Lemon Burst", "Iced Tea Burst"]', 'instruments_mastery_electric_guitar', '{"performance": 12, "creativity": 8}', 2),
('Fender Custom Shop Stratocaster Relic', 'guitar', 'electric', 5500, 5500, 1100, 'legendary', 'Hand-built masterpiece with authentic aging and vintage-spec pickups.', 'Fender', '["Faded Sonic Blue", "Aged Olympic White", "Fiesta Red"]', 'instruments_mastery_electric_guitar', '{"performance": 11, "creativity": 9}', 2),
('PRS Private Stock McCarty 594', 'guitar', 'electric', 8500, 8500, 1700, 'legendary', 'Ultimate luxury with exotic woods and hand-wound pickups.', 'PRS', '["Dragons Breath", "Northern Lights", "Frostbite Glow"]', 'instruments_mastery_electric_guitar', '{"performance": 13, "creativity": 10}', 1),

-- =============================================
-- ACOUSTIC GUITARS (~10 items)
-- =============================================
-- Common
('Yamaha FG800', 'guitar', 'acoustic', 200, 200, 40, 'common', 'Best-selling dreadnought with solid spruce top and nato back/sides.', 'Yamaha', '["Natural", "Sunset Blue", "Sand Burst"]', 'instruments_basic_acoustic_guitar', '{"performance": 1, "creativity": 2}', 60),
('Fender CD-60S', 'guitar', 'acoustic', 230, 230, 45, 'common', 'Solid mahogany top dreadnought with easy-play rolled fretboard edges.', 'Fender', '["Natural", "Black", "Sunburst"]', 'instruments_basic_acoustic_guitar', '{"performance": 1, "creativity": 1}', 55),
('Epiphone DR-100', 'guitar', 'acoustic', 150, 150, 30, 'common', 'Budget-friendly dreadnought with select spruce top.', 'Epiphone', '["Natural", "Vintage Sunburst", "Ebony"]', 'instruments_basic_acoustic_guitar', '{"performance": 1}', 70),
-- Uncommon
('Taylor 110e', 'guitar', 'acoustic', 800, 800, 160, 'uncommon', 'Solid Sitka spruce top with Expression System 2 electronics.', 'Taylor', '["Natural", "Sunburst"]', 'instruments_basic_acoustic_guitar', '{"performance": 3, "creativity": 2}', 25),
('Yamaha LL6 ARE', 'guitar', 'acoustic', 700, 700, 140, 'uncommon', 'Handcrafted with A.R.E. treated spruce top for aged tone.', 'Yamaha', '["Natural", "Brown Sunburst"]', 'instruments_basic_acoustic_guitar', '{"performance": 3, "creativity": 3}', 28),
-- Rare
('Martin D-15M', 'guitar', 'acoustic', 1400, 1400, 280, 'rare', 'All-solid mahogany with warm, woody tone and satin finish.', 'Martin', '["Natural Mahogany", "Burst"]', 'instruments_professional_acoustic_guitar', '{"performance": 5, "creativity": 4}', 15),
('Taylor 314ce', 'guitar', 'acoustic', 1900, 1900, 380, 'rare', 'Grand Auditorium with solid sapele and Sitka spruce.', 'Taylor', '["Natural", "Sunburst"]', 'instruments_professional_acoustic_guitar', '{"performance": 6, "creativity": 5}', 12),
('Gibson J-15', 'guitar', 'acoustic', 1500, 1500, 300, 'rare', 'Round-shoulder dreadnought with walnut back and sides.', 'Gibson', '["Antique Natural", "Walnut Burst"]', 'instruments_professional_acoustic_guitar', '{"performance": 5, "creativity": 5}', 14),
-- Epic
('Martin D-28', 'guitar', 'acoustic', 3300, 3300, 660, 'epic', 'The legendary dreadnought that defined the sound of acoustic music.', 'Martin', '["Natural", "Sunburst", "Ambertone"]', 'instruments_mastery_acoustic_guitar', '{"performance": 9, "creativity": 7}', 6),
('Gibson J-45 Standard', 'guitar', 'acoustic', 2700, 2700, 540, 'epic', 'The workhorse of the Gibson line with slope-shoulder dreadnought body.', 'Gibson', '["Vintage Sunburst", "Ebony", "Cherry"]', 'instruments_mastery_acoustic_guitar', '{"performance": 8, "creativity": 8}', 7),
('Taylor 814ce', 'guitar', 'acoustic', 4000, 4000, 800, 'epic', 'Premium Grand Auditorium with Indian rosewood and Sitka spruce.', 'Taylor', '["Natural"]', 'instruments_mastery_acoustic_guitar', '{"performance": 10, "creativity": 8}', 5),
-- Legendary
('Martin D-45', 'guitar', 'acoustic', 10000, 10000, 2000, 'legendary', 'The pinnacle of acoustic guitars with abalone inlays and premium woods.', 'Martin', '["Natural"]', 'instruments_mastery_acoustic_guitar', '{"performance": 14, "creativity": 12}', 2),
('Gibson Hummingbird Original', 'guitar', 'acoustic', 4500, 4500, 900, 'legendary', 'Iconic square-shoulder with hand-painted pickguard and classic tone.', 'Gibson', '["Heritage Cherry Sunburst", "Natural"]', 'instruments_mastery_acoustic_guitar', '{"performance": 12, "creativity": 10}', 3),

-- =============================================
-- BASS GUITARS (~10 items)
-- =============================================
-- Common
('Squier Affinity Precision Bass', 'guitar', 'bass', 250, 250, 50, 'common', 'Classic P-Bass tone in an affordable package.', 'Squier', '["Black", "Olympic White", "Surf Green"]', 'instruments_basic_bass_guitar', '{"performance": 1, "rhythm": 2}', 45),
('Ibanez GSR200', 'guitar', 'bass', 230, 230, 45, 'common', 'Lightweight bass with fast neck and active EQ.', 'Ibanez', '["Jewel Blue", "Black", "Pearl White"]', 'instruments_basic_bass_guitar', '{"performance": 1, "rhythm": 1}', 50),
('Yamaha TRBX174', 'guitar', 'bass', 200, 200, 40, 'common', 'Versatile beginner bass with dual pickups and solid construction.', 'Yamaha', '["Black", "Vintage Sunburst", "Red Metallic"]', 'instruments_basic_bass_guitar', '{"performance": 1, "rhythm": 1}', 55),
-- Uncommon
('Squier Classic Vibe 60s Jazz Bass', 'guitar', 'bass', 450, 450, 90, 'uncommon', 'Vintage-inspired J-Bass with alnico pickups.', 'Squier', '["3-Color Sunburst", "Lake Placid Blue", "Black"]', 'instruments_basic_bass_guitar', '{"performance": 2, "rhythm": 2}', 30),
('Epiphone Thunderbird', 'guitar', 'bass', 400, 400, 80, 'uncommon', 'Iconic reverse-body design with thundering humbuckers.', 'Epiphone', '["Vintage Sunburst", "Ebony"]', 'instruments_basic_bass_guitar', '{"performance": 2, "rhythm": 3}', 28),
-- Rare
('Fender Player Jazz Bass', 'guitar', 'bass', 900, 900, 180, 'rare', 'Mexican-made J-Bass with classic tone and modern playability.', 'Fender', '["3-Color Sunburst", "Polar White", "Tidepool"]', 'instruments_professional_bass_guitar', '{"performance": 4, "rhythm": 4}', 18),
('Fender Player Precision Bass', 'guitar', 'bass', 850, 850, 170, 'rare', 'The foundational bass sound with split-coil pickup.', 'Fender', '["Buttercream", "Black", "3-Color Sunburst"]', 'instruments_professional_bass_guitar', '{"performance": 4, "rhythm": 5}', 16),
('Rickenbacker 4003', 'guitar', 'bass', 2200, 2200, 440, 'rare', 'Iconic progressive rock bass with signature jangle.', 'Rickenbacker', '["Jetglo", "Fireglo", "Mapleglo"]', 'instruments_professional_bass_guitar', '{"performance": 5, "creativity": 4}', 8),
-- Epic
('Music Man StingRay Special', 'guitar', 'bass', 2400, 2400, 480, 'epic', 'Active humbucker beast with neodymium pickup and 18V preamp.', 'Music Man', '["Vintage Sunburst", "HD Ghost Opal", "Jet Black"]', 'instruments_mastery_bass_guitar', '{"performance": 8, "rhythm": 7}', 6),
('Fender American Ultra Jazz Bass', 'guitar', 'bass', 2200, 2200, 440, 'epic', 'Top-tier J-Bass with Ultra Noiseless pickups and Modern D neck.', 'Fender', '["Ultraburst", "Arctic Pearl", "Mocha Burst"]', 'instruments_mastery_bass_guitar', '{"performance": 8, "rhythm": 6}', 7),
-- Legendary
('Warwick Thumb NT', 'guitar', 'bass', 5000, 5000, 1000, 'legendary', 'German craftsmanship with bubinga body and MEC electronics.', 'Warwick', '["Natural Oil", "Antique Tobacco Oil"]', 'instruments_mastery_bass_guitar', '{"performance": 12, "rhythm": 10}', 2),
('Fodera Emperor Standard', 'guitar', 'bass', 7500, 7500, 1500, 'legendary', 'Boutique excellence with exotic woods and custom electronics.', 'Fodera', '["Natural", "Trans Blue"]', 'instruments_mastery_bass_guitar', '{"performance": 14, "rhythm": 11}', 1),

-- =============================================
-- KEYBOARDS & SYNTHS (~15 items)
-- =============================================
-- Common
('Casio CT-S300', 'keyboard', 'synth', 150, 150, 30, 'common', 'Portable keyboard with 61 touch-sensitive keys and dance music mode.', 'Casio', '["Black"]', 'instruments_basic_classical_piano', '{"performance": 1, "creativity": 1}', 60),
('Yamaha PSR-E373', 'keyboard', 'synth', 200, 200, 40, 'common', '61-key portable keyboard with 622 instrument voices.', 'Yamaha', '["Black"]', 'instruments_basic_classical_piano', '{"performance": 1, "creativity": 2}', 55),
('Alesis Melody 61', 'keyboard', 'synth', 130, 130, 25, 'common', 'All-in-one keyboard package with built-in speakers.', 'Alesis', '["Black"]', 'instruments_basic_classical_piano', '{"performance": 1}', 65),
-- Uncommon
('Roland Juno-DS61', 'keyboard', 'synth', 700, 700, 140, 'uncommon', 'Performance synth with iconic Juno sounds and lightweight design.', 'Roland', '["Black"]', 'instruments_basic_classical_piano', '{"performance": 3, "creativity": 4}', 25),
('Korg Kross 2-61', 'keyboard', 'synth', 800, 800, 160, 'uncommon', 'Workstation keyboard with sampling and editing capabilities.', 'Korg', '["Black", "Gray Blue"]', 'instruments_basic_classical_piano', '{"performance": 3, "creativity": 3}', 22),
('Arturia KeyLab Essential 61', 'keyboard', 'controller', 280, 280, 55, 'uncommon', 'DAW controller with Analog Lab integration and 61 keys.', 'Arturia', '["Black", "White"]', 'instruments_basic_ableton_push', '{"creativity": 4, "production": 3}', 30),
-- Rare
('Korg Minilogue XD', 'keyboard', 'synth', 650, 650, 130, 'rare', 'Polyphonic analog synth with digital multi-engine.', 'Korg', '["Black"]', 'instruments_professional_synth_programmer', '{"creativity": 5, "production": 4}', 18),
('Roland JUNO-X', 'keyboard', 'synth', 1800, 1800, 360, 'rare', 'Modern JUNO with ZEN-Core engine and classic sound modeling.', 'Roland', '["Black"]', 'instruments_professional_rhodes_wurlitzer', '{"performance": 5, "creativity": 5}', 12),
('Yamaha CP88', 'keyboard', 'stage_piano', 2500, 2500, 500, 'rare', 'Premium stage piano with authentic acoustic and electric pianos.', 'Yamaha', '["Black"]', 'instruments_professional_classical_piano', '{"performance": 6, "creativity": 4}', 10),
-- Epic
('Nord Electro 6D 61', 'keyboard', 'stage_piano', 2800, 2800, 560, 'epic', 'Legendary Nord organ/piano with seamless layer splits.', 'Nord', '["Red"]', 'instruments_mastery_rhodes_wurlitzer', '{"performance": 8, "creativity": 7}', 6),
('Moog Subsequent 37', 'keyboard', 'synth', 1800, 1800, 360, 'epic', 'Paraphonic analog synth with iconic Moog ladder filter.', 'Moog', '["Black"]', 'instruments_mastery_synth_programmer', '{"creativity": 9, "production": 6}', 7),
('Sequential Prophet-6', 'keyboard', 'synth', 3200, 3200, 640, 'epic', 'True analog polyphonic synth from legendary Dave Smith.', 'Sequential', '["Black"]', 'instruments_mastery_synth_programmer', '{"creativity": 10, "production": 7}', 5),
('Kawai MP11SE', 'keyboard', 'stage_piano', 3500, 3500, 700, 'epic', 'Concert-grade stage piano with wooden key action.', 'Kawai', '["Black"]', 'instruments_mastery_classical_piano', '{"performance": 10, "creativity": 5}', 4),
-- Legendary
('Nord Stage 4 88', 'keyboard', 'stage_piano', 5500, 5500, 1100, 'legendary', 'The ultimate stage keyboard with piano, organ, and synth engines.', 'Nord', '["Red"]', 'instruments_mastery_rhodes_wurlitzer', '{"performance": 13, "creativity": 10}', 2),
('Moog One 16-Voice', 'keyboard', 'synth', 9000, 9000, 1800, 'legendary', 'Flagship tri-timbral polyphonic analog synthesizer.', 'Moog', '["Black"]', 'instruments_mastery_synth_programmer', '{"creativity": 15, "production": 12}', 1),
('Yamaha CFX Concert Grand Sample', 'keyboard', 'stage_piano', 7500, 7500, 1500, 'legendary', 'Full 9-foot concert grand sampling with 88 weighted keys.', 'Yamaha', '["Black"]', 'instruments_mastery_classical_piano', '{"performance": 14, "creativity": 8}', 2)