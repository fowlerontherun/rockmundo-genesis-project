-- Reconcile the auth signup trigger and add only baseline rows that are still missing.
-- The base schema already creates public.handle_new_user() and normally installs this trigger.
DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NULL THEN
    RAISE EXCEPTION 'handle_new_user_missing_before_auth_signup_trigger';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;

-- Seed initial achievements without duplicating rows already supplied by the base schema.
INSERT INTO public.achievements (name, description, category, rarity, icon, requirements, rewards)
SELECT seed.name, seed.description, seed.category, seed.rarity, seed.icon, seed.requirements::jsonb, seed.rewards::jsonb
FROM (VALUES
  ('First Steps', 'Welcome to RockMundo! Your musical journey begins.', 'career', 'common', '🎵', '{}', '{"experience": 100}'),
  ('First Song', 'Create your first original song.', 'music', 'common', '🎤', '{"songs_created": 1}', '{"experience": 250, "cash": 500}'),
  ('First Performance', 'Complete your first live performance.', 'performance', 'common', '🎪', '{"gigs_completed": 1}', '{"experience": 300, "fame": 50}'),
  ('Band Leader', 'Form your first band and recruit members.', 'social', 'uncommon', '👥', '{"bands_created": 1}', '{"experience": 500, "fame": 100}'),
  ('Rising Star', 'Gain 1000 fame points.', 'fame', 'uncommon', '⭐', '{"fame": 1000}', '{"experience": 750, "cash": 2000}'),
  ('Skill Master', 'Reach level 80 in any skill.', 'skill', 'rare', '🏆', '{"max_skill": 80}', '{"experience": 1000, "cash": 5000}'),
  ('Chart Topper', 'Get a song into the top 10 charts.', 'success', 'epic', '📈', '{"chart_position": 10}', '{"experience": 2000, "fame": 1000, "cash": 10000}'),
  ('Legend', 'Reach level 50 overall.', 'career', 'legendary', '👑', '{"level": 50}', '{"experience": 5000, "fame": 2000, "cash": 25000}')
) AS seed(name, description, category, rarity, icon, requirements, rewards)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.achievements existing
  WHERE lower(existing.name) = lower(seed.name)
);

-- Seed equipment without duplicating names already present.
INSERT INTO public.equipment_items (name, category, subcategory, description, price, rarity, stat_boosts, image_url)
SELECT seed.name, seed.category, seed.subcategory, seed.description, seed.price, seed.rarity, seed.stat_boosts::jsonb, NULL
FROM (VALUES
  ('Starter Acoustic Guitar', 'instrument', 'guitar', 'A basic acoustic guitar perfect for beginners.', 500, 'common', '{"guitar": 5}'),
  ('Electric Guitar Pro', 'instrument', 'guitar', 'Professional electric guitar with excellent tone.', 2500, 'uncommon', '{"guitar": 15, "performance": 5}'),
  ('Vintage Les Paul', 'instrument', 'guitar', 'Legendary guitar used by rock icons.', 8000, 'rare', '{"guitar": 25, "performance": 15, "songwriting": 10}'),
  ('Custom Master Guitar', 'instrument', 'guitar', 'Hand-crafted masterpiece with perfect sound.', 25000, 'epic', '{"guitar": 40, "performance": 25, "songwriting": 15}'),
  ('Basic Mic', 'equipment', 'microphone', 'Standard microphone for practice sessions.', 200, 'common', '{"vocals": 5}'),
  ('Studio Condenser Mic', 'equipment', 'microphone', 'Professional recording microphone.', 1500, 'uncommon', '{"vocals": 15, "songwriting": 5}'),
  ('Vintage Tube Mic', 'equipment', 'microphone', 'Classic microphone with warm, rich tone.', 5000, 'rare', '{"vocals": 25, "performance": 10}'),
  ('Practice Amp', 'equipment', 'amplifier', 'Small amp perfect for home practice.', 300, 'common', '{"performance": 3}'),
  ('Stage Amp', 'equipment', 'amplifier', 'Powerful amplifier for live performances.', 1800, 'uncommon', '{"performance": 12, "guitar": 8}'),
  ('Stadium Stack', 'equipment', 'amplifier', 'Massive amplifier system for large venues.', 12000, 'epic', '{"performance": 30, "guitar": 20, "bass": 15}'),
  ('Guitar Pick Set', 'accessory', 'picks', 'High-quality guitar picks for better control.', 50, 'common', '{"guitar": 2}'),
  ('Stage Outfit', 'clothing', 'outfit', 'Stylish outfit that makes you stand out on stage.', 800, 'uncommon', '{"performance": 8, "fame": 5}'),
  ('Lucky Charm', 'accessory', 'charm', 'A mysterious charm that brings good fortune.', 2000, 'rare', '{"performance": 5, "songwriting": 5, "vocals": 5}')
) AS seed(name, category, subcategory, description, price, rarity, stat_boosts)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.equipment_items existing
  WHERE lower(existing.name) = lower(seed.name)
);

-- Seed venues without duplicating an existing venue name.
INSERT INTO public.venues (name, location, venue_type, capacity, base_payment, prestige_level, requirements)
SELECT seed.name, seed.location, seed.venue_type, seed.capacity, seed.base_payment, seed.prestige_level, seed.requirements::jsonb
FROM (VALUES
  ('Local Coffee Shop', 'Downtown', 'cafe', 50, 200, 1, '{}'),
  ('Community Center', 'Suburbs', 'community', 150, 500, 1, '{}'),
  ('The Underground', 'Arts District', 'club', 300, 1000, 2, '{"fame": 100}'),
  ('City Music Hall', 'Uptown', 'theater', 800, 2500, 3, '{"fame": 500, "performance": 60}'),
  ('The Arena', 'Sports District', 'arena', 2000, 8000, 4, '{"fame": 2000, "performance": 80}'),
  ('Festival Grounds', 'Outskirts', 'festival', 5000, 15000, 4, '{"fame": 3000, "band_members": 3}'),
  ('Stadium', 'Central', 'stadium', 50000, 100000, 5, '{"fame": 10000, "performance": 95, "chart_position": 20}')
) AS seed(name, location, venue_type, capacity, base_payment, prestige_level, requirements)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.venues existing
  WHERE lower(existing.name) = lower(seed.name)
);

-- Seed streaming platforms without duplicating existing names.
INSERT INTO public.streaming_platforms (name, description, min_followers, revenue_per_play, icon)
SELECT seed.name, seed.description, seed.min_followers, seed.revenue_per_play, seed.icon
FROM (VALUES
  ('SoundStream', 'Popular music streaming platform with millions of users.', 0, 0.003::numeric, '🎵'),
  ('MusicFlow', 'Artist-friendly platform with higher payouts.', 100, 0.005::numeric, '🎶'),
  ('BeatWave', 'Platform focused on emerging artists and discovery.', 50, 0.004::numeric, '🌊'),
  ('RhythmLink', 'Social music platform with community features.', 500, 0.006::numeric, '🔗'),
  ('SonicHub', 'Premium platform for established artists.', 1000, 0.008::numeric, '⚡'),
  ('GlobalTunes', 'Worldwide platform with massive reach.', 2000, 0.007::numeric, '🌍')
) AS seed(name, description, min_followers, revenue_per_play, icon)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.streaming_platforms existing
  WHERE lower(existing.name) = lower(seed.name)
);