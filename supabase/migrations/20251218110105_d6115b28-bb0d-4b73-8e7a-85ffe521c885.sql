-- Seed additional stage equipment items
INSERT INTO equipment_catalog (name, description, category, subcategory, brand, rarity, base_price, quality_rating, stat_boosts, is_available) VALUES
-- More PA Speakers
('EV ZLX-15P', 'Versatile 15" powered speaker with DSP', 'stage', 'pa_speaker', 'Electro-Voice', 'common', 549, 72, '{"volume": 8, "clarity": 6}', true),
('JBL PRX815W', '15" two-way speaker with Wi-Fi control', 'stage', 'pa_speaker', 'JBL', 'uncommon', 849, 78, '{"volume": 10, "clarity": 8}', true),
('Yamaha DZR15', '15" powered speaker with 2000W amp', 'stage', 'pa_speaker', 'Yamaha', 'rare', 1499, 85, '{"volume": 12, "clarity": 10}', true),
('Meyer Sound UPA-1P', 'Industry standard compact loudspeaker', 'stage', 'pa_speaker', 'Meyer Sound', 'epic', 4500, 92, '{"volume": 14, "clarity": 14}', true),
('L-Acoustics KARA II', 'Premium modular line source element', 'stage', 'pa_speaker', 'L-Acoustics', 'legendary', 12000, 98, '{"volume": 18, "clarity": 18}', true),

-- More Subwoofers
('JBL SRX818SP', '18" powered subwoofer with DSP', 'stage', 'subwoofer', 'JBL', 'uncommon', 1199, 80, '{"bass": 14, "volume": 8}', true),
('RCF SUB 9006-AS', '18" active high-power subwoofer', 'stage', 'subwoofer', 'RCF', 'rare', 2499, 86, '{"bass": 16, "volume": 10}', true),
('Meyer Sound 1100-LFC', 'Low-frequency control element', 'stage', 'subwoofer', 'Meyer Sound', 'epic', 8500, 94, '{"bass": 20, "volume": 14}', true),
('d&b audiotechnik SL-SUB', 'Concert-grade cardioid subwoofer', 'stage', 'subwoofer', 'd&b audiotechnik', 'legendary', 15000, 98, '{"bass": 24, "volume": 16}', true),

-- More Mixers
('Yamaha TF3', '24-channel digital mixer with touchscreen', 'stage', 'mixer', 'Yamaha', 'rare', 3999, 88, '{"clarity": 12, "control": 14}', true),
('Allen & Heath dLive C1500', 'Compact digital mixing system', 'stage', 'mixer', 'Allen & Heath', 'epic', 8999, 93, '{"clarity": 16, "control": 18}', true),
('DiGiCo SD12', 'Professional touring console', 'stage', 'mixer', 'DiGiCo', 'epic', 18000, 95, '{"clarity": 18, "control": 20}', true),
('SSL Live L550', 'Flagship live mixing console', 'stage', 'mixer', 'Solid State Logic', 'legendary', 45000, 99, '{"clarity": 22, "control": 24}', true),
('Midas Heritage D', 'Legendary digital console', 'stage', 'mixer', 'Midas', 'legendary', 55000, 99, '{"clarity": 24, "control": 24}', true),

-- More Stage Monitors
('JBL 305P MkII', 'Compact powered reference monitor', 'stage', 'monitor', 'JBL', 'common', 149, 68, '{"clarity": 6, "detail": 6}', true),
('QSC K10.2', '10" powered loudspeaker', 'stage', 'monitor', 'QSC', 'uncommon', 699, 78, '{"clarity": 8, "detail": 8}', true),
('Meyer Sound MJF-212A', 'High-output stage monitor', 'stage', 'monitor', 'Meyer Sound', 'epic', 4200, 92, '{"clarity": 14, "detail": 14}', true),
('d&b audiotechnik M4', 'Premium stage monitor wedge', 'stage', 'monitor', 'd&b audiotechnik', 'legendary', 6500, 96, '{"clarity": 16, "detail": 16}', true),

-- More Moving Heads
('Chauvet Intimidator Spot 375Z IRC', 'Feature-packed LED spot', 'stage', 'moving_head', 'Chauvet DJ', 'uncommon', 599, 74, '{"visual_impact": 10, "versatility": 8}', true),
('Martin MAC Aura XB', 'Powerful LED wash light', 'stage', 'moving_head', 'Martin', 'rare', 3200, 86, '{"visual_impact": 14, "versatility": 12}', true),
('Robe BMFL Spot', 'Industry-leading moving head spot', 'stage', 'moving_head', 'Robe', 'epic', 12000, 94, '{"visual_impact": 18, "versatility": 16}', true),
('Clay Paky Sharpy Plus', 'Iconic beam and spot hybrid', 'stage', 'moving_head', 'Clay Paky', 'epic', 8500, 92, '{"visual_impact": 16, "versatility": 18}', true),
('Ayrton Perseo Profile', 'Ultra-compact LED profile', 'stage', 'moving_head', 'Ayrton', 'legendary', 18000, 98, '{"visual_impact": 22, "versatility": 20}', true),

-- More Par Lights
('Chauvet SlimPAR Pro H USB', 'Hex-color LED par with battery', 'stage', 'par_light', 'Chauvet DJ', 'common', 199, 70, '{"visual_impact": 6, "color": 8}', true),
('ADJ Mega 64 Profile Plus', 'Low-profile LED par', 'stage', 'par_light', 'ADJ', 'common', 149, 66, '{"visual_impact": 5, "color": 6}', true),
('ETC Source Four LED Series 3', 'Premium theatrical LED', 'stage', 'par_light', 'ETC', 'rare', 1800, 88, '{"visual_impact": 12, "color": 14}', true),
('Martin RUSH PAR 2 RGBW', 'Versatile wash fixture', 'stage', 'par_light', 'Martin', 'uncommon', 450, 76, '{"visual_impact": 8, "color": 10}', true),

-- More Strobes
('ADJ Mega Flash DMX', 'Classic high-output strobe', 'stage', 'strobe', 'ADJ', 'common', 89, 64, '{"visual_impact": 6, "intensity": 8}', true),
('Martin Atomic 3000 LED', 'Industry standard strobe', 'stage', 'strobe', 'Martin', 'rare', 2200, 88, '{"visual_impact": 14, "intensity": 16}', true),
('GLP JDC1', 'Hybrid strobe/blinder', 'stage', 'strobe', 'GLP', 'epic', 4500, 92, '{"visual_impact": 16, "intensity": 18}', true),
('Ayrton Diablo-TC', 'Profile/strobe hybrid', 'stage', 'strobe', 'Ayrton', 'legendary', 12000, 96, '{"visual_impact": 20, "intensity": 20}', true),

-- More Fog/Haze
('Chauvet Hurricane 1800 Flex', 'Powerful fog machine', 'stage', 'fog', 'Chauvet DJ', 'common', 299, 68, '{"atmosphere": 8, "coverage": 6}', true),
('Antari W-530', 'Wireless high-output fogger', 'stage', 'fog', 'Antari', 'uncommon', 599, 76, '{"atmosphere": 10, "coverage": 8}', true),
('Ultratec Radiance Hazer', 'Premium touring hazer', 'stage', 'hazer', 'Ultratec', 'rare', 2800, 88, '{"atmosphere": 14, "coverage": 14}', true),
('MDG theONE', 'Top-tier atmospheric generator', 'stage', 'hazer', 'MDG', 'legendary', 8500, 98, '{"atmosphere": 20, "coverage": 18}', true),
('Look Solutions Unique 2.1', 'Theatrical hazer', 'stage', 'hazer', 'Look Solutions', 'rare', 1800, 84, '{"atmosphere": 12, "coverage": 12}', true),

-- More IEMs
('Sennheiser EW IEM G4', 'Professional wireless IEM', 'stage', 'iem', 'Sennheiser', 'rare', 1299, 86, '{"clarity": 14, "isolation": 12}', true),
('Shure PSM 1000', 'Premium wireless personal monitor', 'stage', 'iem', 'Shure', 'epic', 3500, 94, '{"clarity": 18, "isolation": 16}', true),
('Audio-Technica M3', 'Wireless in-ear monitor system', 'stage', 'iem', 'Audio-Technica', 'uncommon', 699, 78, '{"clarity": 10, "isolation": 8}', true),
('Lectrosonics M2T/M2R', 'Broadcast-grade IEM system', 'stage', 'iem', 'Lectrosonics', 'legendary', 4500, 98, '{"clarity": 20, "isolation": 18}', true),

-- More Wireless Mics
('Sennheiser EW 500 G4', 'Professional handheld system', 'stage', 'wireless_mic', 'Sennheiser', 'rare', 1199, 86, '{"clarity": 14, "range": 12}', true),
('Shure QLXD24/SM58', 'Digital wireless with SM58', 'stage', 'wireless_mic', 'Shure', 'rare', 1099, 84, '{"clarity": 12, "range": 12}', true),
('Audio-Technica 5000 Series', 'Flagship wireless system', 'stage', 'wireless_mic', 'Audio-Technica', 'epic', 2800, 92, '{"clarity": 16, "range": 16}', true),
('Shure Axient Digital', 'Ultimate wireless platform', 'stage', 'wireless_mic', 'Shure', 'legendary', 4500, 98, '{"clarity": 20, "range": 18}', true),

-- More Wireless Guitar Systems
('Line 6 Relay G70', 'Advanced digital guitar wireless', 'stage', 'wireless_guitar', 'Line 6', 'uncommon', 549, 78, '{"signal_quality": 10, "range": 10}', true),
('Shure GLXD16+', 'Dual-band digital guitar system', 'stage', 'wireless_guitar', 'Shure', 'rare', 599, 82, '{"signal_quality": 12, "range": 12}', true),
('Sennheiser EW-D CI1', 'Evolution digital instrument', 'stage', 'wireless_guitar', 'Sennheiser', 'rare', 799, 84, '{"signal_quality": 14, "range": 12}', true),
('Lectrosonics LT + LR', 'Broadcast-quality instrument', 'stage', 'wireless_guitar', 'Lectrosonics', 'legendary', 3200, 96, '{"signal_quality": 18, "range": 16}', true),

-- More DI Boxes
('Radial JDI', 'Premium passive DI box', 'stage', 'di_box', 'Radial', 'uncommon', 199, 82, '{"signal_quality": 10, "reliability": 10}', true),
('Countryman Type 85', 'Industry standard active DI', 'stage', 'di_box', 'Countryman', 'rare', 249, 88, '{"signal_quality": 14, "reliability": 12}', true),
('Rupert Neve RNDI', 'Premium transformer DI', 'stage', 'di_box', 'Rupert Neve Designs', 'epic', 299, 92, '{"signal_quality": 16, "reliability": 14}', true),
('Avalon U5', 'Legendary DI/preamp', 'stage', 'di_box', 'Avalon', 'legendary', 595, 96, '{"signal_quality": 18, "reliability": 16}', true),

-- More Cables
('Mogami Gold Studio', 'Premium studio XLR cable', 'stage', 'cable', 'Mogami', 'uncommon', 79, 88, '{"signal_quality": 10}', true),
('Canare Star Quad', 'Broadcast-quality cable', 'stage', 'cable', 'Canare', 'rare', 99, 90, '{"signal_quality": 12}', true),
('Whirlwind Leader', 'Premium stage cable', 'stage', 'cable', 'Whirlwind', 'uncommon', 59, 82, '{"signal_quality": 8}', true),
('Neutrik XXR', 'Professional XLR cable', 'stage', 'cable', 'Neutrik', 'rare', 89, 86, '{"signal_quality": 10}', true),

-- More Stage Effects  
('Magic FX Stadium Shot', 'Large-scale confetti cannon', 'stage', 'effects', 'Magic FX', 'rare', 1200, 84, '{"visual_impact": 14, "excitement": 16}', true),
('Le Maitre G300 Smoke', 'Theatrical smoke machine', 'stage', 'effects', 'Le Maitre', 'rare', 1800, 86, '{"visual_impact": 12, "atmosphere": 14}', true),
('Ultratec Fire Cylinder', 'Safe indoor flame effect', 'stage', 'effects', 'Ultratec', 'epic', 3500, 90, '{"visual_impact": 18, "excitement": 18}', true),
('Sparkular Mini', 'Indoor cold spark fountain', 'stage', 'effects', 'Sparkular', 'epic', 2200, 88, '{"visual_impact": 16, "excitement": 16}', true),
('Cryo Jet CO2', 'Professional cryo effect', 'stage', 'effects', 'Global Effects', 'epic', 2800, 88, '{"visual_impact": 16, "excitement": 18}', true),
('Laser Grazer', 'Multi-beam laser effect', 'stage', 'effects', 'X-Laser', 'rare', 1500, 82, '{"visual_impact": 14, "excitement": 14}', true),

-- Line Arrays
('JBL VTX A12', 'Compact line array element', 'stage', 'line_array', 'JBL', 'epic', 8000, 92, '{"volume": 16, "coverage": 16}', true),
('d&b audiotechnik V-Series', 'Premium line array', 'stage', 'line_array', 'd&b audiotechnik', 'legendary', 15000, 98, '{"volume": 20, "coverage": 20}', true),
('L-Acoustics K2', 'Industry-leading line array', 'stage', 'line_array', 'L-Acoustics', 'legendary', 18000, 99, '{"volume": 22, "coverage": 22}', true),
('Meyer Sound LEOPARD', 'Compact powerful line array', 'stage', 'line_array', 'Meyer Sound', 'epic', 12000, 95, '{"volume": 18, "coverage": 18}', true)

ON CONFLICT (id) DO NOTHING;