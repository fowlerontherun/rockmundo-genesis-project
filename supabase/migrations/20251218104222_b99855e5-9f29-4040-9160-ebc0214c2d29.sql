-- Seed hundreds of real gear items into equipment_catalog
-- GUITARS - Electric
INSERT INTO public.equipment_catalog (name, category, subcategory, brand, model, description, base_price, quality_rating, rarity, stat_boosts) VALUES
-- Fender Guitars
('Stratocaster American Professional II', 'instrument', 'electric_guitar', 'Fender', 'American Pro II', 'The definitive Strat with V-Mod II pickups and Deep C neck profile', 1699.00, 88, 'rare', '{"tone": 15, "versatility": 20}'),
('Stratocaster Player Plus', 'instrument', 'electric_guitar', 'Fender', 'Player Plus', 'Modern features with noiseless pickups and locking tuners', 1149.00, 82, 'uncommon', '{"tone": 12, "versatility": 18}'),
('Telecaster American Ultra', 'instrument', 'electric_guitar', 'Fender', 'American Ultra', 'Ultimate Tele with compound radius fingerboard', 2099.00, 92, 'epic', '{"tone": 18, "attack": 15}'),
('Jazzmaster American Vintage II 1966', 'instrument', 'electric_guitar', 'Fender', 'AV II 66', 'Authentic vintage spec with pure vintage pickups', 2199.00, 90, 'epic', '{"tone": 16, "character": 20}'),
('Jaguar Player', 'instrument', 'electric_guitar', 'Fender', 'Player', 'Offset icon with classic tremolo system', 849.00, 75, 'uncommon', '{"tone": 10, "character": 15}'),
-- Gibson Guitars
('Les Paul Standard 50s', 'instrument', 'electric_guitar', 'Gibson', 'Standard 50s', 'Classic figured maple top with Burstbucker pickups', 2699.00, 94, 'epic', '{"tone": 20, "sustain": 18}'),
('Les Paul Custom', 'instrument', 'electric_guitar', 'Gibson', 'Custom', 'The tuxedo Les Paul with ebony fingerboard', 4999.00, 98, 'legendary', '{"tone": 25, "sustain": 22, "prestige": 15}'),
('SG Standard', 'instrument', 'electric_guitar', 'Gibson', 'Standard', 'Lightweight classic with 490R/490T humbuckers', 1799.00, 86, 'rare', '{"tone": 14, "playability": 16}'),
('ES-335', 'instrument', 'electric_guitar', 'Gibson', 'ES-335', 'Semi-hollow perfection for blues and jazz', 3499.00, 95, 'legendary', '{"tone": 22, "warmth": 20}'),
('Flying V', 'instrument', 'electric_guitar', 'Gibson', 'Flying V', 'Iconic V shape with aggressive tone', 1999.00, 85, 'rare', '{"tone": 14, "stage_presence": 18}'),
('Explorer', 'instrument', 'electric_guitar', 'Gibson', 'Explorer', 'Angular design with massive tone', 1899.00, 84, 'rare', '{"tone": 15, "stage_presence": 16}'),
-- PRS Guitars
('Custom 24', 'instrument', 'electric_guitar', 'PRS', 'Custom 24', 'The ultimate do-it-all guitar with Pattern neck', 3999.00, 96, 'legendary', '{"tone": 22, "versatility": 25}'),
('McCarty 594', 'instrument', 'electric_guitar', 'PRS', 'McCarty 594', 'Vintage-inspired with 58/15 LT pickups', 4299.00, 97, 'legendary', '{"tone": 24, "warmth": 18}'),
('Silver Sky', 'instrument', 'electric_guitar', 'PRS', 'Silver Sky', 'John Mayer signature with vintage vibes', 2499.00, 92, 'epic', '{"tone": 18, "clarity": 20}'),
('CE 24', 'instrument', 'electric_guitar', 'PRS', 'CE 24', 'Bolt-on snap with Pattern Thin neck', 2149.00, 88, 'rare', '{"tone": 15, "attack": 16}'),
('S2 Standard 24', 'instrument', 'electric_guitar', 'PRS', 'S2 Standard', 'Affordable PRS quality with 85/15 S pickups', 1599.00, 82, 'uncommon', '{"tone": 12, "versatility": 14}'),
-- Ibanez Guitars
('RG550', 'instrument', 'electric_guitar', 'Ibanez', 'RG550', 'Shred machine with Edge tremolo', 999.00, 80, 'uncommon', '{"speed": 18, "precision": 15}'),
('JEM7V', 'instrument', 'electric_guitar', 'Ibanez', 'JEM7V', 'Steve Vai signature with Lion''s Claw tremolo', 3999.00, 95, 'legendary', '{"speed": 25, "technique": 22}'),
('AZ2204', 'instrument', 'electric_guitar', 'Ibanez', 'AZ Prestige', 'Modern classic with Seymour Duncan Hyperion', 2199.00, 90, 'epic', '{"tone": 16, "versatility": 18}'),
('S670QM', 'instrument', 'electric_guitar', 'Ibanez', 'S Series', 'Ultra-thin body for comfort shredding', 799.00, 75, 'uncommon', '{"speed": 14, "comfort": 16}'),
('RGA42FM', 'instrument', 'electric_guitar', 'Ibanez', 'RGA', 'Metal machine with flamed maple top', 449.00, 68, 'common', '{"attack": 12, "aggression": 14}'),
-- ESP/LTD Guitars
('Eclipse Custom', 'instrument', 'electric_guitar', 'ESP', 'Eclipse', 'Single cut metal monster with EMG pickups', 3799.00, 94, 'epic', '{"tone": 18, "aggression": 20}'),
('Horizon FR-7', 'instrument', 'electric_guitar', 'ESP', 'Horizon', '7-string shred machine with Floyd Rose', 4499.00, 96, 'legendary', '{"range": 20, "precision": 18}'),
('M-II', 'instrument', 'electric_guitar', 'ESP', 'M-II', 'Superstrat perfection with neck-thru design', 3299.00, 92, 'epic', '{"speed": 18, "sustain": 16}'),
('LTD EC-1000', 'instrument', 'electric_guitar', 'LTD', 'EC-1000', 'Les Paul style with active EMGs', 1049.00, 82, 'uncommon', '{"tone": 14, "aggression": 16}'),
('LTD MH-1000', 'instrument', 'electric_guitar', 'LTD', 'MH-1000', 'Set-neck superstrat with Fishman Fluence', 1199.00, 84, 'rare', '{"speed": 15, "clarity": 14}'),
-- Jackson Guitars
('Soloist SL2', 'instrument', 'electric_guitar', 'Jackson', 'Soloist', 'USA made shred icon with compound radius', 2699.00, 90, 'epic', '{"speed": 20, "precision": 16}'),
('Rhoads RR24', 'instrument', 'electric_guitar', 'Jackson', 'Rhoads', 'Randy Rhoads tribute with Floyd Rose', 1799.00, 86, 'rare', '{"stage_presence": 18, "aggression": 16}'),
('Dinky DK2', 'instrument', 'electric_guitar', 'Jackson', 'Dinky', 'Affordable superstrat with Seymour Duncan', 799.00, 76, 'uncommon', '{"speed": 12, "value": 14}'),
('King V KV2', 'instrument', 'electric_guitar', 'Jackson', 'King V', 'Aggressive V shape for metal', 1599.00, 84, 'rare', '{"stage_presence": 16, "aggression": 18}'),
-- Epiphone Guitars
('Les Paul Standard', 'instrument', 'electric_guitar', 'Epiphone', 'Standard', 'Affordable Les Paul with ProBucker pickups', 449.00, 72, 'common', '{"tone": 10, "value": 16}'),
('SG Standard', 'instrument', 'electric_guitar', 'Epiphone', 'SG Standard', 'Classic SG at accessible price', 399.00, 70, 'common', '{"tone": 9, "value": 15}'),
('Casino', 'instrument', 'electric_guitar', 'Epiphone', 'Casino', 'Fully hollow Beatles favorite', 599.00, 78, 'uncommon', '{"tone": 14, "character": 16}'),
('ES-335', 'instrument', 'electric_guitar', 'Epiphone', 'ES-335', 'Semi-hollow at great value', 499.00, 74, 'uncommon', '{"tone": 12, "warmth": 14}'),
-- Gretsch Guitars
('White Falcon', 'instrument', 'electric_guitar', 'Gretsch', 'White Falcon', 'Stunning hollow body flagship', 3499.00, 94, 'legendary', '{"tone": 20, "prestige": 22}'),
('Country Gentleman', 'instrument', 'electric_guitar', 'Gretsch', 'Country Gent', 'Chet Atkins signature model', 2999.00, 92, 'epic', '{"tone": 18, "class": 20}'),
('Duo Jet', 'instrument', 'electric_guitar', 'Gretsch', 'Duo Jet', 'Chambered solidbody with TV Jones', 2699.00, 90, 'epic', '{"tone": 16, "character": 18}'),
('Streamliner G2622', 'instrument', 'electric_guitar', 'Gretsch', 'Streamliner', 'Affordable hollow body', 449.00, 72, 'common', '{"tone": 10, "style": 14}'),
-- Rickenbacker
('330', 'instrument', 'electric_guitar', 'Rickenbacker', '330', 'Jangly semi-hollow with R pickups', 2149.00, 88, 'rare', '{"jangle": 22, "character": 18}'),
('360', 'instrument', 'electric_guitar', 'Rickenbacker', '360', 'Deluxe semi-hollow with stereo output', 2449.00, 90, 'epic', '{"jangle": 24, "character": 20}'),

-- ACOUSTIC GUITARS
('D-28', 'instrument', 'acoustic_guitar', 'Martin', 'D-28', 'The iconic dreadnought standard', 3299.00, 96, 'legendary', '{"tone": 24, "projection": 22}'),
('HD-28', 'instrument', 'acoustic_guitar', 'Martin', 'HD-28', 'Herringbone dreadnought with scalloped bracing', 3699.00, 97, 'legendary', '{"tone": 25, "resonance": 23}'),
('000-18', 'instrument', 'acoustic_guitar', 'Martin', '000-18', 'Auditorium body with mahogany back', 2799.00, 94, 'epic', '{"tone": 20, "balance": 22}'),
('OM-28', 'instrument', 'acoustic_guitar', 'Martin', 'OM-28', 'Orchestra model fingerpicking dream', 3499.00, 95, 'legendary', '{"tone": 22, "articulation": 24}'),
('J-45 Standard', 'instrument', 'acoustic_guitar', 'Gibson', 'J-45', 'The workhorse acoustic with warm tone', 2499.00, 92, 'epic', '{"tone": 18, "warmth": 22}'),
('Hummingbird', 'instrument', 'acoustic_guitar', 'Gibson', 'Hummingbird', 'Square-shoulder icon with cherry sunburst', 3999.00, 95, 'legendary', '{"tone": 22, "projection": 20}'),
('SJ-200', 'instrument', 'acoustic_guitar', 'Gibson', 'SJ-200', 'The King of Flat Tops', 4999.00, 98, 'legendary', '{"tone": 26, "prestige": 24}'),
('814ce', 'instrument', 'acoustic_guitar', 'Taylor', '814ce', 'Grand Auditorium with Expression System', 3499.00, 95, 'legendary', '{"tone": 22, "clarity": 24}'),
('614ce', 'instrument', 'acoustic_guitar', 'Taylor', '614ce', 'Maple back Grand Auditorium', 3199.00, 94, 'epic', '{"tone": 20, "brightness": 22}'),
('314ce', 'instrument', 'acoustic_guitar', 'Taylor', '314ce', 'Sapele Grand Auditorium workhorse', 1999.00, 88, 'rare', '{"tone": 16, "versatility": 18}'),
('214ce', 'instrument', 'acoustic_guitar', 'Taylor', '214ce', 'Layered rosewood Grand Auditorium', 1099.00, 80, 'uncommon', '{"tone": 12, "value": 16}'),

-- BASS GUITARS
('Precision Bass American Professional II', 'instrument', 'bass', 'Fender', 'P Bass Pro II', 'The bass that started it all, evolved', 1749.00, 90, 'epic', '{"tone": 18, "punch": 20}'),
('Jazz Bass American Ultra', 'instrument', 'bass', 'Fender', 'J Bass Ultra', 'Modern Jazz Bass with noiseless pickups', 2149.00, 92, 'epic', '{"tone": 20, "versatility": 18}'),
('Thunderbird', 'instrument', 'bass', 'Gibson', 'Thunderbird', 'Reverse body bass with thunderous tone', 2099.00, 88, 'rare', '{"tone": 16, "stage_presence": 18}'),
('SG Bass', 'instrument', 'bass', 'Gibson', 'SG Bass', 'Short scale bass with thick tone', 1799.00, 84, 'rare', '{"tone": 14, "playability": 16}'),
('Warwick Thumb', 'instrument', 'bass', 'Warwick', 'Thumb', 'Bolt-on bass with growling mids', 3799.00, 95, 'legendary', '{"tone": 22, "articulation": 20}'),
('Warwick Streamer', 'instrument', 'bass', 'Warwick', 'Streamer', 'Stage series with MEC pickups', 2999.00, 92, 'epic', '{"tone": 18, "comfort": 16}'),
('StingRay', 'instrument', 'bass', 'Music Man', 'StingRay', 'Active bass icon with punchy humbucker', 2299.00, 92, 'epic', '{"tone": 20, "punch": 22}'),
('Bongo', 'instrument', 'bass', 'Music Man', 'Bongo', 'Modern bass with neodymium pickups', 2499.00, 90, 'epic', '{"tone": 18, "versatility": 20}'),
('SR5005', 'instrument', 'bass', 'Ibanez', 'SR Prestige', '5-string with Nordstrand Big Singles', 1899.00, 88, 'rare', '{"range": 16, "playability": 18}'),
('BTB846SC', 'instrument', 'bass', 'Ibanez', 'BTB Premium', '6-string through-body bass', 1499.00, 84, 'rare', '{"range": 18, "sustain": 16}'),
('4003', 'instrument', 'bass', 'Rickenbacker', '4003', 'Iconic bass with stereo output', 2149.00, 90, 'epic', '{"tone": 20, "character": 22}'),
('Hofner Violin Bass', 'instrument', 'bass', 'Hofner', '500/1', 'The Beatles bass with thumpy tone', 2499.00, 86, 'rare', '{"tone": 14, "vintage": 22}'),

-- DRUMS
('Collectors Series Maple', 'instrument', 'drums', 'DW', 'Collectors', 'Hand-crafted maple shells with timbre matching', 6999.00, 98, 'legendary', '{"tone": 26, "sustain": 24}'),
('Performance Series', 'instrument', 'drums', 'DW', 'Performance', 'HVX shells at accessible price', 2999.00, 90, 'epic', '{"tone": 18, "value": 16}'),
('Reference Pure', 'instrument', 'drums', 'Pearl', 'Reference Pure', '6mm maple shells with Reference Sound', 5499.00, 96, 'legendary', '{"tone": 24, "projection": 22}'),
('Masters Maple Complete', 'instrument', 'drums', 'Pearl', 'Masters', '4-ply maple shells with 4-ply reinforcement', 3499.00, 92, 'epic', '{"tone": 20, "attack": 18}'),
('Export EXX', 'instrument', 'drums', 'Pearl', 'Export', 'Legendary workhorse kit', 899.00, 75, 'uncommon', '{"tone": 10, "value": 18}'),
('Starclassic Walnut/Birch', 'instrument', 'drums', 'Tama', 'Starclassic', 'Hybrid shells with powerful attack', 4299.00, 94, 'epic', '{"tone": 22, "attack": 20}'),
('Superstar Classic', 'instrument', 'drums', 'Tama', 'Superstar', 'All-maple shells with Star-Cast mounting', 1299.00, 82, 'uncommon', '{"tone": 14, "sustain": 12}'),
('Recording Custom', 'instrument', 'drums', 'Yamaha', 'Recording Custom', 'Studio standard birch shells', 4999.00, 96, 'legendary', '{"tone": 24, "clarity": 22}'),
('Stage Custom Birch', 'instrument', 'drums', 'Yamaha', 'Stage Custom', 'Affordable birch quality', 799.00, 74, 'common', '{"tone": 10, "value": 16}'),
('Brooklyn Series', 'instrument', 'drums', 'Gretsch', 'Brooklyn', 'USA-made shells with vintage tone', 3999.00, 94, 'epic', '{"tone": 22, "warmth": 20}'),
('Catalina Maple', 'instrument', 'drums', 'Gretsch', 'Catalina', 'All-maple shells at great value', 1099.00, 80, 'uncommon', '{"tone": 12, "warmth": 14}'),
('Legacy Maple', 'instrument', 'drums', 'Ludwig', 'Legacy', 'Classic maple shells with blue olive badge', 5999.00, 97, 'legendary', '{"tone": 25, "vintage": 24}'),
('Classic Maple', 'instrument', 'drums', 'Ludwig', 'Classic', 'Legendary sound at accessible price', 2799.00, 90, 'epic', '{"tone": 18, "character": 20}'),

-- CYMBALS
('K Custom Dark', 'instrument', 'cymbals', 'Zildjian', 'K Custom Dark', 'Dark, complex ride cymbals', 399.00, 92, 'epic', '{"tone": 20, "complexity": 22}'),
('A Custom', 'instrument', 'cymbals', 'Zildjian', 'A Custom', 'Brilliant finish with bright tone', 299.00, 85, 'rare', '{"brightness": 18, "cut": 16}'),
('K Constantinople', 'instrument', 'cymbals', 'Zildjian', 'K Constantinople', 'Hand-hammered jazz perfection', 599.00, 96, 'legendary', '{"tone": 24, "expression": 22}'),
('HHX Complex', 'instrument', 'cymbals', 'Sabian', 'HHX Complex', 'Versatile raw finish cymbals', 349.00, 88, 'rare', '{"versatility": 18, "tone": 16}'),
('AAX X-Plosion', 'instrument', 'cymbals', 'Sabian', 'AAX', 'Powerful crashes with brilliant finish', 279.00, 82, 'uncommon', '{"power": 16, "cut": 18}'),
('Byzance Extra Dry', 'instrument', 'cymbals', 'Meinl', 'Byzance', 'Dry, trashy, and complex', 449.00, 94, 'epic', '{"character": 22, "dryness": 24}'),
('Pure Alloy Custom', 'instrument', 'cymbals', 'Meinl', 'Pure Alloy', 'Modern sound with extra hammering', 299.00, 84, 'rare', '{"tone": 14, "versatility": 16}'),
('2002', 'instrument', 'cymbals', 'Paiste', '2002', 'Legendary rock cymbals', 399.00, 90, 'epic', '{"power": 20, "cut": 22}'),
('Formula 602', 'instrument', 'cymbals', 'Paiste', 'Formula 602', 'Warm, jazzy vintage tone', 549.00, 94, 'epic', '{"warmth": 22, "vintage": 24}');

-- Continue with more gear...
INSERT INTO public.equipment_catalog (name, category, subcategory, brand, model, description, base_price, quality_rating, rarity, stat_boosts) VALUES
-- GUITAR AMPLIFIERS
('JCM800 2203', 'amplifier', 'guitar_amp', 'Marshall', 'JCM800', 'The definitive rock amp head', 2199.00, 94, 'epic', '{"gain": 20, "presence": 18}'),
('JVM410H', 'amplifier', 'guitar_amp', 'Marshall', 'JVM', '4-channel versatility monster', 2499.00, 92, 'epic', '{"versatility": 22, "gain": 18}'),
('DSL40CR', 'amplifier', 'guitar_amp', 'Marshall', 'DSL', 'Dual Super Lead combo', 899.00, 80, 'uncommon', '{"tone": 14, "value": 16}'),
('Plexi 1959SLP', 'amplifier', 'guitar_amp', 'Marshall', '1959', 'Legendary Super Lead Plexi reissue', 3299.00, 96, 'legendary', '{"tone": 24, "vintage": 26}'),
('Twin Reverb 65', 'amplifier', 'guitar_amp', 'Fender', 'Twin Reverb', 'Clean amp standard with spring reverb', 1749.00, 92, 'epic', '{"clean": 24, "headroom": 22}'),
('Deluxe Reverb 65', 'amplifier', 'guitar_amp', 'Fender', 'Deluxe Reverb', 'Studio and stage workhorse', 1449.00, 90, 'epic', '{"tone": 20, "breakup": 18}'),
('Blues Junior IV', 'amplifier', 'guitar_amp', 'Fender', 'Blues Junior', 'Affordable tube tone', 699.00, 78, 'uncommon', '{"tone": 12, "portability": 16}'),
('Princeton Reverb 65', 'amplifier', 'guitar_amp', 'Fender', 'Princeton', 'Boutique tone in compact package', 1199.00, 88, 'rare', '{"tone": 16, "recording": 20}'),
('AC30C2', 'amplifier', 'guitar_amp', 'Vox', 'AC30', 'British chime with top boost', 1399.00, 90, 'epic', '{"chime": 22, "character": 20}'),
('AC15C1', 'amplifier', 'guitar_amp', 'Vox', 'AC15', 'Classic Vox tone in smaller package', 849.00, 84, 'rare', '{"chime": 18, "breakup": 16}'),
('Dual Rectifier', 'amplifier', 'guitar_amp', 'Mesa/Boogie', 'Rectifier', 'High-gain monster for modern metal', 2299.00, 94, 'epic', '{"gain": 26, "tightness": 20}'),
('Mark V', 'amplifier', 'guitar_amp', 'Mesa/Boogie', 'Mark V', '3-channel amp with iconic lead tones', 2799.00, 96, 'legendary', '{"versatility": 26, "tone": 24}'),
('Fillmore 50', 'amplifier', 'guitar_amp', 'Mesa/Boogie', 'Fillmore', 'Blackface-inspired tone with Mesa quality', 1999.00, 90, 'epic', '{"clean": 20, "warmth": 18}'),
('Rockerverb 50 MKIII', 'amplifier', 'guitar_amp', 'Orange', 'Rockerverb', 'Versatile British amp with clean and dirty', 2299.00, 92, 'epic', '{"tone": 20, "gain": 18}'),
('TH30H', 'amplifier', 'guitar_amp', 'Orange', 'TH30', 'Lunchbox head with big tone', 949.00, 84, 'rare', '{"portability": 16, "tone": 14}'),
('Crush 35RT', 'amplifier', 'guitar_amp', 'Orange', 'Crush', 'Solid-state with tube-like response', 329.00, 70, 'common', '{"value": 14, "practice": 16}'),
('5150 III', 'amplifier', 'guitar_amp', 'EVH', '5150 III', 'Eddie Van Halen''s modern high-gain amp', 2499.00, 94, 'epic', '{"gain": 24, "articulation": 20}'),
('6505+', 'amplifier', 'guitar_amp', 'Peavey', '6505+', 'Metal standard with crushing gain', 1299.00, 88, 'rare', '{"gain": 22, "tightness": 16}'),
('JC-120', 'amplifier', 'guitar_amp', 'Roland', 'Jazz Chorus', 'The clean amp with stereo chorus', 1299.00, 88, 'rare', '{"clean": 24, "chorus": 22}'),
('Katana 100', 'amplifier', 'guitar_amp', 'Boss', 'Katana', 'Digital modeling with tube-like feel', 449.00, 78, 'uncommon', '{"versatility": 18, "value": 20}'),
('THR30II', 'amplifier', 'guitar_amp', 'Yamaha', 'THR', 'Desktop amp with premium tone', 449.00, 80, 'uncommon', '{"portability": 18, "features": 16}'),
('PowerStage 200', 'amplifier', 'guitar_amp', 'Seymour Duncan', 'PowerStage', 'Pedalboard power amp solution', 499.00, 82, 'uncommon', '{"portability": 20, "transparency": 18}'),

-- BASS AMPLIFIERS
('SVT-CL', 'amplifier', 'bass_amp', 'Ampeg', 'SVT', 'The bass amp that defined rock', 2499.00, 96, 'legendary', '{"power": 26, "tone": 24}'),
('SVT-VR', 'amplifier', 'bass_amp', 'Ampeg', 'SVT Vintage', 'Vintage reissue with all-tube power', 2899.00, 97, 'legendary', '{"vintage": 26, "warmth": 24}'),
('Portaflex PF-500', 'amplifier', 'bass_amp', 'Ampeg', 'Portaflex', 'Lightweight class D Ampeg tone', 549.00, 82, 'uncommon', '{"portability": 18, "tone": 14}'),
('Little Mark III', 'amplifier', 'bass_amp', 'Markbass', 'Little Mark', 'Lightweight powerhouse', 799.00, 86, 'rare', '{"portability": 20, "clarity": 16}'),
('CMD 121P', 'amplifier', 'bass_amp', 'Markbass', 'CMD', 'Combo with piezo tweeter', 1099.00, 88, 'rare', '{"clarity": 18, "portability": 16}'),
('MB Fusion 800', 'amplifier', 'bass_amp', 'Gallien-Krueger', 'MB Fusion', 'Hybrid design with tube preamp', 899.00, 86, 'rare', '{"growl": 18, "clarity": 16}'),
('Legacy 800', 'amplifier', 'bass_amp', 'Gallien-Krueger', 'Legacy', 'Classic GK tone in modern package', 999.00, 88, 'rare', '{"tone": 16, "power": 18}'),
('Super Bassman', 'amplifier', 'bass_amp', 'Fender', 'Super Bassman', 'All-tube bass amp with massive headroom', 1799.00, 92, 'epic', '{"headroom": 22, "vintage": 20}'),
('Rumble 500', 'amplifier', 'bass_amp', 'Fender', 'Rumble', 'Lightweight combo with big sound', 599.00, 80, 'uncommon', '{"value": 16, "portability": 18}'),
('D-800+', 'amplifier', 'bass_amp', 'Aguilar', 'Tone Hammer', 'Transparent power with Aguilar tone', 899.00, 90, 'epic', '{"transparency": 20, "tone": 18}'),
('DB 751', 'amplifier', 'bass_amp', 'Aguilar', 'DB', 'Hybrid amp with vintage soul', 2499.00, 94, 'epic', '{"warmth": 22, "power": 20}'),
('WD-800', 'amplifier', 'bass_amp', 'Eden', 'World Tour', 'Signature Eden tone in compact head', 1199.00, 88, 'rare', '{"clarity": 18, "hi-fi": 16}'),
('Subway D-800+', 'amplifier', 'bass_amp', 'Mesa/Boogie', 'Subway', 'Mesa bass tone with portability', 1099.00, 90, 'epic', '{"tone": 18, "portability": 16}');

-- EFFECTS PEDALS
INSERT INTO public.equipment_catalog (name, category, subcategory, brand, model, description, base_price, quality_rating, rarity, stat_boosts) VALUES
-- Overdrive/Distortion
('TS808', 'effects', 'overdrive', 'Ibanez', 'Tube Screamer', 'The legendary green machine', 179.00, 88, 'rare', '{"gain": 14, "mids": 16}'),
('TS9', 'effects', 'overdrive', 'Ibanez', 'Tube Screamer', 'Modern reissue with more output', 129.00, 82, 'uncommon', '{"gain": 12, "warmth": 14}'),
('OCD', 'effects', 'overdrive', 'Fulltone', 'OCD', 'Obsessive compulsive drive', 169.00, 86, 'rare', '{"gain": 16, "transparency": 14}'),
('Klon Centaur', 'effects', 'overdrive', 'Klon', 'Centaur', 'The legendary transparent overdrive', 4999.00, 98, 'legendary', '{"transparency": 28, "magic": 26}'),
('Soul Food', 'effects', 'overdrive', 'Electro-Harmonix', 'Soul Food', 'Affordable Klon-style drive', 89.00, 78, 'uncommon', '{"transparency": 14, "value": 18}'),
('Morning Glory', 'effects', 'overdrive', 'JHS', 'Morning Glory', 'Transparent blues breaker style', 219.00, 88, 'rare', '{"transparency": 18, "touch": 16}'),
('King of Tone', 'effects', 'overdrive', 'Analogman', 'King of Tone', 'Dual overdrive unicorn', 349.00, 96, 'legendary', '{"versatility": 24, "tone": 22}'),
('Timmy', 'effects', 'overdrive', 'Paul Cochrane', 'Timmy', 'Transparent overdrive with EQ', 179.00, 90, 'epic', '{"transparency": 20, "eq": 18}'),
('BD-2 Blues Driver', 'effects', 'overdrive', 'Boss', 'BD-2', 'Blues amp in a box', 109.00, 80, 'uncommon', '{"gain": 12, "dynamics": 14}'),
('SD-1 Super Overdrive', 'effects', 'overdrive', 'Boss', 'SD-1', 'Asymmetrical clipping classic', 59.00, 74, 'common', '{"gain": 10, "value": 14}'),
('DS-1 Distortion', 'effects', 'distortion', 'Boss', 'DS-1', 'Orange distortion icon', 59.00, 74, 'common', '{"gain": 14, "aggression": 12}'),
('Metal Zone', 'effects', 'distortion', 'Boss', 'MT-2', 'High-gain EQ monster', 109.00, 76, 'common', '{"gain": 18, "eq": 16}'),
('RAT 2', 'effects', 'distortion', 'Pro Co', 'RAT', 'Legendary filter distortion', 89.00, 82, 'uncommon', '{"grit": 16, "character": 18}'),
('Big Muff Pi', 'effects', 'fuzz', 'Electro-Harmonix', 'Big Muff', 'Iconic sustaining fuzz', 99.00, 84, 'uncommon', '{"sustain": 20, "fuzz": 18}'),
('Fuzz Face', 'effects', 'fuzz', 'Dunlop', 'Fuzz Face', 'Hendrix''s silicon fuzz', 149.00, 86, 'rare', '{"fuzz": 18, "vintage": 16}'),
('Hoof Fuzz', 'effects', 'fuzz', 'EarthQuaker', 'Hoof', 'Versatile Muff-style fuzz', 179.00, 88, 'rare', '{"fuzz": 18, "versatility": 16}'),
('Plumes', 'effects', 'overdrive', 'EarthQuaker', 'Plumes', 'Three-mode screamer', 99.00, 84, 'uncommon', '{"versatility": 16, "value": 18}'),

-- Delay
('DD-3T', 'effects', 'delay', 'Boss', 'DD-3T', 'Classic digital delay with tap', 149.00, 82, 'uncommon', '{"clarity": 14, "reliability": 16}'),
('DD-500', 'effects', 'delay', 'Boss', 'DD-500', 'Ultimate delay workstation', 349.00, 92, 'epic', '{"versatility": 22, "depth": 20}'),
('DM-2W', 'effects', 'delay', 'Boss', 'DM-2W', 'Analog delay with Waza craft', 189.00, 88, 'rare', '{"warmth": 18, "analog": 20}'),
('Carbon Copy', 'effects', 'delay', 'MXR', 'Carbon Copy', 'Analog delay with modulation', 149.00, 86, 'rare', '{"warmth": 16, "modulation": 14}'),
('Timeline', 'effects', 'delay', 'Strymon', 'Timeline', 'The delay pedal to end all delays', 449.00, 96, 'legendary', '{"versatility": 26, "quality": 24}'),
('El Capistan', 'effects', 'delay', 'Strymon', 'El Capistan', 'Tape echo perfection', 299.00, 94, 'epic', '{"tape": 24, "character": 22}'),
('Flashback 2', 'effects', 'delay', 'TC Electronic', 'Flashback', 'TonePrint enabled delay', 179.00, 84, 'uncommon', '{"versatility": 16, "value": 18}'),
('Echosystem', 'effects', 'delay', 'Empress', 'Echosystem', 'Dual engine delay', 449.00, 94, 'epic', '{"depth": 22, "creativity": 24}'),
('Avalanche Run', 'effects', 'delay', 'EarthQuaker', 'Avalanche Run', 'Delay and reverb combined', 299.00, 90, 'epic', '{"ambient": 20, "versatility": 18}'),

-- Reverb
('RV-6', 'effects', 'reverb', 'Boss', 'RV-6', 'Digital reverb workhorse', 149.00, 84, 'uncommon', '{"versatility": 16, "quality": 14}'),
('HOF 2', 'effects', 'reverb', 'TC Electronic', 'Hall of Fame', 'TonePrint enabled reverb', 179.00, 86, 'rare', '{"versatility": 18, "shimmer": 16}'),
('BigSky', 'effects', 'reverb', 'Strymon', 'BigSky', 'The ultimate reverb pedal', 479.00, 98, 'legendary', '{"depth": 28, "quality": 26}'),
('Flint', 'effects', 'reverb', 'Strymon', 'Flint', 'Tremolo and reverb combo', 299.00, 92, 'epic', '{"vintage": 20, "warmth": 22}'),
('Holy Grail Neo', 'effects', 'reverb', 'Electro-Harmonix', 'Holy Grail', 'Spring reverb in a box', 139.00, 82, 'uncommon', '{"spring": 16, "value": 14}'),
('Oceans 11', 'effects', 'reverb', 'Electro-Harmonix', 'Oceans', '11 reverb types', 169.00, 86, 'rare', '{"versatility": 18, "value": 16}'),
('Ventris', 'effects', 'reverb', 'Source Audio', 'Ventris', 'Dual DSP reverb engine', 399.00, 94, 'epic', '{"depth": 22, "routing": 20}'),
('Afterneath', 'effects', 'reverb', 'EarthQuaker', 'Afterneath', 'Otherworldly ambient reverb', 229.00, 90, 'epic', '{"ambient": 22, "creativity": 20}'),

-- Modulation
('CE-2W', 'effects', 'chorus', 'Boss', 'CE-2W', 'Waza Craft chorus classic', 199.00, 90, 'epic', '{"lush": 20, "vintage": 18}'),
('Small Clone', 'effects', 'chorus', 'Electro-Harmonix', 'Small Clone', 'Nirvana''s chorus sound', 99.00, 82, 'uncommon', '{"depth": 14, "character": 16}'),
('Julia', 'effects', 'chorus', 'Walrus Audio', 'Julia', 'Analog chorus/vibrato', 199.00, 88, 'rare', '{"lush": 18, "versatility": 16}'),
('PH-3 Phase Shifter', 'effects', 'phaser', 'Boss', 'PH-3', 'Digital phaser with modes', 129.00, 78, 'uncommon', '{"versatility": 14, "swirl": 12}'),
('Phase 90', 'effects', 'phaser', 'MXR', 'Phase 90', 'Classic 4-stage phaser', 99.00, 84, 'uncommon', '{"swirl": 16, "warmth": 14}'),
('Small Stone', 'effects', 'phaser', 'Electro-Harmonix', 'Small Stone', 'Lush analog phaser', 99.00, 82, 'uncommon', '{"lush": 16, "depth": 14}'),
('Uni-Vibe', 'effects', 'vibe', 'Dunlop', 'Uni-Vibe', 'Psychedelic pulsating tone', 249.00, 90, 'epic', '{"vibe": 22, "vintage": 20}'),
('BF-3 Flanger', 'effects', 'flanger', 'Boss', 'BF-3', 'Stereo flanger with bass mode', 139.00, 80, 'uncommon', '{"jet": 14, "versatility": 16}'),
('Electric Mistress', 'effects', 'flanger', 'Electro-Harmonix', 'Electric Mistress', 'Lush filter matrix flanger', 149.00, 86, 'rare', '{"lush": 18, "character": 16}'),
('TR-2 Tremolo', 'effects', 'tremolo', 'Boss', 'TR-2', 'Classic amp tremolo', 99.00, 78, 'common', '{"pulse": 12, "vintage": 14}'),
('Supa-Trem', 'effects', 'tremolo', 'Fulltone', 'Supa-Trem', 'Harmonic tremolo beauty', 179.00, 88, 'rare', '{"harmonic": 18, "depth": 16}'),

-- Utility
('TU-3', 'effects', 'tuner', 'Boss', 'TU-3', 'Industry standard pedal tuner', 99.00, 86, 'uncommon', '{"accuracy": 18, "visibility": 16}'),
('Polytune 3', 'effects', 'tuner', 'TC Electronic', 'Polytune', 'Polyphonic tuning', 129.00, 90, 'rare', '{"speed": 20, "features": 18}'),
('Dyna Comp', 'effects', 'compressor', 'MXR', 'Dyna Comp', 'Classic optical compressor', 99.00, 82, 'uncommon', '{"squeeze": 14, "sustain": 16}'),
('CS-3', 'effects', 'compressor', 'Boss', 'CS-3', 'Compression sustainer', 99.00, 78, 'common', '{"sustain": 12, "control": 14}'),
('Cali76', 'effects', 'compressor', 'Origin Effects', 'Cali76', '1176 compressor in a pedal', 399.00, 96, 'legendary', '{"studio": 24, "tone": 22}'),
('Whammy V', 'effects', 'pitch', 'Digitech', 'Whammy', 'Pitch shifting icon', 229.00, 88, 'rare', '{"range": 18, "tracking": 16}'),
('POG 2', 'effects', 'octave', 'Electro-Harmonix', 'POG', 'Polyphonic octave generator', 299.00, 92, 'epic', '{"octaves": 22, "tracking": 20}'),
('Cry Baby', 'effects', 'wah', 'Dunlop', 'Cry Baby', 'The original wah pedal', 99.00, 84, 'uncommon', '{"expression": 16, "classic": 18}'),
('535Q', 'effects', 'wah', 'Dunlop', '535Q', 'Multi-contour wah', 179.00, 88, 'rare', '{"versatility": 18, "expression": 16}'),
('Volume X', 'effects', 'volume', 'Dunlop', 'DVP4', 'Mini volume pedal', 119.00, 82, 'uncommon', '{"control": 14, "size": 16}'),
('Ernie Ball VP Jr', 'effects', 'volume', 'Ernie Ball', 'VP Jr', '250k passive volume', 99.00, 80, 'common', '{"smooth": 12, "reliability": 16}'),
('NS-2 Noise Gate', 'effects', 'noise_gate', 'Boss', 'NS-2', 'Noise suppressor with loop', 99.00, 82, 'uncommon', '{"noise": 16, "loop": 14}'),
('Decimator II', 'effects', 'noise_gate', 'ISP', 'Decimator', 'Pro-level noise reduction', 179.00, 92, 'epic', '{"tracking": 22, "transparency": 20}');

-- MICROPHONES
INSERT INTO public.equipment_catalog (name, category, subcategory, brand, model, description, base_price, quality_rating, rarity, stat_boosts) VALUES
('U87 Ai', 'recording', 'condenser_mic', 'Neumann', 'U87', 'The studio standard large diaphragm', 3599.00, 98, 'legendary', '{"clarity": 28, "detail": 26}'),
('U47 FET', 'recording', 'condenser_mic', 'Neumann', 'U47', 'Legendary FET condenser', 4999.00, 99, 'legendary', '{"warmth": 28, "presence": 26}'),
('TLM 103', 'recording', 'condenser_mic', 'Neumann', 'TLM 103', 'Affordable Neumann quality', 1099.00, 90, 'epic', '{"clarity": 20, "value": 18}'),
('C414 XLS', 'recording', 'condenser_mic', 'AKG', 'C414', 'Multi-pattern studio workhorse', 1099.00, 92, 'epic', '{"versatility": 22, "clarity": 20}'),
('C12 VR', 'recording', 'condenser_mic', 'AKG', 'C12', 'Vintage tube condenser reissue', 5999.00, 98, 'legendary', '{"warmth": 26, "air": 24}'),
('SM7B', 'recording', 'dynamic_mic', 'Shure', 'SM7B', 'Broadcast and vocal standard', 399.00, 92, 'epic', '{"smoothness": 22, "rejection": 20}'),
('SM58', 'recording', 'dynamic_mic', 'Shure', 'SM58', 'The vocal mic industry standard', 99.00, 86, 'common', '{"durability": 20, "feedback": 18}'),
('SM57', 'recording', 'dynamic_mic', 'Shure', 'SM57', 'Instrument mic workhorse', 99.00, 88, 'common', '{"versatility": 20, "presence": 18}'),
('Beta 58A', 'recording', 'dynamic_mic', 'Shure', 'Beta 58A', 'Bright supercardioid vocal mic', 159.00, 88, 'rare', '{"clarity": 18, "feedback": 20}'),
('RE20', 'recording', 'dynamic_mic', 'Electro-Voice', 'RE20', 'Broadcast and bass amp favorite', 449.00, 92, 'epic', '{"bass": 22, "smoothness": 20}'),
('MD 421-II', 'recording', 'dynamic_mic', 'Sennheiser', 'MD 421', 'Versatile dynamic with bass roll-off', 399.00, 90, 'epic', '{"versatility": 20, "punch": 18}'),
('e906', 'recording', 'dynamic_mic', 'Sennheiser', 'e906', 'Guitar cab supercardioid', 189.00, 86, 'rare', '{"presence": 18, "flatness": 16}'),
('M160', 'recording', 'ribbon_mic', 'Beyerdynamic', 'M160', 'Hypercardioid ribbon for guitar', 749.00, 92, 'epic', '{"smoothness": 22, "detail": 20}'),
('R-121', 'recording', 'ribbon_mic', 'Royer', 'R-121', 'Modern ribbon standard', 1395.00, 96, 'legendary', '{"warmth": 24, "natural": 26}'),
('R-122V', 'recording', 'ribbon_mic', 'Royer', 'R-122V', 'Active tube ribbon', 3295.00, 98, 'legendary', '{"presence": 26, "detail": 24}'),
('AT2020', 'recording', 'condenser_mic', 'Audio-Technica', 'AT2020', 'Affordable studio condenser', 99.00, 76, 'common', '{"clarity": 12, "value": 18}'),
('AT4050', 'recording', 'condenser_mic', 'Audio-Technica', 'AT4050', 'Multi-pattern studio condenser', 699.00, 90, 'epic', '{"versatility": 20, "detail": 18}'),
('D112', 'recording', 'dynamic_mic', 'AKG', 'D112', 'Kick drum standard', 199.00, 86, 'uncommon', '{"thump": 18, "punch": 16}'),
('Beta 52A', 'recording', 'dynamic_mic', 'Shure', 'Beta 52A', 'Kick drum mic with attack', 189.00, 86, 'uncommon', '{"attack": 18, "low_end": 16}'),
('MD 441-U', 'recording', 'dynamic_mic', 'Sennheiser', 'MD 441', 'Premium broadcast dynamic', 899.00, 94, 'epic', '{"detail": 22, "isolation": 20}'),
('KSM44A', 'recording', 'condenser_mic', 'Shure', 'KSM44A', 'Multi-pattern studio vocal mic', 999.00, 92, 'epic', '{"smooth": 20, "detail": 18}'),
('NT1-A', 'recording', 'condenser_mic', 'Rode', 'NT1-A', 'Ultra-low noise condenser', 229.00, 82, 'uncommon', '{"quiet": 18, "value": 16}'),
('K2', 'recording', 'tube_mic', 'Rode', 'K2', 'Variable pattern tube condenser', 699.00, 88, 'rare', '{"warmth": 18, "versatility": 16}');

-- STAGE EQUIPMENT
INSERT INTO public.equipment_catalog (name, category, subcategory, brand, model, description, base_price, quality_rating, rarity, stat_boosts) VALUES
-- PA Systems
('SRX835P', 'stage', 'pa_speaker', 'JBL', 'SRX800', '3-way 15" active speaker 2000W', 1999.00, 94, 'epic', '{"power": 22, "clarity": 20}'),
('EON715', 'stage', 'pa_speaker', 'JBL', 'EON700', '15" powered speaker with Bluetooth', 649.00, 82, 'uncommon', '{"value": 16, "portability": 18}'),
('K12.2', 'stage', 'pa_speaker', 'QSC', 'K.2', '12" 2000W powered speaker', 799.00, 88, 'rare', '{"clarity": 18, "power": 16}'),
('KLA12', 'stage', 'line_array', 'QSC', 'KLA', '12" active line array element', 1299.00, 92, 'epic', '{"coverage": 20, "power": 18}'),
('ETX-35P', 'stage', 'pa_speaker', 'Electro-Voice', 'ETX', '15" 3-way powered speaker', 1499.00, 90, 'epic', '{"power": 20, "dsp": 18}'),
('ELX200-15P', 'stage', 'pa_speaker', 'Electro-Voice', 'ELX200', '15" powered speaker', 699.00, 84, 'uncommon', '{"value": 16, "portability": 14}'),
('Thump15A', 'stage', 'pa_speaker', 'Mackie', 'Thump', '15" powered speaker 1300W', 449.00, 78, 'common', '{"value": 18, "power": 14}'),
('HD15-A', 'stage', 'pa_speaker', 'RCF', 'HD', '15" active speaker 1400W', 999.00, 88, 'rare', '{"italian": 18, "power": 16}'),

-- Subwoofers
('KS212C', 'stage', 'subwoofer', 'QSC', 'KS', 'Dual 12" cardioid sub', 2999.00, 94, 'epic', '{"bass": 24, "control": 22}'),
('ETX-18SP', 'stage', 'subwoofer', 'Electro-Voice', 'ETX', '18" powered subwoofer', 1499.00, 90, 'epic', '{"bass": 20, "punch": 18}'),
('SRX818SP', 'stage', 'subwoofer', 'JBL', 'SRX800', '18" powered subwoofer', 1799.00, 92, 'epic', '{"bass": 22, "power": 20}'),
('Thump118S', 'stage', 'subwoofer', 'Mackie', 'Thump', '18" powered sub', 549.00, 78, 'common', '{"value": 16, "bass": 14}'),

-- Stage Monitors
('MR15', 'stage', 'monitor', 'JBL', 'MRX', '15" stage monitor', 849.00, 86, 'rare', '{"clarity": 16, "feedback": 18}'),
('SM15', 'stage', 'monitor', 'EAW', 'SM', '15" coaxial monitor', 1299.00, 92, 'epic', '{"clarity": 22, "power": 18}'),
('HP12', 'stage', 'monitor', 'QSC', 'HP', '12" active stage monitor', 999.00, 88, 'rare', '{"angle": 18, "power": 16}'),

-- Mixing Consoles
('X32', 'stage', 'mixer', 'Behringer', 'X32', '32-channel digital mixer', 2499.00, 90, 'epic', '{"channels": 22, "dsp": 20}'),
('SQ-5', 'stage', 'mixer', 'Allen & Heath', 'SQ', '48-channel digital mixer', 3499.00, 94, 'epic', '{"quality": 22, "workflow": 20}'),
('dLive S3000', 'stage', 'mixer', 'Allen & Heath', 'dLive', 'Flagship touring console', 14999.00, 98, 'legendary', '{"channels": 26, "quality": 28}'),
('TF5', 'stage', 'mixer', 'Yamaha', 'TF', '32-channel digital mixer', 4999.00, 92, 'epic', '{"ease": 20, "sound": 18}'),
('CL5', 'stage', 'mixer', 'Yamaha', 'CL', '72-channel digital console', 29999.00, 98, 'legendary', '{"channels": 28, "quality": 26}'),
('M32', 'stage', 'mixer', 'Midas', 'M32', '32-channel digital mixer', 4999.00, 94, 'epic', '{"preamps": 24, "dsp": 20}'),

-- Lighting
('Rush MH 6 Wash', 'stage', 'moving_head', 'Martin', 'Rush', '6x15W RGBW wash', 999.00, 86, 'rare', '{"color": 16, "wash": 18}'),
('MAC Aura XB', 'stage', 'moving_head', 'Martin', 'MAC', 'Premium wash with aura effect', 5999.00, 96, 'legendary', '{"color": 24, "output": 22}'),
('Maverick MK3 Spot', 'stage', 'moving_head', 'Chauvet', 'Maverick', '820W LED spot', 4999.00, 94, 'epic', '{"output": 22, "features": 20}'),
('Rogue R2 Wash', 'stage', 'moving_head', 'Chauvet', 'Rogue', 'Compact RGBW wash', 999.00, 84, 'rare', '{"value": 16, "output": 14}'),
('Robin 600 LEDWash', 'stage', 'moving_head', 'Robe', 'Robin', '600W LED wash fixture', 3999.00, 94, 'epic', '{"output": 22, "color": 20}'),
('SlimPAR Pro H', 'stage', 'par_light', 'Chauvet', 'SlimPAR', 'Hex-color LED par', 299.00, 80, 'uncommon', '{"color": 14, "value": 16}'),
('Mega Hex Par', 'stage', 'par_light', 'ADJ', 'Mega', '6-in-1 LED par', 249.00, 78, 'common', '{"value": 16, "color": 12}'),
('Shocker 90 IRC', 'stage', 'strobe', 'Chauvet', 'Shocker', '90W LED strobe', 399.00, 84, 'uncommon', '{"output": 16, "effects": 14}'),
('Atomic 3000 LED', 'stage', 'strobe', 'Martin', 'Atomic', 'Powerful LED strobe', 1499.00, 92, 'epic', '{"output": 22, "effects": 20}'),

-- IEM Systems
('PSM 1000', 'stage', 'iem', 'Shure', 'PSM1000', 'Professional IEM system', 2999.00, 96, 'legendary', '{"clarity": 24, "reliability": 26}'),
('PSM 300', 'stage', 'iem', 'Shure', 'PSM300', 'Affordable pro IEM', 599.00, 86, 'rare', '{"value": 18, "clarity": 16}'),
('G4 IEM', 'stage', 'iem', 'Sennheiser', 'EW IEM G4', 'Wireless IEM system', 999.00, 90, 'epic', '{"clarity": 20, "range": 18}'),
('M-1', 'stage', 'iem', 'Shure', 'SE846', 'Quad driver IEM earphones', 999.00, 94, 'epic', '{"detail": 24, "isolation": 22}'),
('SE535', 'stage', 'iem', 'Shure', 'SE535', 'Triple driver earphones', 499.00, 90, 'epic', '{"clarity": 20, "comfort": 18}'),

-- Wireless Systems
('QLXD24/SM58', 'stage', 'wireless_mic', 'Shure', 'QLXD', 'Digital wireless with SM58', 999.00, 92, 'epic', '{"range": 20, "clarity": 22}'),
('ULXD24/B58', 'stage', 'wireless_mic', 'Shure', 'ULXD', 'Premium digital wireless', 1799.00, 96, 'legendary', '{"range": 24, "clarity": 26}'),
('EW 500 G4', 'stage', 'wireless_mic', 'Sennheiser', 'EW 500', 'True diversity wireless', 999.00, 90, 'epic', '{"range": 20, "reliability": 18}'),
('Digital 6000', 'stage', 'wireless_mic', 'Sennheiser', 'Digital 6000', 'Flagship wireless system', 4999.00, 98, 'legendary', '{"quality": 26, "features": 28}'),
('Relay G90', 'stage', 'wireless_guitar', 'Line 6', 'Relay G90', 'Digital wireless for guitar', 699.00, 88, 'rare', '{"latency": 18, "range": 16}'),
('WL-50', 'stage', 'wireless_guitar', 'Boss', 'WL', 'Compact wireless system', 199.00, 82, 'uncommon', '{"value": 18, "ease": 16}'),

-- FX and Haze
('Magnum 2500 Hz', 'stage', 'hazer', 'Martin', 'Magnum', 'Pro touring hazer', 1999.00, 94, 'epic', '{"output": 22, "control": 20}'),
('Unique 2.1', 'stage', 'hazer', 'Look Solutions', 'Unique', 'Premium oil-based hazer', 1499.00, 92, 'epic', '{"fine": 22, "hang": 20}'),
('Hurricane 1800 Flex', 'stage', 'fog', 'Chauvet', 'Hurricane', '1800W fog machine', 499.00, 82, 'uncommon', '{"output": 16, "value": 18}'),
('JEM ZR35 Hi-Mass', 'stage', 'fog', 'Martin', 'JEM', 'Professional fog machine', 2999.00, 96, 'legendary', '{"output": 24, "reliability": 26}'),
('CO2 Jet', 'stage', 'effects', 'Various', 'CO2', 'High-pressure CO2 jet', 799.00, 86, 'rare', '{"impact": 18, "effect": 16}'),
('Confetti Cannon', 'stage', 'effects', 'Various', 'Confetti', 'Electronic confetti launcher', 399.00, 80, 'uncommon', '{"celebration": 16, "impact": 14}'),
('Spark Machine', 'stage', 'effects', 'Various', 'Spark', 'Cold spark effect machine', 999.00, 86, 'rare', '{"safety": 18, "visual": 16}'),

-- Cables and DI
('Premium Instrument Cable 20ft', 'stage', 'cable', 'Mogami', 'Gold', 'Ultra-premium instrument cable', 79.00, 94, 'epic', '{"signal": 22, "durability": 20}'),
('XLR Cable 25ft', 'stage', 'cable', 'Mogami', 'Gold', 'Studio quality XLR', 89.00, 94, 'epic', '{"signal": 22, "shield": 20}'),
('Instrument Cable 18ft', 'stage', 'cable', 'Planet Waves', 'American Stage', 'USA-made cable', 49.00, 86, 'rare', '{"value": 16, "quality": 14}'),
('JDI Passive', 'stage', 'di_box', 'Radial', 'JDI', 'Jensen transformer DI', 199.00, 94, 'epic', '{"transparency": 22, "build": 20}'),
('J48 Active', 'stage', 'di_box', 'Radial', 'J48', 'Active DI with pad', 199.00, 92, 'epic', '{"clarity": 20, "headroom": 18}'),
('BSS AR-133', 'stage', 'di_box', 'BSS', 'AR-133', 'Touring standard active DI', 179.00, 90, 'epic', '{"reliability": 20, "sound": 18}'),
('ProDI', 'stage', 'di_box', 'Behringer', 'DI100', 'Ultra affordable DI', 29.00, 70, 'common', '{"value": 18, "function": 12}');

-- Update version
UPDATE public.equipment_catalog SET updated_at = now() WHERE true;