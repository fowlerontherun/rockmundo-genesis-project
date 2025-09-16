-- Seed initial achievements data
INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards) VALUES
('First Steps', 'Welcome to RockMundo! Your musical journey begins.', 'career', 'common', '🎵', '{}', '{"experience": 100}'),
('First Song', 'Create your first original song.', 'music', 'common', '🎤', '{"songs_created": 1}', '{"experience": 250, "cash": 500}'),
('First Performance', 'Complete your first live performance.', 'performance', 'common', '🎪', '{"gigs_completed": 1}', '{"experience": 300, "fame": 50}'),
('Band Leader', 'Form your first band and recruit members.', 'social', 'uncommon', '👥', '{"bands_created": 1}', '{"experience": 500, "fame": 100}'),
('Rising Star', 'Gain 1000 fame points.', 'fame', 'uncommon', '⭐', '{"fame": 1000}', '{"experience": 750, "cash": 2000}'),
('Skill Master', 'Reach level 80 in any skill.', 'skill', 'rare', '🏆', '{"max_skill": 80}', '{"experience": 1000, "cash": 5000}'),
('Chart Topper', 'Get a song into the top 10 charts.', 'success', 'epic', '📈', '{"chart_position": 10}', '{"experience": 2000, "fame": 1000, "cash": 10000}'),
('Legend', 'Reach level 50 overall.', 'career', 'legendary', '👑', '{"level": 50}', '{"experience": 5000, "fame": 2000, "cash": 25000}')
ON CONFLICT (name) DO NOTHING;

-- Seed equipment items
INSERT INTO public.equipment_items (name, category, subcategory, description, price, rarity, stat_boosts, image_url) VALUES
-- Guitars
('Starter Acoustic Guitar', 'instrument', 'guitar', 'A basic acoustic guitar perfect for beginners.', 500, 'common', '{"guitar": 5}', NULL),
('Electric Guitar Pro', 'instrument', 'guitar', 'Professional electric guitar with excellent tone.', 2500, 'uncommon', '{"guitar": 15, "performance": 5}', NULL),
('Vintage Les Paul', 'instrument', 'guitar', 'Legendary guitar used by rock icons.', 8000, 'rare', '{"guitar": 25, "performance": 15, "songwriting": 10}', NULL),
('Custom Master Guitar', 'instrument', 'guitar', 'Hand-crafted masterpiece with perfect sound.', 25000, 'epic', '{"guitar": 40, "performance": 25, "songwriting": 15}', NULL),

-- Microphones
('Basic Mic', 'equipment', 'microphone', 'Standard microphone for practice sessions.', 200, 'common', '{"vocals": 5}', NULL),
('Studio Condenser Mic', 'equipment', 'microphone', 'Professional recording microphone.', 1500, 'uncommon', '{"vocals": 15, "songwriting": 5}', NULL),
('Vintage Tube Mic', 'equipment', 'microphone', 'Classic microphone with warm, rich tone.', 5000, 'rare', '{"vocals": 25, "performance": 10}', NULL),

-- Amplifiers
('Practice Amp', 'equipment', 'amplifier', 'Small amp perfect for home practice.', 300, 'common', '{"performance": 3}', NULL),
('Stage Amp', 'equipment', 'amplifier', 'Powerful amplifier for live performances.', 1800, 'uncommon', '{"performance": 12, "guitar": 8}', NULL),
('Stadium Stack', 'equipment', 'amplifier', 'Massive amplifier system for large venues.', 12000, 'epic', '{"performance": 30, "guitar": 20, "bass": 15}', NULL),

-- Accessories
('Guitar Pick Set', 'accessory', 'picks', 'High-quality guitar picks for better control.', 50, 'common', '{"guitar": 2}', NULL),
('Stage Outfit', 'clothing', 'outfit', 'Stylish outfit that makes you stand out on stage.', 800, 'uncommon', '{"performance": 8, "fame": 5}', NULL),
('Lucky Charm', 'accessory', 'charm', 'A mysterious charm that brings good fortune.', 2000, 'rare', '{"performance": 5, "songwriting": 5, "vocals": 5}', NULL)
ON CONFLICT (name) DO NOTHING;

-- Seed venues
INSERT INTO public.venues (name, location, venue_type, capacity, base_payment, prestige_level, requirements) VALUES
('Local Coffee Shop', 'Downtown', 'cafe', 50, 200, 1, '{}'),
('Community Center', 'Suburbs', 'community', 150, 500, 1, '{}'),
('The Underground', 'Arts District', 'club', 300, 1000, 2, '{"fame": 100}'),
('City Music Hall', 'Uptown', 'theater', 800, 2500, 3, '{"fame": 500, "performance": 60}'),
('The Arena', 'Sports District', 'arena', 2000, 8000, 4, '{"fame": 2000, "performance": 80}'),
('Festival Grounds', 'Outskirts', 'festival', 5000, 15000, 4, '{"fame": 3000, "band_members": 3}'),
('Stadium', 'Central', 'stadium', 50000, 100000, 5, '{"fame": 10000, "performance": 95, "chart_position": 20}')
ON CONFLICT (name) DO NOTHING;

-- Seed streaming platforms
INSERT INTO public.streaming_platforms (name, description, min_followers, revenue_per_play, icon) VALUES
('SoundStream', 'Popular music streaming platform with millions of users.', 0, 0.003, '🎵'),
('MusicFlow', 'Artist-friendly platform with higher payouts.', 100, 0.005, '🎶'),
('BeatWave', 'Platform focused on emerging artists and discovery.', 50, 0.004, '🌊'),
('RhythmLink', 'Social music platform with community features.', 500, 0.006, '🔗'),
('SonicHub', 'Premium platform for established artists.', 1000, 0.008, '⚡'),
('GlobalTunes', 'Worldwide platform with massive reach.', 2000, 0.007, '🌍')
ON CONFLICT (name) DO NOTHING;