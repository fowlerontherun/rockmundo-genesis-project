-- Add 15 new diverse bot accounts for Twaater

INSERT INTO twaater_accounts (id, handle, display_name, bio, owner_type, owner_id, verified, fame_score, created_at)
VALUES
  (gen_random_uuid(), 'RockRadioFM', 'Rock Radio FM 📻', 'Your 24/7 rock station. 🎸', 'bot', '00000000-0000-0000-0000-000000000000', true, 5000, now()),
  (gen_random_uuid(), 'SummerFestHQ', 'Summer Festival Official 🎪', 'The biggest festival! 🎤', 'bot', '00000000-0000-0000-0000-000000000000', true, 8000, now()),
  (gen_random_uuid(), 'RecordDealHQ', 'A&R Central 💼', 'Always scouting talent. 🎯', 'bot', '00000000-0000-0000-0000-000000000000', true, 6000, now()),
  (gen_random_uuid(), 'IndiePodcast', 'The Indie Hour 🎙️', 'Weekly indie deep dives. 🎧', 'bot', '00000000-0000-0000-0000-000000000000', true, 3500, now()),
  (gen_random_uuid(), 'GearReviews', 'Guitar & Gear Daily 🎸', 'Honest gear reviews. 🎛️', 'bot', '00000000-0000-0000-0000-000000000000', false, 2500, now()),
  (gen_random_uuid(), 'MusicJourno', 'Music Journalist 📰', 'Industry analysis. 📝', 'bot', '00000000-0000-0000-0000-000000000000', true, 4000, now()),
  (gen_random_uuid(), 'ConcertPhotog', 'Concert Photography 📸', 'Live music moments. 📷', 'bot', '00000000-0000-0000-0000-000000000000', false, 2000, now()),
  (gen_random_uuid(), 'MerchDrops', 'Merch Collector 👕', 'Tour merch enthusiast. 📦', 'bot', '00000000-0000-0000-0000-000000000000', false, 1500, now()),
  (gen_random_uuid(), 'VinylHunter', 'Vinyl Collector 💿', 'Rare vinyl finds. 🎵', 'bot', '00000000-0000-0000-0000-000000000000', false, 1800, now()),
  (gen_random_uuid(), 'RisingStarAI', 'Rising Star ⭐', 'Indie artist on the rise. 🎤', 'bot', '00000000-0000-0000-0000-000000000000', false, 3000, now()),
  (gen_random_uuid(), 'BeatDropFM', 'Beat Drop FM 🔊', 'Electronic music 24/7. 🎧', 'bot', '00000000-0000-0000-0000-000000000000', true, 4500, now()),
  (gen_random_uuid(), 'MetalZone', 'Metal Zone 🤘', 'All things metal. 🔥', 'bot', '00000000-0000-0000-0000-000000000000', true, 3800, now()),
  (gen_random_uuid(), 'JazzLounge', 'Jazz Lounge 🎷', 'Smooth jazz classics. 🎹', 'bot', '00000000-0000-0000-0000-000000000000', true, 2800, now()),
  (gen_random_uuid(), 'HipHopDaily', 'Hip Hop Daily 🎤', 'Bars and culture. 💯', 'bot', '00000000-0000-0000-0000-000000000000', true, 5500, now()),
  (gen_random_uuid(), 'CountryRoads', 'Country Music Now 🤠', 'Nashville coverage. 🎸', 'bot', '00000000-0000-0000-0000-000000000000', true, 3200, now())
ON CONFLICT (handle) DO NOTHING;

-- Create bot account entries with JSONB cast
INSERT INTO twaater_bot_accounts (id, account_id, bot_type, personality_traits, posting_frequency, is_active)
SELECT gen_random_uuid(), ta.id,
  CASE ta.handle
    WHEN 'RockRadioFM' THEN 'radio_station' WHEN 'SummerFestHQ' THEN 'festival'
    WHEN 'RecordDealHQ' THEN 'record_label' WHEN 'IndiePodcast' THEN 'podcast_host'
    WHEN 'GearReviews' THEN 'gear_reviewer' WHEN 'MusicJourno' THEN 'music_journalist'
    WHEN 'ConcertPhotog' THEN 'concert_photographer' WHEN 'MerchDrops' THEN 'merch_collector'
    WHEN 'VinylHunter' THEN 'vinyl_collector' WHEN 'RisingStarAI' THEN 'npc_artist'
    WHEN 'BeatDropFM' THEN 'radio_station' WHEN 'MetalZone' THEN 'music_fan'
    WHEN 'JazzLounge' THEN 'critic' WHEN 'HipHopDaily' THEN 'influencer'
    WHEN 'CountryRoads' THEN 'music_fan' ELSE 'music_fan' END,
  '["general"]'::jsonb,
  CASE WHEN ta.handle IN ('RockRadioFM', 'SummerFestHQ', 'HipHopDaily', 'BeatDropFM') THEN 'high'
       WHEN ta.handle IN ('RecordDealHQ', 'MusicJourno', 'RisingStarAI', 'MetalZone') THEN 'medium'
       ELSE 'low' END,
  true
FROM twaater_accounts ta
WHERE ta.handle IN ('RockRadioFM', 'SummerFestHQ', 'RecordDealHQ', 'IndiePodcast', 'GearReviews',
  'MusicJourno', 'ConcertPhotog', 'MerchDrops', 'VinylHunter', 'RisingStarAI',
  'BeatDropFM', 'MetalZone', 'JazzLounge', 'HipHopDaily', 'CountryRoads')
AND NOT EXISTS (SELECT 1 FROM twaater_bot_accounts tba WHERE tba.account_id = ta.id);