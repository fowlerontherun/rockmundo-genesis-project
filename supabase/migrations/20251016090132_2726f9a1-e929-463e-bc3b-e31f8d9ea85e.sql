-- Continue seeding production notes

-- STAGE DESIGN & PROPS (10 notes)
INSERT INTO setlist_production_notes (name, description, category, impact_type, impact_value, required_fame, required_venue_prestige, cost_per_use, rarity) VALUES
('Riser Platform Reveal', 'Hydraulic platforms reveal band members', 'stage_design', 'attendance', 1.15, 900, 3, 1500, 'uncommon'),
('Rotating Stage Section', 'Motorized rotating stage floor', 'stage_design', 'attendance', 1.18, 1500, 4, 2500, 'rare'),
('Curtain Drop Surprise', 'Dramatic curtain drop reveals stage setup', 'stage_design', 'performance', 1.10, 300, 1, 200, 'common'),
('String Section On Stage', 'Live string quartet joins performance', 'stage_design', 'performance', 1.20, 700, 2, 1000, 'uncommon'),
('Acoustic Circle Setup', 'Intimate unplugged arrangement', 'stage_design', 'performance', 1.12, 200, 0, 100, 'common'),
('Scaffolding Tower Stage', 'Multi-level scaffolding stage design', 'stage_design', 'attendance', 1.16, 1200, 3, 2000, 'uncommon'),
('Throne Props for Ballads', 'Ornate throne for seated performances', 'stage_design', 'performance', 1.08, 400, 1, 300, 'common'),
('Motorcycle on Stage', 'Actual motorcycle as prop piece', 'stage_design', 'fame', 1.14, 800, 2, 800, 'uncommon'),
('Living Room Set Design', 'Create intimate living room on stage', 'stage_design', 'performance', 1.11, 600, 2, 600, 'uncommon'),
('Giant Inflatable Props', 'Oversized inflatable set pieces', 'stage_design', 'performance', 1.09, 500, 1, 400, 'common');

-- SURPRISE ELEMENTS (10 notes)
INSERT INTO setlist_production_notes (name, description, category, impact_type, impact_value, required_fame, cost_per_use, rarity) VALUES
('Guest Artist Cameo', 'Surprise appearance by another artist', 'surprise_element', 'fame', 1.35, 2000, 5000, 'legendary'),
('Unreleased Song Preview', 'World premiere of new unreleased track', 'surprise_element', 'fame', 1.25, 500, 0, 'uncommon'),
('Album Announcement Mid-Show', 'Reveal new album release date during show', 'surprise_element', 'fame', 1.30, 1000, 0, 'rare'),
('Merch Drop Flash Announcement', 'Surprise limited merch drop announced', 'surprise_element', 'merch_sales', 1.40, 600, 100, 'uncommon'),
('VIP Meet & Greet Surprise', 'Randomly select fans for backstage meet', 'surprise_element', 'fame', 1.20, 800, 0, 'uncommon'),
('Cover Song Mashup', 'Unexpected medley of popular covers', 'surprise_element', 'performance', 1.15, 400, 0, 'common'),
('Birthday Celebration On Stage', 'Celebrate audience member birthday', 'surprise_element', 'fame', 1.10, 200, 0, 'common'),
('Proposal Assistance', 'Help fan propose on stage', 'surprise_element', 'fame', 1.18, 300, 0, 'uncommon'),
('Charity Fundraiser Announce', 'Announce portion of proceeds to charity', 'surprise_element', 'fame', 1.12, 500, 0, 'common'),
('Time Capsule Burial', 'Bury time capsule with fans after show', 'surprise_element', 'fame', 1.16, 1000, 200, 'uncommon');

-- ADVANCED PRODUCTION (remaining to reach 100+)
INSERT INTO setlist_production_notes (name, description, category, impact_type, impact_value, required_fame, required_venue_prestige, required_skill_slug, cost_per_use, rarity) VALUES
('Quadraphonic Sound System', 'Surround sound from all venue angles', 'special_effects', 'performance', 1.20, 1800, 4, 'performance_advanced_stage_presence', 3000, 'rare'),
('Silent Disco Section', 'Wireless headphones for crowd segment', 'special_effects', 'attendance', 1.17, 1100, 3, null, 1200, 'uncommon'),
('Rain Machine Indoor', 'Safe indoor rain effect for dramatic moments', 'special_effects', 'performance', 1.19, 1400, 4, null, 1800, 'rare'),
('Wind Machine Atmosphere', 'Controlled wind effects for dramatic impact', 'special_effects', 'performance', 1.08, 500, 1, null, 200, 'common'),
('Costume Change Quick Booth', 'Visible quick-change costume station', 'stage_design', 'performance', 1.11, 700, 2, null, 400, 'uncommon'),
('Orchestra Pit Reveal', 'Hidden orchestra rises from pit', 'stage_design', 'attendance', 1.25, 2200, 5, null, 4000, 'legendary'),
('Trapdoor Stage Entrance', 'Band members appear through trapdoors', 'stage_design', 'performance', 1.13, 1000, 3, null, 1500, 'uncommon'),
('Catwalk Runway Extension', 'Extended catwalk into audience', 'stage_design', 'attendance', 1.12, 900, 2, null, 1000, 'uncommon'),
('Green Screen Live Compositing', 'Live green screen effects for screens', 'video', 'performance', 1.14, 1100, 3, 'performance_advanced_stage_presence', 1300, 'uncommon'),
('Thermal Camera Feed', 'Show crowd heat map on screens', 'video', 'fame', 1.09, 600, 2, null, 300, 'uncommon');