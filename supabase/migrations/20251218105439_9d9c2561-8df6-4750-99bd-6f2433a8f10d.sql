-- Seed additional stage equipment with real brands

-- More PA Speakers
INSERT INTO public.equipment_catalog (name, category, subcategory, brand, model, description, base_price, quality_rating, rarity, stat_boosts) VALUES
('CP12', 'stage', 'pa_speaker', 'RCF', 'Compact M', '12" 1400W active speaker', 899.00, 86, 'rare', '{"clarity": 17, "power": 15}'),
('HD12-A', 'stage', 'pa_speaker', 'RCF', 'HD', '12" 1400W active speaker', 1299.00, 90, 'epic', '{"power": 19, "clarity": 18}'),
('Art 712-A MK5', 'stage', 'pa_speaker', 'RCF', 'ART', '12" 1400W active speaker', 699.00, 84, 'uncommon', '{"portability": 16, "value": 18}'),
('ZLX-12P G2', 'stage', 'pa_speaker', 'Electro-Voice', 'ZLX G2', '12" 1000W powered speaker', 499.00, 80, 'common', '{"value": 18, "portability": 16}'),
('DRM315', 'stage', 'pa_speaker', 'Mackie', 'DRM', '15" 2300W powered speaker', 1099.00, 88, 'rare', '{"power": 18, "bass": 17}'),
('SRM-212 V-Class', 'stage', 'pa_speaker', 'Mackie', 'SRM V-Class', '12" 2000W powered speaker', 999.00, 90, 'epic', '{"dsp": 20, "clarity": 18}'),
('HD32-A', 'stage', 'pa_speaker', 'RCF', 'HD', '12" + 3" 2200W active speaker', 2199.00, 94, 'epic', '{"power": 22, "clarity": 21}'),
('KW153', 'stage', 'pa_speaker', 'QSC', 'KW', '15" 1000W 3-way speaker', 1999.00, 92, 'epic', '{"clarity": 20, "coverage": 19}'),

-- More Subwoofers
('KS118', 'stage', 'subwoofer', 'QSC', 'KS', '18" 3600W powered subwoofer', 1999.00, 94, 'epic', '{"bass": 24, "power": 22}'),
('SUB8006-AS', 'stage', 'subwoofer', 'RCF', 'SUB', 'Dual 18" 5000W active sub', 4999.00, 96, 'legendary', '{"bass": 28, "power": 26}'),
('EKX-18SP', 'stage', 'subwoofer', 'Electro-Voice', 'EKX', '18" 1300W powered subwoofer', 1199.00, 88, 'rare', '{"bass": 20, "power": 18}'),
('ETX-18SP', 'stage', 'subwoofer', 'Electro-Voice', 'ETX', '18" 1800W powered subwoofer', 1699.00, 92, 'epic', '{"bass": 22, "power": 20}'),
('SRM-18S', 'stage', 'subwoofer', 'Mackie', 'SRM', '18" 1600W powered subwoofer', 949.00, 86, 'rare', '{"bass": 18, "value": 16}'),
('DLM-12S', 'stage', 'subwoofer', 'Mackie', 'DLM', '12" 2000W powered subwoofer', 1299.00, 90, 'epic', '{"bass": 20, "portability": 18}'),

-- Line Arrays
('VTX A12', 'stage', 'line_array', 'JBL', 'VTX', '12" line array element', 6999.00, 96, 'legendary', '{"coverage": 26, "clarity": 24}'),
('HDL 30-A', 'stage', 'line_array', 'RCF', 'HDL', 'Active line array module', 3999.00, 94, 'epic', '{"power": 22, "coverage": 21}'),
('HDL 6-A', 'stage', 'line_array', 'RCF', 'HDL', 'Compact active line array', 1899.00, 90, 'epic', '{"portability": 18, "coverage": 19}'),
('MLA-C', 'stage', 'line_array', 'Martin Audio', 'MLA Compact', 'Compact line array', 8999.00, 98, 'legendary', '{"coverage": 28, "clarity": 26}'),

-- Digital Mixers
('X32 Compact', 'stage', 'mixer', 'Behringer', 'X32', '40-input 25-bus digital mixer', 1699.00, 88, 'rare', '{"channels": 40, "effects": 18}'),
('X32 Rack', 'stage', 'mixer', 'Behringer', 'X32', '40-input rack digital mixer', 1299.00, 86, 'rare', '{"channels": 40, "portability": 18}'),
('XR18', 'stage', 'mixer', 'Behringer', 'X Air', '18-input digital mixer', 599.00, 82, 'uncommon', '{"channels": 18, "portability": 20}'),
('dLive C1500', 'stage', 'mixer', 'Allen & Heath', 'dLive', '128 channel digital mixer', 14999.00, 98, 'legendary', '{"channels": 128, "processing": 28}'),
('Avantis', 'stage', 'mixer', 'Allen & Heath', 'Avantis', '64 channel digital mixer', 8999.00, 96, 'legendary', '{"channels": 64, "processing": 26}'),
('TF5', 'stage', 'mixer', 'Yamaha', 'TF', '48 channel digital mixer', 4999.00, 94, 'epic', '{"channels": 48, "processing": 22}'),
('QL5', 'stage', 'mixer', 'Yamaha', 'QL', '64 channel digital mixer', 9999.00, 96, 'legendary', '{"channels": 64, "processing": 26}'),
('CL5', 'stage', 'mixer', 'Yamaha', 'CL', '72 channel flagship mixer', 24999.00, 99, 'legendary', '{"channels": 72, "processing": 30}'),
('StageScape M20d', 'stage', 'mixer', 'Line 6', 'StageScape', '20-channel smart mixer', 1999.00, 88, 'rare', '{"automation": 20, "effects": 18}'),
('PreSonus 32SX', 'stage', 'mixer', 'PreSonus', 'StudioLive', '32 channel digital mixer', 3299.00, 92, 'epic', '{"channels": 32, "recording": 20}'),

-- Stage Monitors
('TX12', 'stage', 'monitor', 'Turbosound', 'TX', '12" 1100W monitor wedge', 449.00, 84, 'uncommon', '{"clarity": 16, "value": 18}'),
('TX15', 'stage', 'monitor', 'Turbosound', 'TX', '15" 1100W monitor wedge', 549.00, 86, 'rare', '{"clarity": 17, "bass": 16}'),
('KS112', 'stage', 'monitor', 'QSC', 'KS', '12" 2000W ultra-compact sub', 1199.00, 92, 'epic', '{"bass": 20, "portability": 22}'),
('SRM-212 V-Class', 'stage', 'monitor', 'Mackie', 'SRM V-Class', '12" 2000W stage monitor', 999.00, 90, 'epic', '{"clarity": 18, "power": 19}'),
('NX12-A', 'stage', 'monitor', 'RCF', 'NX', '12" 1400W active monitor', 1099.00, 90, 'epic', '{"clarity": 19, "response": 18}'),
('M10', 'stage', 'monitor', 'Martin Audio', 'M Series', '10" passive monitor', 799.00, 88, 'rare', '{"clarity": 18, "build": 17}'),

-- Moving Head Lights
('Intimidator Spot 375Z IRC', 'stage', 'moving_head', 'Chauvet DJ', 'Intimidator', '150W LED moving head spot', 649.00, 86, 'rare', '{"brightness": 18, "effects": 17}'),
('Maverick MK3 Profile', 'stage', 'moving_head', 'Chauvet Professional', 'Maverick', '820W LED moving head', 4999.00, 96, 'legendary', '{"brightness": 26, "effects": 24}'),
('Maverick Storm 1 Wash', 'stage', 'moving_head', 'Chauvet Professional', 'Maverick', 'IP65 LED wash moving head', 3999.00, 94, 'epic', '{"brightness": 22, "effects": 21}'),
('MAC Encore Performance CLD', 'stage', 'moving_head', 'Martin', 'MAC Encore', 'Cold LED moving head', 7999.00, 98, 'legendary', '{"brightness": 28, "color": 26}'),
('MAC Aura XB', 'stage', 'moving_head', 'Martin', 'MAC Aura', 'LED wash moving head', 4999.00, 96, 'legendary', '{"brightness": 24, "effects": 24}'),
('Viper Profile', 'stage', 'moving_head', 'Robe', 'Viper', '1000W discharge moving head', 8999.00, 98, 'legendary', '{"brightness": 30, "effects": 28}'),
('BMFL Spot', 'stage', 'moving_head', 'Robe', 'BMFL', '1700W moving head spot', 14999.00, 99, 'legendary', '{"brightness": 32, "effects": 30}'),
('MegaPointe', 'stage', 'moving_head', 'Robe', 'MegaPointe', 'Hybrid beam/spot/wash', 11999.00, 99, 'legendary', '{"brightness": 30, "versatility": 28}'),
('Spiider', 'stage', 'moving_head', 'Robe', 'Spiider', 'LED wash moving head', 5999.00, 96, 'legendary', '{"brightness": 26, "effects": 24}'),
('Pointe', 'stage', 'moving_head', 'Robe', 'Pointe', 'Multi-function moving head', 6999.00, 96, 'legendary', '{"brightness": 26, "versatility": 26}'),

-- Par Lights
('SlimPAR Pro H USB', 'stage', 'par_light', 'Chauvet DJ', 'SlimPAR', 'RGBAW+UV LED par', 199.00, 80, 'common', '{"color": 16, "value": 18}'),
('Ovation E-910FC', 'stage', 'par_light', 'Chauvet Professional', 'Ovation', 'RGBA-Lime LED ellipsoidal', 2499.00, 94, 'epic', '{"brightness": 22, "color": 24}'),
('COLORado 1-Tri Tour', 'stage', 'par_light', 'Chauvet Professional', 'COLORado', 'RGB LED wash light', 999.00, 90, 'epic', '{"brightness": 18, "color": 20}'),
('Source Four LED Series 3', 'stage', 'par_light', 'ETC', 'Source Four', 'Professional LED ellipsoidal', 1899.00, 96, 'legendary', '{"brightness": 24, "color": 26}'),
('Lustr X8', 'stage', 'par_light', 'ETC', 'ColorSource', 'High-output LED array', 1299.00, 92, 'epic', '{"brightness": 22, "color": 22}'),
('RUSH PAR 2 CT Zoom', 'stage', 'par_light', 'Martin', 'RUSH PAR', 'LED par with zoom', 899.00, 88, 'rare', '{"brightness": 18, "versatility": 18}'),

-- Strobe Lights
('Atomic 3000 LED', 'stage', 'strobe', 'Martin', 'Atomic', '228W LED strobe', 1999.00, 94, 'epic', '{"brightness": 26, "effects": 22}'),
('Atomic Dot CMY', 'stage', 'strobe', 'Martin', 'Atomic Dot', 'LED dot with CMY', 4999.00, 96, 'legendary', '{"brightness": 28, "color": 24}'),
('Flash Bang', 'stage', 'strobe', 'High End Systems', 'Flash Bang', '4800W xenon strobe', 8999.00, 98, 'legendary', '{"brightness": 32, "impact": 30}'),
('Shocker 2', 'stage', 'strobe', 'Chauvet DJ', 'Shocker', 'Dual zone strobe', 299.00, 82, 'uncommon', '{"brightness": 16, "value": 18}'),
('Strike Array 4', 'stage', 'strobe', 'Chauvet Professional', 'Strike Array', 'LED blinder array', 1499.00, 92, 'epic', '{"brightness": 24, "effects": 20}'),

-- Fog & Haze Machines
('Vesuvio RGBA', 'stage', 'fog', 'Chauvet DJ', 'Vesuvio', 'Fog machine with RGBA lights', 499.00, 86, 'rare', '{"output": 18, "effects": 16}'),
('Cumulus', 'stage', 'fog', 'Chauvet DJ', 'Cumulus', 'Professional low fog machine', 999.00, 90, 'epic', '{"output": 20, "density": 18}'),
('JEM ZR45', 'stage', 'fog', 'Martin', 'JEM', 'Professional fog machine', 2499.00, 94, 'epic', '{"output": 24, "reliability": 22}'),
('JEM Glaciator X-Stream', 'stage', 'fog', 'Martin', 'JEM', 'Low fog generator', 4999.00, 96, 'legendary', '{"output": 26, "density": 24}'),
('Magnum 2500', 'stage', 'fog', 'Martin', 'Magnum', '2100W fog machine', 899.00, 88, 'rare', '{"output": 18, "warmup": 16}'),

-- Hazers
('Amhaze Stadium', 'stage', 'hazer', 'MDG', 'Amhaze', 'Stadium grade hazer', 2999.00, 96, 'legendary', '{"output": 26, "consistency": 28}'),
('Hazer Pro', 'stage', 'hazer', 'Antari', 'Hazer Pro', 'Professional oil hazer', 1299.00, 90, 'epic', '{"output": 20, "consistency": 22}'),
('HZ-500', 'stage', 'hazer', 'Antari', 'HZ', 'Compact professional hazer', 899.00, 88, 'rare', '{"output": 18, "portability": 18}'),
('Haze Base Classic', 'stage', 'hazer', 'Look Solutions', 'Haze Base', 'High output hazer', 1999.00, 92, 'epic', '{"output": 22, "consistency": 22}'),

-- In-Ear Monitors
('PSM 900', 'stage', 'iem', 'Shure', 'PSM', 'Wireless in-ear system', 1999.00, 94, 'epic', '{"clarity": 24, "reliability": 22}'),
('PSM 300', 'stage', 'iem', 'Shure', 'PSM', 'Entry professional IEM', 499.00, 86, 'rare', '{"clarity": 18, "value": 18}'),
('AS-1200', 'stage', 'iem', 'Audio-Technica', 'M3', 'Wireless IEM system', 599.00, 86, 'rare', '{"clarity": 18, "reliability": 16}'),
('MEI 1000 G2', 'stage', 'iem', 'Sennheiser', 'Evolution', 'Wireless IEM system', 999.00, 90, 'epic', '{"clarity": 20, "range": 18}'),
('EW IEM G4', 'stage', 'iem', 'Sennheiser', 'Evolution G4', 'Pro wireless IEM', 1399.00, 92, 'epic', '{"clarity": 22, "range": 20}'),
('M-1', 'stage', 'iem', 'Roland', 'M-1', 'Personal mixer', 349.00, 84, 'uncommon', '{"control": 18, "value": 16}'),
('P16-M', 'stage', 'iem', 'Behringer', 'Powerplay', '16-channel personal mixer', 199.00, 80, 'common', '{"control": 16, "value": 20}'),

-- Wireless Microphones
('QLXD24/SM58', 'stage', 'wireless_mic', 'Shure', 'QLX-D', 'Digital wireless with SM58', 1099.00, 92, 'epic', '{"clarity": 22, "reliability": 20}'),
('QLXD24/Beta58A', 'stage', 'wireless_mic', 'Shure', 'QLX-D', 'Digital wireless with Beta58A', 1199.00, 94, 'epic', '{"clarity": 24, "reliability": 20}'),
('ULXD24/SM58', 'stage', 'wireless_mic', 'Shure', 'ULX-D', 'Pro digital wireless SM58', 1799.00, 96, 'legendary', '{"clarity": 26, "reliability": 24}'),
('Axient Digital AD2/KSM8', 'stage', 'wireless_mic', 'Shure', 'Axient', 'Flagship wireless with KSM8', 3499.00, 99, 'legendary', '{"clarity": 30, "reliability": 28}'),
('EW 500 G4', 'stage', 'wireless_mic', 'Sennheiser', 'EW 500 G4', 'Pro wireless system', 1399.00, 94, 'epic', '{"clarity": 24, "range": 22}'),
('Digital 9000', 'stage', 'wireless_mic', 'Sennheiser', 'Digital 9000', 'Flagship digital wireless', 5999.00, 99, 'legendary', '{"clarity": 30, "range": 28}'),

-- Wireless Guitar Systems
('Relay G70', 'stage', 'wireless_guitar', 'Line 6', 'Relay', 'Digital wireless guitar', 549.00, 90, 'epic', '{"clarity": 20, "range": 18}'),
('Relay G90', 'stage', 'wireless_guitar', 'Line 6', 'Relay', 'Pro digital wireless guitar', 999.00, 94, 'epic', '{"clarity": 24, "range": 22}'),
('GLXD16+', 'stage', 'wireless_guitar', 'Shure', 'GLX-D+', 'Digital wireless guitar', 599.00, 92, 'epic', '{"clarity": 22, "reliability": 20}'),
('Freedom GT', 'stage', 'wireless_guitar', 'Xvive', 'Freedom', 'Compact wireless guitar', 149.00, 82, 'uncommon', '{"portability": 20, "value": 18}'),
('U2D Rechargeable', 'stage', 'wireless_guitar', 'Xvive', 'U2D', 'Digital wireless guitar', 129.00, 80, 'common', '{"portability": 18, "value": 20}'),

-- DI Boxes
('JDI', 'stage', 'di_box', 'Radial', 'JDI', 'Passive DI box', 199.00, 92, 'epic', '{"clarity": 20, "build": 22}'),
('J48', 'stage', 'di_box', 'Radial', 'J48', 'Active DI box', 219.00, 94, 'epic', '{"clarity": 22, "headroom": 20}'),
('ProDI', 'stage', 'di_box', 'Radial', 'ProDI', 'Passive DI box', 99.00, 86, 'rare', '{"clarity": 17, "value": 18}'),
('JPC', 'stage', 'di_box', 'Radial', 'JPC', 'Stereo PC-AV DI', 249.00, 90, 'epic', '{"clarity": 20, "versatility": 18}'),
('JDGC', 'stage', 'di_box', 'Radial', 'JDGC', 'Guitar DI with speaker sim', 299.00, 92, 'epic', '{"clarity": 22, "tone": 20}'),
('BSI', 'stage', 'di_box', 'Radial', 'BSI', 'Bass DI with speaker sim', 299.00, 92, 'epic', '{"clarity": 22, "tone": 20}'),

-- Stage Cables
('Pro 30ft XLR', 'stage', 'cable', 'Mogami', 'Gold', '30ft quad mic cable', 89.00, 94, 'epic', '{"clarity": 10, "durability": 20}'),
('Pro 50ft XLR', 'stage', 'cable', 'Mogami', 'Gold', '50ft quad mic cable', 119.00, 94, 'epic', '{"clarity": 10, "durability": 20}'),
('StageMASTER 25ft', 'stage', 'cable', 'Pro Co', 'StageMASTER', '25ft mic cable', 34.00, 86, 'uncommon', '{"durability": 18, "value": 16}'),
('Neutrik PowerCON', 'stage', 'cable', 'Neutrik', 'powerCON', '25ft power cable', 49.00, 90, 'rare', '{"reliability": 20, "safety": 18}'),
('DMX 25ft 5-pin', 'stage', 'cable', 'Accu-Cable', 'DMX', '25ft DMX cable', 29.00, 84, 'uncommon', '{"reliability": 16, "value": 18}'),
('Speakon 50ft', 'stage', 'cable', 'Pro Co', 'S Series', '50ft speaker cable', 79.00, 88, 'rare', '{"power": 18, "durability": 18}'),

-- Effects (CO2, Confetti, Pyro)
('CO2 Jet', 'stage', 'effects', 'Global Effects', 'Cryo', 'CO2 cryo jet', 499.00, 88, 'rare', '{"impact": 20, "spectacle": 18}'),
('Confetti Launcher', 'stage', 'effects', 'Magic FX', 'Stadium Shot', 'Electric confetti cannon', 899.00, 90, 'epic', '{"spectacle": 22, "impact": 20}'),
('Cold Spark Machine', 'stage', 'effects', 'Sparkular', 'Mini', 'Indoor cold spark fountain', 699.00, 90, 'epic', '{"spectacle": 22, "safety": 20}'),
('Flame Projector', 'stage', 'effects', 'Global Effects', 'Flame', 'DMX flame effect', 1999.00, 94, 'legendary', '{"spectacle": 26, "impact": 24}'),
('Snow Machine', 'stage', 'effects', 'Antari', 'S-500', 'High output snow machine', 599.00, 86, 'rare', '{"spectacle": 18, "output": 16}'),
('Bubble Machine', 'stage', 'effects', 'Chauvet DJ', 'B-550', 'High output bubble machine', 199.00, 82, 'uncommon', '{"spectacle": 14, "value": 16}')

ON CONFLICT (id) DO NOTHING;