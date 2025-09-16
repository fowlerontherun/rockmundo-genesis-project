-- Check if achievements table is empty and seed basic data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.achievements LIMIT 1) THEN
        INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards) VALUES
        ('First Steps', 'Welcome to RockMundo! Your musical journey begins.', 'career', 'common', '🎵', '{}', '{"experience": 100}'),
        ('First Song', 'Create your first original song.', 'music', 'common', '🎤', '{"songs_created": 1}', '{"experience": 250, "cash": 500}'),
        ('First Performance', 'Complete your first live performance.', 'performance', 'common', '🎪', '{"gigs_completed": 1}', '{"experience": 300, "fame": 50}'),
        ('Band Leader', 'Form your first band and recruit members.', 'social', 'uncommon', '👥', '{"bands_created": 1}', '{"experience": 500, "fame": 100}'),
        ('Rising Star', 'Gain 1000 fame points.', 'fame', 'uncommon', '⭐', '{"fame": 1000}', '{"experience": 750, "cash": 2000}'),
        ('Chart Topper', 'Get a song into the top 10 charts.', 'success', 'epic', '📈', '{"chart_position": 10}', '{"experience": 2000, "fame": 1000, "cash": 10000}');
    END IF;
END $$;

-- Check if equipment_items table is empty and seed basic data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.equipment_items LIMIT 1) THEN
        INSERT INTO public.equipment_items (name, category, subcategory, description, price, rarity, stat_boosts) VALUES
        ('Starter Acoustic Guitar', 'instrument', 'guitar', 'A basic acoustic guitar perfect for beginners.', 500, 'common', '{"guitar": 5}'),
        ('Electric Guitar Pro', 'instrument', 'guitar', 'Professional electric guitar with excellent tone.', 2500, 'uncommon', '{"guitar": 15, "performance": 5}'),
        ('Basic Mic', 'equipment', 'microphone', 'Standard microphone for practice sessions.', 200, 'common', '{"vocals": 5}'),
        ('Studio Condenser Mic', 'equipment', 'microphone', 'Professional recording microphone.', 1500, 'uncommon', '{"vocals": 15, "songwriting": 5}'),
        ('Practice Amp', 'equipment', 'amplifier', 'Small amp perfect for home practice.', 300, 'common', '{"performance": 3}'),
        ('Stage Outfit', 'clothing', 'outfit', 'Stylish outfit that makes you stand out on stage.', 800, 'uncommon', '{"performance": 8, "fame": 5}');
    END IF;
END $$;

-- Check if venues table is empty and seed basic data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.venues LIMIT 1) THEN
        INSERT INTO public.venues (name, location, venue_type, capacity, base_payment, prestige_level, requirements) VALUES
        ('Local Coffee Shop', 'Downtown', 'cafe', 50, 200, 1, '{}'),
        ('Community Center', 'Suburbs', 'community', 150, 500, 1, '{}'),
        ('The Underground', 'Arts District', 'club', 300, 1000, 2, '{"fame": 100}'),
        ('City Music Hall', 'Uptown', 'theater', 800, 2500, 3, '{"fame": 500, "performance": 60}'),
        ('The Arena', 'Sports District', 'arena', 2000, 8000, 4, '{"fame": 2000, "performance": 80}'),
        ('Stadium', 'Central', 'stadium', 50000, 100000, 5, '{"fame": 10000, "performance": 95, "chart_position": 20}');
    END IF;
END $$;

-- Check if streaming_platforms table is empty and seed basic data
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.streaming_platforms LIMIT 1) THEN
        INSERT INTO public.streaming_platforms (name, description, min_followers, revenue_per_play, icon) VALUES
        ('SoundStream', 'Popular music streaming platform with millions of users.', 0, 0.003, '🎵'),
        ('MusicFlow', 'Artist-friendly platform with higher payouts.', 100, 0.005, '🎶'),
        ('BeatWave', 'Platform focused on emerging artists and discovery.', 50, 0.004, '🌊'),
        ('RhythmLink', 'Social music platform with community features.', 500, 0.006, '🔗'),
        ('GlobalTunes', 'Worldwide platform with massive reach.', 2000, 0.007, '🌍');
    END IF;
END $$;