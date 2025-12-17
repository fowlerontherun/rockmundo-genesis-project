-- Add unique constraint on twaater_bot_accounts.account_id if not exists
ALTER TABLE twaater_bot_accounts DROP CONSTRAINT IF EXISTS twaater_bot_accounts_account_id_key;
ALTER TABLE twaater_bot_accounts ADD CONSTRAINT twaater_bot_accounts_account_id_key UNIQUE (account_id);

-- Seed bot accounts with diverse personas
INSERT INTO twaater_accounts (id, owner_type, owner_id, handle, display_name, verified, bio, follower_count, following_count, fame_score)
VALUES 
  -- Music Critics
  ('11111111-1111-1111-1111-111111111001'::uuid, 'bot', '11111111-0000-0000-0000-000000000001'::uuid, 'MusicWeeklyReview', 'Music Weekly', true, '🎵 Your weekly music digest. Breaking down the hottest tracks and hidden gems.', 15420, 342, 8500),
  ('11111111-1111-1111-1111-111111111002'::uuid, 'bot', '11111111-0000-0000-0000-000000000002'::uuid, 'IndieDigger', 'Indie Digger', true, '🔍 Finding the underground sounds you need to hear. Support independent artists!', 8750, 1205, 6200),
  ('11111111-1111-1111-1111-111111111003'::uuid, 'bot', '11111111-0000-0000-0000-000000000003'::uuid, 'ChartAnalyst', 'Chart Analyst 📊', true, 'Breaking down the numbers behind the music. Data-driven insights.', 12300, 89, 7800),
  
  -- Venue Owners
  ('11111111-1111-1111-1111-111111111004'::uuid, 'bot', '11111111-0000-0000-0000-000000000004'::uuid, 'TheSoundRoom', 'The Sound Room', true, '🎤 Live music venue | Booking inquiries welcome | Tonight: Check our feed!', 5620, 890, 4500),
  ('11111111-1111-1111-1111-111111111005'::uuid, 'bot', '11111111-0000-0000-0000-000000000005'::uuid, 'ClubNightlife', 'Club Nightlife', true, '🌙 Where the night comes alive. Best DJs, best vibes.', 9340, 445, 5800),
  ('11111111-1111-1111-1111-111111111006'::uuid, 'bot', '11111111-0000-0000-0000-000000000006'::uuid, 'FestivalGuide', 'Festival Guide', true, '🎪 Your ultimate guide to music festivals. Lineups, tips, and insider info.', 18900, 672, 9200),
  
  -- Industry Insiders
  ('11111111-1111-1111-1111-111111111007'::uuid, 'bot', '11111111-0000-0000-0000-000000000007'::uuid, 'LabelScout', 'Label Scout', true, '🔎 A&R insights | Discovering tomorrow''s stars today | DMs open for demos', 7840, 2340, 6800),
  ('11111111-1111-1111-1111-111111111008'::uuid, 'bot', '11111111-0000-0000-0000-000000000008'::uuid, 'ProducerTips', 'Producer Tips', true, '🎛️ Daily production tips from industry pros. Level up your sound.', 23500, 156, 11000),
  ('11111111-1111-1111-1111-111111111009'::uuid, 'bot', '11111111-0000-0000-0000-000000000009'::uuid, 'TourManagerPro', 'Tour Manager Pro', true, '🚐 Behind the scenes of touring life. Tips for bands on the road.', 4560, 890, 3800),
  
  -- Fans & Influencers  
  ('11111111-1111-1111-1111-111111111010'::uuid, 'bot', '11111111-0000-0000-0000-000000000010'::uuid, 'MusicFanatic99', 'Music Fanatic', false, '🎶 Just here for the music. Will hype your favorite artists!', 2340, 1567, 1200),
  ('11111111-1111-1111-1111-111111111011'::uuid, 'bot', '11111111-0000-0000-0000-000000000011'::uuid, 'ConcertGopher', 'Concert Gopher', false, '📍 Attending every show I can. Reviews and pics from the pit!', 6780, 2890, 3400),
  ('11111111-1111-1111-1111-111111111012'::uuid, 'bot', '11111111-0000-0000-0000-000000000012'::uuid, 'VinylCollector', 'Vinyl Collector', false, '💿 Spinning records since ''95. Physical media forever.', 4120, 567, 2100),
  ('11111111-1111-1111-1111-111111111013'::uuid, 'bot', '11111111-0000-0000-0000-000000000013'::uuid, 'StreamQueen', 'Stream Queen', false, '🎧 Playlist curator | New music every day | 500k+ followers on streaming', 11200, 3450, 5600),
  ('11111111-1111-1111-1111-111111111014'::uuid, 'bot', '11111111-0000-0000-0000-000000000014'::uuid, 'BandwagonRider', 'Bandwagon Rick', false, '🛹 Late to every trend but I make up for it with enthusiasm!', 1890, 4567, 800),
  
  -- News & Updates
  ('11111111-1111-1111-1111-111111111015'::uuid, 'bot', '11111111-0000-0000-0000-000000000015'::uuid, 'TwaaterNews', 'Twaater News', true, '📰 Official news from the Twaater music community. Stay informed.', 45000, 12, 15000),
  ('11111111-1111-1111-1111-111111111016'::uuid, 'bot', '11111111-0000-0000-0000-000000000016'::uuid, 'ChartUpdate', 'Chart Update', true, '📈 Real-time chart movements and music industry stats.', 28700, 45, 12500),
  ('11111111-1111-1111-1111-111111111017'::uuid, 'bot', '11111111-0000-0000-0000-000000000017'::uuid, 'NewReleaseFriday', 'New Release Friday', true, '🆕 Every Friday: The best new music drops. Never miss a release.', 32100, 234, 14000)
ON CONFLICT (handle) DO NOTHING;

-- Link bot accounts to twaater_bot_accounts table
INSERT INTO twaater_bot_accounts (account_id, bot_type, is_active, posting_frequency, personality_traits)
VALUES 
  ('11111111-1111-1111-1111-111111111001'::uuid, 'critic', true, 'medium', '["analytical", "professional", "knowledgeable"]'::jsonb),
  ('11111111-1111-1111-1111-111111111002'::uuid, 'critic', true, 'low', '["enthusiastic", "supportive", "underground"]'::jsonb),
  ('11111111-1111-1111-1111-111111111003'::uuid, 'critic', true, 'medium', '["data-driven", "factual", "precise"]'::jsonb),
  ('11111111-1111-1111-1111-111111111004'::uuid, 'venue_owner', true, 'low', '["welcoming", "local", "community-focused"]'::jsonb),
  ('11111111-1111-1111-1111-111111111005'::uuid, 'venue_owner', true, 'low', '["energetic", "trendy", "party"]'::jsonb),
  ('11111111-1111-1111-1111-111111111006'::uuid, 'venue_owner', true, 'low', '["informative", "excited", "helpful"]'::jsonb),
  ('11111111-1111-1111-1111-111111111007'::uuid, 'industry_insider', true, 'medium', '["professional", "encouraging", "talent-focused"]'::jsonb),
  ('11111111-1111-1111-1111-111111111008'::uuid, 'industry_insider', true, 'medium', '["educational", "technical", "helpful"]'::jsonb),
  ('11111111-1111-1111-1111-111111111009'::uuid, 'industry_insider', true, 'low', '["practical", "experienced", "storytelling"]'::jsonb),
  ('11111111-1111-1111-1111-111111111010'::uuid, 'music_fan', true, 'low', '["passionate", "casual", "reactive"]'::jsonb),
  ('11111111-1111-1111-1111-111111111011'::uuid, 'music_fan', true, 'low', '["excited", "visual", "descriptive"]'::jsonb),
  ('11111111-1111-1111-1111-111111111012'::uuid, 'music_fan', true, 'low', '["nostalgic", "collector", "physical-media"]'::jsonb),
  ('11111111-1111-1111-1111-111111111013'::uuid, 'influencer', true, 'medium', '["trendy", "playlist-focused", "discovery"]'::jsonb),
  ('11111111-1111-1111-1111-111111111014'::uuid, 'music_fan', true, 'low', '["late-adopter", "enthusiastic", "funny"]'::jsonb),
  ('11111111-1111-1111-1111-111111111015'::uuid, 'industry_insider', true, 'high', '["official", "neutral", "informative"]'::jsonb),
  ('11111111-1111-1111-1111-111111111016'::uuid, 'industry_insider', true, 'high', '["factual", "real-time", "statistical"]'::jsonb),
  ('11111111-1111-1111-1111-111111111017'::uuid, 'industry_insider', true, 'high', '["excited", "curated", "timely"]'::jsonb)
ON CONFLICT (account_id) DO NOTHING;