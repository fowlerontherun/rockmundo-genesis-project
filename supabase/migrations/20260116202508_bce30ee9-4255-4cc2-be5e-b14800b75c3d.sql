-- Seed 50+ new equipment items with correct categories
INSERT INTO equipment_catalog (name, category, subcategory, brand, description, base_price, quality_rating, durability, rarity, required_level, is_available, stock_quantity, max_stock) VALUES
-- Instruments - Guitars
('Ibanez RG550', 'instrument', 'guitar', 'Ibanez', 'Versatile shred machine with Edge tremolo', 1200, 75, 85, 'uncommon', 5, true, 50, 50),
('PRS Custom 24', 'instrument', 'guitar', 'PRS', 'Premium carved top with bird inlays', 3500, 90, 90, 'epic', 15, true, 10, 10),
('Schecter Hellraiser', 'instrument', 'guitar', 'Schecter', 'Active EMG pickups for heavy tones', 900, 70, 80, 'common', 3, true, 100, 100),
('ESP Eclipse', 'instrument', 'guitar', 'ESP', 'Single cutaway design with set neck', 1800, 80, 85, 'rare', 10, true, 20, 20),
('Jackson Soloist', 'instrument', 'guitar', 'Jackson', 'Through-neck design for sustain', 1500, 78, 82, 'rare', 8, true, 20, 20),
('Epiphone Les Paul Standard', 'instrument', 'guitar', 'Epiphone', 'Classic tone at accessible price', 450, 60, 75, 'common', 1, true, 100, 100),
('Squier Classic Vibe Strat', 'instrument', 'guitar', 'Squier', 'Vintage-style Stratocaster affordable', 400, 58, 70, 'common', 1, true, 100, 100),
('Gibson SG Standard', 'instrument', 'guitar', 'Gibson', 'Devilish double cutaway classic', 1600, 82, 80, 'rare', 10, true, 20, 20),
('Gretsch White Falcon', 'instrument', 'guitar', 'Gretsch', 'Stunning hollowbody flagship', 3200, 88, 75, 'epic', 18, true, 10, 10),
('Martin D-28', 'instrument', 'acoustic_guitar', 'Martin', 'The quintessential dreadnought', 3000, 92, 85, 'epic', 15, true, 10, 10),
('Taylor 814ce', 'instrument', 'acoustic_guitar', 'Taylor', 'Grand Auditorium with V-Class bracing', 3500, 93, 88, 'epic', 18, true, 10, 10),
('Gibson Hummingbird', 'instrument', 'acoustic_guitar', 'Gibson', 'Iconic square-shoulder dreadnought', 4000, 90, 82, 'legendary', 25, true, 3, 3),

-- Instruments - Bass
('Rickenbacker 4003', 'instrument', 'bass', 'Rickenbacker', 'Iconic trebly bass tone', 2200, 85, 88, 'epic', 12, true, 10, 10),
('Music Man StingRay', 'instrument', 'bass', 'Music Man', 'Punchy active bass with humbucker', 1800, 82, 85, 'rare', 10, true, 20, 20),
('Warwick Corvette', 'instrument', 'bass', 'Warwick', 'German craftsmanship with growl', 1600, 80, 82, 'rare', 8, true, 20, 20),
('Fender Jazz Bass', 'instrument', 'bass', 'Fender', 'Versatile dual-pickup classic', 1200, 78, 80, 'uncommon', 5, true, 50, 50),
('Hofner Violin Bass', 'instrument', 'bass', 'Hofner', 'Hollow body Beatles bass', 2500, 75, 70, 'epic', 15, true, 10, 10),
('Dingwall NG-3', 'instrument', 'bass', 'Dingwall', 'Multi-scale progressive bass', 2800, 88, 90, 'epic', 18, true, 10, 10),

-- Instruments - Drums
('DW Collectors Series Kit', 'instrument', 'drums', 'DW', 'Hand-crafted American shells', 5500, 95, 92, 'legendary', 25, true, 3, 3),
('Pearl Masters Maple', 'instrument', 'drums', 'Pearl', 'Professional maple shells', 3000, 85, 88, 'epic', 15, true, 10, 10),
('Tama Starclassic', 'instrument', 'drums', 'Tama', 'Bubinga/birch hybrid shells', 2800, 82, 85, 'rare', 12, true, 20, 20),
('Ludwig Classic Maple', 'instrument', 'drums', 'Ludwig', 'Legendary warmth and punch', 2500, 80, 80, 'rare', 10, true, 20, 20),
('Gretsch Renown', 'instrument', 'drums', 'Gretsch', 'Maple shells with classic tone', 1800, 75, 78, 'uncommon', 8, true, 50, 50),
('Roland TD-50KV2', 'instrument', 'electronic_drums', 'Roland', 'Flagship electronic kit', 6500, 92, 95, 'legendary', 28, true, 3, 3),
('Alesis Strike Pro SE', 'instrument', 'electronic_drums', 'Alesis', 'Feature-packed electronic kit', 2000, 72, 80, 'uncommon', 5, true, 50, 50),
('Zildjian K Custom Dark Cymbals', 'instrument', 'cymbals', 'Zildjian', 'Dark, complex overtones', 1200, 88, 85, 'rare', 10, true, 20, 20),
('Sabian HHX Evolution Set', 'instrument', 'cymbals', 'Sabian', 'Bright, modern projection', 1400, 85, 82, 'rare', 12, true, 20, 20),
('Meinl Byzance Extra Dry', 'instrument', 'cymbals', 'Meinl', 'Dry, trashy jazz cymbals', 1100, 82, 80, 'uncommon', 8, true, 50, 50),

-- Instruments - Keyboards
('Nord Stage 4', 'instrument', 'keyboard', 'Nord', 'Premium stage keyboard', 4500, 95, 92, 'legendary', 25, true, 3, 3),
('Roland RD-2000', 'instrument', 'keyboard', 'Roland', 'Professional stage piano', 2800, 88, 90, 'epic', 15, true, 10, 10),
('Korg Kronos 2', 'instrument', 'keyboard', 'Korg', 'Ultimate music workstation', 3500, 90, 88, 'epic', 18, true, 10, 10),
('Moog Subsequent 37', 'instrument', 'synthesizer', 'Moog', 'Paraphonic analog synth', 1800, 85, 85, 'rare', 12, true, 20, 20),
('Sequential Prophet-6', 'instrument', 'synthesizer', 'Sequential', 'True analog polyphonic', 3000, 92, 88, 'epic', 18, true, 10, 10),
('Yamaha Montage M8x', 'instrument', 'keyboard', 'Yamaha', 'Flagship motion control synth', 4200, 93, 90, 'legendary', 25, true, 3, 3),
('Arturia PolyBrute', 'instrument', 'synthesizer', 'Arturia', 'Morphing analog polysynth', 2600, 88, 85, 'epic', 15, true, 10, 10),

-- Recording - Microphones
('Shure SM58', 'recording', 'microphone', 'Shure', 'Industry standard vocal mic', 100, 75, 95, 'common', 1, true, 100, 100),
('Sennheiser e935', 'recording', 'microphone', 'Sennheiser', 'Warm, natural vocal reproduction', 180, 80, 90, 'common', 3, true, 100, 100),
('Neumann U87', 'recording', 'condenser', 'Neumann', 'Legendary studio condenser', 3200, 98, 85, 'legendary', 30, true, 3, 3),
('AKG C414 XLII', 'recording', 'condenser', 'AKG', 'Multi-pattern studio workhorse', 1100, 90, 88, 'rare', 15, true, 20, 20),
('Shure SM7B', 'recording', 'microphone', 'Shure', 'Broadcast and vocal classic', 400, 85, 92, 'uncommon', 8, true, 50, 50),
('Electro-Voice RE20', 'recording', 'microphone', 'Electro-Voice', 'Broadcast standard', 450, 82, 90, 'uncommon', 8, true, 50, 50),

-- Stage - Lighting
('Chauvet Intimidator Beam 360X', 'stage', 'lighting', 'Chauvet', 'Powerful beam moving head', 800, 78, 82, 'uncommon', 8, true, 50, 50),
('ADJ Hydro Beam X12', 'stage', 'lighting', 'ADJ', 'IP65 rated outdoor beam', 2500, 85, 88, 'rare', 15, true, 20, 20),
('Martin MAC Aura XB', 'stage', 'lighting', 'Martin', 'Premium LED wash light', 3500, 92, 90, 'epic', 20, true, 10, 10),
('Elation Proteus Hybrid', 'stage', 'lighting', 'Elation', 'All-in-one beam/spot/wash', 4000, 90, 88, 'epic', 22, true, 10, 10),
('Blizzard Hotbox Inferno', 'stage', 'led_par', 'Blizzard', 'Powerful RGBAW LED par', 350, 70, 80, 'common', 3, true, 100, 100),
('Mega Strobe FX12', 'stage', 'strobe', 'ADJ', 'DMX controlled strobe', 250, 65, 75, 'common', 2, true, 100, 100),

-- Stage - Monitors/IEM
('Shure PSM 1000', 'stage', 'iem', 'Shure', 'Premium wireless IEM system', 3500, 95, 92, 'legendary', 25, true, 3, 3),
('Sennheiser EW IEM G4', 'stage', 'iem', 'Sennheiser', 'Professional wireless monitoring', 1200, 85, 88, 'rare', 12, true, 20, 20),
('Yamaha HS8', 'stage', 'monitor', 'Yamaha', 'Accurate studio reference', 350, 80, 85, 'common', 5, true, 100, 100),
('JBL 708P', 'stage', 'monitor', 'JBL', 'Master reference monitor', 2200, 92, 90, 'epic', 18, true, 10, 10),
('QSC K12.2', 'stage', 'speaker', 'QSC', 'Versatile powered speaker', 800, 78, 85, 'uncommon', 8, true, 50, 50),

-- Stage - Mixers
('Allen Heath SQ-5', 'stage', 'mixer', 'Allen & Heath', 'Compact digital mixer', 3500, 88, 90, 'epic', 18, true, 10, 10),
('Yamaha TF5', 'stage', 'mixer', 'Yamaha', 'TouchFlow digital console', 5500, 92, 92, 'legendary', 25, true, 3, 3),
('Midas M32', 'stage', 'mixer', 'Midas', 'Flagship live console', 4000, 90, 88, 'epic', 20, true, 10, 10),
('Behringer X32', 'stage', 'mixer', 'Behringer', 'Affordable digital mixer', 1500, 75, 80, 'uncommon', 8, true, 50, 50),
('Soundcraft Ui24R', 'stage', 'mixer', 'Soundcraft', 'Stagebox digital mixer', 900, 72, 78, 'common', 5, true, 100, 100),

-- Amplifiers
('Mesa Boogie Dual Rectifier', 'amplifier', 'tube_head', 'Mesa Boogie', 'Legendary high-gain amp', 2200, 92, 85, 'epic', 15, true, 10, 10),
('Marshall JCM800', 'amplifier', 'tube_head', 'Marshall', 'British rock legend', 1800, 88, 80, 'rare', 12, true, 20, 20),
('Fender Twin Reverb', 'amplifier', 'tube_combo', 'Fender', 'Clean tone king', 1500, 85, 85, 'rare', 10, true, 20, 20),
('Vox AC30', 'amplifier', 'tube_combo', 'Vox', 'British chime and jangle', 1200, 82, 78, 'uncommon', 8, true, 50, 50),
('Orange Rockerverb 50', 'amplifier', 'tube_head', 'Orange', 'Versatile British tone', 2000, 86, 82, 'rare', 12, true, 20, 20),
('Kemper Profiler', 'amplifier', 'modeler', 'Kemper', 'Profile any amp digitally', 2200, 90, 95, 'epic', 15, true, 10, 10),
('Line 6 Helix', 'amplifier', 'modeler', 'Line 6', 'Full amp modeling and effects', 1500, 85, 90, 'rare', 10, true, 20, 20),

-- Effects
('Boss DS-1 Distortion', 'effects', 'distortion', 'Boss', 'Classic orange distortion', 50, 65, 90, 'common', 1, true, 100, 100),
('Ibanez Tube Screamer TS9', 'effects', 'overdrive', 'Ibanez', 'Legendary overdrive pedal', 100, 80, 88, 'common', 2, true, 100, 100),
('Strymon Timeline', 'effects', 'delay', 'Strymon', 'Ultimate delay machine', 450, 92, 90, 'rare', 12, true, 20, 20),
('Eventide H9 Max', 'effects', 'multi', 'Eventide', 'Studio algorithms in a pedal', 700, 95, 88, 'epic', 18, true, 10, 10),
('Electro-Harmonix Big Muff', 'effects', 'fuzz', 'Electro-Harmonix', 'Iconic sustaining fuzz', 80, 75, 85, 'common', 2, true, 100, 100),
('MXR Phase 90', 'effects', 'modulation', 'MXR', 'Classic phaser sound', 90, 78, 88, 'common', 2, true, 100, 100),
('TC Electronic Hall of Fame', 'effects', 'reverb', 'TC Electronic', 'TonePrint enabled reverb', 150, 82, 85, 'common', 3, true, 100, 100),
('Wampler Tumnus Deluxe', 'effects', 'overdrive', 'Wampler', 'Transparent Klon-style drive', 200, 85, 88, 'uncommon', 5, true, 50, 50)

ON CONFLICT (id) DO NOTHING;