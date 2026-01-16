-- Sports Events already inserted, now add podcasts with correct column names

-- UK Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Annie Mac''s Changes', 'Annie Mac', 'Former BBC Radio 1 DJ explores stories behind the music.', 'United Kingdom', 850000, 300, 800, 2500, 150, 400, 500, 1500, true),
('Zane Lowe''s OTR', 'Zane Lowe', 'Apple Music''s Zane Lowe takes artists on candid conversations.', 'United Kingdom', 1200000, 500, 1500, 4000, 250, 600, 800, 2500, true),
('Radio 1 Live Lounge Podcast', 'BBC Hosts', 'Behind the scenes of BBC Radio 1''s legendary Live Lounge.', 'United Kingdom', 2000000, 400, 1000, 3000, 200, 500, 700, 2000, true),
('NME Podcast', 'NME Staff', 'The legendary NME magazine deep dives into alternative music.', 'United Kingdom', 500000, 150, 400, 1200, 80, 200, 300, 900, true),
('Desert Island Discs', 'Lauren Laverne', 'BBC Radio 4''s iconic show where guests choose formative music.', 'United Kingdom', 3000000, 800, 2000, 5000, 400, 800, 1500, 4000, true);

-- Germany Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Fritz Unsigned', 'Fritz Radio', 'Berlin''s showcase for unsigned and emerging artists.', 'Germany', 450000, 80, 300, 900, 60, 180, 250, 800, true),
('WDR Rockpalast Sessions', 'WDR Hosts', 'Germany''s legendary Rockpalast live music sessions.', 'Germany', 600000, 200, 500, 1500, 100, 300, 400, 1200, true),
('1LIVE Sessions', '1LIVE Team', 'Germany''s youth radio exclusive sessions.', 'Germany', 700000, 120, 380, 1100, 75, 230, 320, 950, true);

-- Japan Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('J-Wave Tokio Hot 100', 'J-Wave DJs', 'Tokyo''s premier station counts down hottest tracks.', 'Japan', 1500000, 300, 800, 2500, 150, 450, 600, 1800, true),
('Space Shower Music Talk', 'Space Shower Team', 'Japan''s music video channel artist stories.', 'Japan', 900000, 200, 500, 1500, 100, 300, 400, 1200, true);

-- Australia Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Triple J Like a Version', 'Triple J Team', 'Australia''s iconic station features artist covers.', 'Australia', 2500000, 350, 1000, 3000, 200, 550, 750, 2200, true),
('Rage Sessions', 'Rage Hosts', 'Australia''s longest-running music TV show features.', 'Australia', 1800000, 280, 750, 2200, 150, 420, 550, 1700, true);

-- Brazil Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Multishow Música', 'Multishow Team', 'Brazil''s premier music channel interviews.', 'Brazil', 1200000, 250, 600, 1800, 120, 360, 480, 1400, true),
('Rock in Rio Talks', 'Rock in Rio Team', 'From the world''s biggest festival.', 'Brazil', 800000, 300, 700, 2000, 140, 400, 550, 1600, true);

-- France Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Radio Nova Sessions', 'Nova Team', 'Paris'' coolest radio eclectic discoveries.', 'France', 700000, 150, 400, 1200, 80, 240, 320, 950, true),
('Les Inrocks Podcast', 'Les Inrockuptibles', 'France''s legendary culture magazine.', 'France', 500000, 180, 450, 1350, 90, 270, 360, 1080, true);

-- Sweden Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Spotify Studios Stockholm', 'Spotify Team', 'Exclusive sessions from Spotify''s hometown.', 'Sweden', 1500000, 400, 1000, 3000, 200, 550, 700, 2100, true);

-- South Korea Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Melon Music Talk', 'Melon Team', 'Korea''s biggest streaming platform interviews.', 'South Korea', 2000000, 350, 900, 2700, 180, 500, 700, 2000, true),
('Mnet K-Pop Weekly', 'Mnet Hosts', 'Korean music television artist spotlights.', 'South Korea', 1500000, 300, 750, 2250, 150, 420, 560, 1700, true);

-- Canada Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('CBC Music Podcast', 'CBC Music Team', 'Canada''s national broadcaster music.', 'Canada', 900000, 200, 550, 1650, 110, 330, 440, 1320, true);

-- Spain Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Los40 Music Sessions', 'Los40 Team', 'Spain''s biggest pop station acoustic sessions.', 'Spain', 1200000, 200, 550, 1650, 110, 330, 440, 1320, true);

-- Mexico Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Ibero 90.9 Sessions', 'Ibero Radio', 'Mexico City''s legendary university radio.', 'Mexico', 500000, 100, 300, 900, 60, 180, 240, 720, true);

-- South Africa Podcasts
INSERT INTO public.podcasts (podcast_name, host_name, description, country, listener_base, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('5FM Fresh Music', '5FM Team', 'South Africa''s youth radio fresh sounds.', 'South Africa', 600000, 120, 350, 1050, 70, 210, 280, 850, true);