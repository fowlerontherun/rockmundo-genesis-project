
-- Seed Harley Benton gear (budget-friendly brand across many categories) plus additional items from other brands

INSERT INTO equipment_catalog (name, category, subcategory, brand, description, base_price, quality_rating, durability, rarity, required_level, stock_quantity, max_stock, is_available)
VALUES
-- HARLEY BENTON Electric Guitars (budget legends)
('Harley Benton SC-450 Plus', 'instrument', 'electric_guitar', 'Harley Benton', 'Les Paul style with Rosewood fingerboard and coil-split. Incredible value.', 180, 45, 65, 'common', 1, 200, 200, true),
('Harley Benton SC-550 Deluxe', 'instrument', 'electric_guitar', 'Harley Benton', 'Upgraded single-cut with Wilkinson pickups and grover-style tuners.', 250, 55, 70, 'common', 2, 150, 150, true),
('Harley Benton SC-Custom II', 'instrument', 'electric_guitar', 'Harley Benton', 'Premium single-cut with flamed maple top and Duncan-designed pickups.', 350, 62, 75, 'uncommon', 3, 100, 100, true),
('Harley Benton TE-52 NA Vintage', 'instrument', 'electric_guitar', 'Harley Benton', 'Classic Telecaster style with alder body and vintage bridge.', 160, 42, 65, 'common', 1, 200, 200, true),
('Harley Benton TE-62 CC', 'instrument', 'electric_guitar', 'Harley Benton', 'Custom colour Tele-style with modern C-shape neck.', 170, 44, 65, 'common', 1, 180, 180, true),
('Harley Benton ST-62 Vintage', 'instrument', 'electric_guitar', 'Harley Benton', 'Strat-style with vintage tremolo and ceramic pickups.', 150, 40, 60, 'common', 1, 250, 250, true),
('Harley Benton ST-62 DLX', 'instrument', 'electric_guitar', 'Harley Benton', 'Upgraded Strat-style with Alnico V pickups and better hardware.', 200, 50, 68, 'common', 2, 150, 150, true),
('Harley Benton Fusion-II HSH', 'instrument', 'electric_guitar', 'Harley Benton', 'Modern superstrat with roasted maple neck and stainless steel frets.', 320, 60, 78, 'uncommon', 4, 80, 80, true),
('Harley Benton Fusion-III HSH', 'instrument', 'electric_guitar', 'Harley Benton', 'Top-tier superstrat with Fishman Fluence pickups and Evertune bridge option.', 450, 72, 82, 'uncommon', 6, 60, 60, true),
('Harley Benton EX-76 Classic', 'instrument', 'electric_guitar', 'Harley Benton', 'Explorer-style rock machine with dual humbuckers.', 190, 48, 70, 'common', 2, 120, 120, true),
('Harley Benton CST-24T Paradise', 'instrument', 'electric_guitar', 'Harley Benton', 'PRS-inspired double-cut with tremolo and flamed veneer.', 280, 58, 72, 'uncommon', 3, 100, 100, true),
('Harley Benton R-457 7-String', 'instrument', 'electric_guitar', 'Harley Benton', 'Affordable 7-string for djent and progressive metal.', 220, 50, 68, 'common', 3, 100, 100, true),
('Harley Benton R-458 8-String', 'instrument', 'electric_guitar', 'Harley Benton', '8-string extended range for ultra-low tunings.', 260, 52, 68, 'common', 4, 80, 80, true),

-- HARLEY BENTON Acoustic Guitars
('Harley Benton CLD-16S', 'instrument', 'acoustic_guitar', 'Harley Benton', 'Solid spruce top dreadnought with mahogany back and sides.', 140, 45, 65, 'common', 1, 200, 200, true),
('Harley Benton CLD-28SCE', 'instrument', 'acoustic_guitar', 'Harley Benton', 'Cutaway electro-acoustic with solid top and Fishman pickup.', 200, 52, 70, 'common', 2, 150, 150, true),
('Harley Benton CLA-15MCE', 'instrument', 'acoustic_guitar', 'Harley Benton', 'Classical cutaway nylon-string with built-in preamp.', 130, 42, 60, 'common', 1, 180, 180, true),
('Harley Benton HBO-850 Parlor', 'instrument', 'acoustic_guitar', 'Harley Benton', 'Compact parlor guitar ideal for fingerstyle and travel.', 120, 40, 58, 'common', 1, 200, 200, true),

-- HARLEY BENTON Bass Guitars
('Harley Benton PB-50 Vintage', 'instrument', 'bass', 'Harley Benton', 'P-Bass style with split single-coil pickup and maple neck.', 140, 42, 65, 'common', 1, 200, 200, true),
('Harley Benton JB-75 Vintage', 'instrument', 'bass', 'Harley Benton', 'Jazz Bass style with dual single-coils for versatile tone.', 150, 44, 65, 'common', 1, 180, 180, true),
('Harley Benton B-550 Deluxe', 'instrument', 'bass', 'Harley Benton', 'Active bass with 3-band EQ and modern playability.', 250, 55, 72, 'uncommon', 3, 100, 100, true),
('Harley Benton B-650 5-String', 'instrument', 'bass', 'Harley Benton', '5-string active bass with extended low range.', 280, 56, 72, 'uncommon', 3, 80, 80, true),

-- HARLEY BENTON Amps
('Harley Benton TUBE15 Celestion', 'amplifier', 'tube_combo', 'Harley Benton', '15W all-tube combo with Celestion speaker. Bedroom to small gig.', 200, 50, 70, 'common', 2, 100, 100, true),
('Harley Benton TUBE5C Celestion', 'amplifier', 'tube_combo', 'Harley Benton', '5W tube combo for recording and practice. Sweet breakup tones.', 150, 45, 65, 'common', 1, 150, 150, true),

-- HARLEY BENTON Effects
('Harley Benton DNAfx GiT Pro', 'effects', 'multi', 'Harley Benton', 'Digital multi-effects with amp modeling and IR loader.', 130, 48, 70, 'common', 1, 150, 150, true),
('Harley Benton Binary Distortion', 'effects', 'distortion', 'Harley Benton', 'Dual-mode distortion pedal with independent gain controls.', 35, 38, 60, 'common', 1, 300, 300, true),
('Harley Benton Space Reverb', 'effects', 'reverb', 'Harley Benton', 'Shimmer reverb with hall, plate, and modulated modes.', 45, 40, 60, 'common', 1, 250, 250, true),
('Harley Benton Mighty-15TH', 'effects', 'overdrive', 'Harley Benton', 'Tube-voiced overdrive with warm harmonic saturation.', 30, 36, 55, 'common', 1, 300, 300, true),

-- HARLEY BENTON Keyboards
('Harley Benton SL-88 Stage', 'instrument', 'keyboard', 'Harley Benton', '88-key stage piano with hammer action and built-in sounds.', 350, 55, 75, 'uncommon', 2, 60, 60, true),

-- Additional brands - more variety
('Squier Classic Vibe 50s Strat', 'instrument', 'electric_guitar', 'Squier', 'Vintage-spec Strat with alnico pickups. Best in class at this price.', 420, 65, 78, 'uncommon', 3, 80, 80, true),
('Squier Affinity Tele', 'instrument', 'electric_guitar', 'Squier', 'Budget Telecaster with ceramic pickups and C-shape neck.', 280, 50, 68, 'common', 1, 120, 120, true),
('Jackson JS22 Dinky', 'instrument', 'electric_guitar', 'Jackson', 'Compound radius fretboard for shred. Floyd Rose Special tremolo.', 300, 55, 72, 'common', 2, 100, 100, true),
('Jackson Pro Soloist SL2', 'instrument', 'electric_guitar', 'Jackson', 'Through-neck construction with Seymour Duncan pickups.', 1200, 82, 88, 'rare', 10, 20, 20, true),
('Cort G250 Champagne Gold', 'instrument', 'electric_guitar', 'Cort', 'Korean-made strat-style with premium hardware at mid-range price.', 350, 58, 75, 'common', 3, 80, 80, true),
('Chapman ML1 Modern', 'instrument', 'electric_guitar', 'Chapman', 'British design with Seymour Duncan Solar pickups and ergonomic body.', 550, 70, 80, 'uncommon', 5, 50, 50, true),
('LTD EC-256 Cobalt Blue', 'instrument', 'electric_guitar', 'ESP', 'Affordable single-cut with set-neck and ESP pickups.', 420, 62, 78, 'uncommon', 4, 70, 70, true),
('Sterling by Music Man JP150', 'instrument', 'electric_guitar', 'Sterling', 'John Petrucci signature with DiMarzio pickups and Floyd Rose.', 650, 75, 82, 'rare', 7, 30, 30, true),
('Charvel Pro-Mod DK24', 'instrument', 'electric_guitar', 'Charvel', 'Modern hot rod with caramelized maple and Seymour Duncans.', 850, 80, 85, 'rare', 8, 25, 25, true),
('Reverend Double Agent OG', 'instrument', 'electric_guitar', 'Reverend', 'P90 and humbucker combo with bass contour knob. Unique tones.', 900, 78, 85, 'rare', 8, 20, 20, true),
('Gretsch G5220 Electromatic Jet', 'instrument', 'electric_guitar', 'Gretsch', 'Chambered body with BroadTron pickups. Rockabilly to indie rock.', 550, 68, 78, 'uncommon', 5, 50, 50, true),
('Danelectro 59M NOS+', 'instrument', 'electric_guitar', 'Danelectro', 'Retro lipstick pickups with masonite body. Lo-fi character.', 400, 55, 60, 'common', 3, 60, 60, true),
('Kramer Baretta Special', 'instrument', 'electric_guitar', 'Kramer', '80s shred reissue with hot humbucker and Floyd Rose.', 280, 52, 68, 'common', 2, 100, 100, true),

-- Additional Bass
('Sterling by Music Man StingRay RAY34', 'instrument', 'bass', 'Sterling', 'Music Man tone at affordable price. Active preamp and humbucker.', 750, 78, 85, 'rare', 7, 25, 25, true),
('Cort Action Bass Plus', 'instrument', 'bass', 'Cort', 'Lightweight active bass perfect for beginners and gigging.', 200, 45, 68, 'common', 1, 120, 120, true),
('Sire Marcus Miller V7', 'instrument', 'bass', 'Sire', 'Marcus Miller signature with rolled fretboard edges and active EQ.', 550, 72, 80, 'uncommon', 5, 40, 40, true),

-- Additional Keyboards  
('Arturia KeyLab 61 MkII', 'instrument', 'keyboard', 'Arturia', 'Premium MIDI controller with Fatar keybed and Analog Lab included.', 500, 72, 82, 'uncommon', 4, 40, 40, true),
('Nektar Impact LX88+', 'instrument', 'keyboard', 'Nektar', 'Budget 88-key controller with DAW integration.', 220, 48, 65, 'common', 1, 80, 80, true),
('Behringer DeepMind 12', 'instrument', 'synthesizer', 'Behringer', '12-voice analog poly synth with effects. Insane value.', 800, 75, 78, 'rare', 6, 20, 20, true),

-- Additional Drums
('Mapex Mars Series', 'instrument', 'drums', 'Mapex', '5-piece birch/basswood kit. Great intermediate upgrade.', 700, 65, 80, 'uncommon', 3, 30, 30, true),
('Pearl Export EXX', 'instrument', 'drums', 'Pearl', 'Best-selling drum kit ever made. Poplar/mahogany shells.', 800, 68, 82, 'uncommon', 4, 25, 25, true),
('Alesis Nitro Mesh', 'instrument', 'electronic_drums', 'Alesis', 'Electronic mesh-head kit for quiet practice. 385 sounds.', 380, 55, 70, 'common', 1, 60, 60, true),

-- More effects pedals
('TC Electronic Hall of Fame 2', 'effects', 'reverb', 'TC Electronic', 'MASH technology reverb with TonePrint customization.', 150, 72, 80, 'uncommon', 3, 60, 60, true),
('JHS Morning Glory V4', 'effects', 'overdrive', 'JHS', 'Transparent overdrive based on the Bluesbreaker circuit.', 200, 78, 82, 'rare', 5, 30, 30, true),
('EHX Canyon Delay', 'effects', 'delay', 'Electro-Harmonix', '11 delay modes with looper. Insane value.', 140, 70, 78, 'uncommon', 3, 50, 50, true),
('Boss DS-1 Distortion', 'effects', 'distortion', 'Boss', 'The legendary orange box. Used on countless records.', 55, 55, 90, 'common', 1, 200, 200, true),
('Dunlop Cry Baby GCB95', 'effects', 'wah', 'Dunlop', 'The original and most iconic wah pedal in history.', 80, 60, 85, 'common', 1, 150, 150, true),

-- Recording gear
('Focusrite Scarlett 2i2 4th Gen', 'recording', 'microphone', 'Focusrite', 'Industry-standard USB audio interface. 2-in, 2-out.', 170, 72, 85, 'uncommon', 1, 80, 80, true),
('PreSonus AudioBox USB 96', 'recording', 'microphone', 'PreSonus', 'Budget recording interface with Studio One Artist included.', 100, 50, 75, 'common', 1, 120, 120, true),

-- Stage gear
('Behringer XR18 Digital Mixer', 'stage', 'mixer', 'Behringer', '18-channel digital mixer with WiFi control. Perfect for small venues.', 600, 68, 78, 'uncommon', 4, 30, 30, true),
('Alto TS315 PA Speaker', 'stage', 'pa_speaker', 'Alto', '2000W powered speaker. Loud and affordable for gigging bands.', 350, 58, 72, 'common', 2, 50, 50, true);
