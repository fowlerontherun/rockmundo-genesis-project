-- Fix network_type constraint to include regional, then add seed data
ALTER TABLE tv_networks DROP CONSTRAINT IF EXISTS tv_networks_network_type_check;
ALTER TABLE tv_networks ADD CONSTRAINT tv_networks_network_type_check 
  CHECK (network_type IN ('local', 'regional', 'national', 'cable', 'streaming'));

-- TV Networks
INSERT INTO tv_networks (name, network_type, country, viewer_base, quality_level, min_fame_required, genres, description) VALUES
('BBC One', 'national', 'United Kingdom', 6000000, 10, 15000, ARRAY['pop', 'rock', 'indie'], 'The flagship BBC television channel'),
('BBC Two', 'national', 'United Kingdom', 3000000, 9, 10000, ARRAY['indie', 'alternative', 'classical'], 'Arts and culture focused BBC channel'),
('ITV', 'national', 'United Kingdom', 5000000, 9, 12000, ARRAY['pop', 'rock'], 'Major commercial broadcaster'),
('Channel 4', 'national', 'United Kingdom', 2500000, 8, 8000, ARRAY['alternative', 'indie', 'electronic'], 'Alternative programming network'),
('Channel 5', 'national', 'United Kingdom', 1500000, 6, 3000, ARRAY['pop', 'rock'], 'Entertainment focused channel'),
('Sky Arts', 'cable', 'United Kingdom', 500000, 8, 5000, ARRAY['classical', 'jazz', 'world'], 'Arts and culture channel'),
('MTV UK', 'cable', 'United Kingdom', 800000, 7, 4000, ARRAY['pop', 'hip-hop', 'r&b', 'rock'], 'Music television network'),
('London Live', 'local', 'United Kingdom', 200000, 5, 500, ARRAY['pop', 'indie', 'rock'], 'London local television'),
('Made in Manchester', 'local', 'United Kingdom', 100000, 4, 200, ARRAY['indie', 'rock'], 'Manchester local channel'),
('STV', 'regional', 'United Kingdom', 300000, 6, 1000, ARRAY['pop', 'rock', 'folk'], 'Scottish Television'),
('Netflix UK', 'streaming', 'Global', 10000000, 10, 30000, ARRAY['pop', 'rock', 'documentary'], 'Streaming giant'),
('Amazon Prime Video', 'streaming', 'Global', 8000000, 9, 25000, ARRAY['pop', 'rock'], 'Amazon streaming service'),
('RTE', 'national', 'Ireland', 1500000, 7, 5000, ARRAY['folk', 'rock', 'pop'], 'Irish national broadcaster'),
('TV3 Sweden', 'national', 'Sweden', 2000000, 7, 6000, ARRAY['pop', 'metal', 'rock'], 'Swedish commercial TV'),
('ZDF', 'national', 'Germany', 4000000, 8, 10000, ARRAY['rock', 'pop', 'classical'], 'German public broadcaster');

-- TV Shows
INSERT INTO tv_shows (network_id, show_name, show_type, host_name, description, days_of_week, time_slot, slots_per_day, viewer_reach, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max, min_fame_required) VALUES
((SELECT id FROM tv_networks WHERE name = 'BBC One'), 'BBC Breakfast', 'morning_show', 'Naga Munchetty', 'Morning news and entertainment', ARRAY[1,2,3,4,5], 'morning', 2, 1500000, 300, 800, 1000, 3000, 2000, 8000, 10000),
((SELECT id FROM tv_networks WHERE name = 'BBC One'), 'The One Show', 'talk_show', 'Alex Jones', 'Evening magazine show', ARRAY[1,2,3,4,5], 'prime_time', 2, 4000000, 500, 1500, 2000, 6000, 5000, 15000, 20000),
((SELECT id FROM tv_networks WHERE name = 'BBC One'), 'Later with Jools Holland', 'music_special', 'Jools Holland', 'Iconic music performance show', ARRAY[5,6], 'late_night', 3, 2000000, 800, 2000, 3000, 8000, 3000, 10000, 15000),
((SELECT id FROM tv_networks WHERE name = 'BBC One'), 'Graham Norton Show', 'talk_show', 'Graham Norton', 'Premier chat show', ARRAY[5], 'late_night', 2, 5000000, 1000, 3000, 4000, 12000, 10000, 30000, 35000),
((SELECT id FROM tv_networks WHERE name = 'ITV'), 'Good Morning Britain', 'morning_show', 'Susanna Reid', 'Morning news programme', ARRAY[1,2,3,4,5], 'morning', 2, 1200000, 250, 700, 800, 2500, 1500, 6000, 8000),
((SELECT id FROM tv_networks WHERE name = 'ITV'), 'Lorraine', 'talk_show', 'Lorraine Kelly', 'Mid-morning chat show', ARRAY[1,2,3,4,5], 'morning', 1, 800000, 200, 500, 600, 1800, 1000, 4000, 5000),
((SELECT id FROM tv_networks WHERE name = 'ITV'), 'This Morning', 'talk_show', 'Cat Deeley', 'Daytime magazine show', ARRAY[1,2,3,4,5], 'morning', 2, 1000000, 250, 600, 700, 2000, 1200, 5000, 6000),
((SELECT id FROM tv_networks WHERE name = 'ITV'), 'Jonathan Ross Show', 'talk_show', 'Jonathan Ross', 'Saturday night chat show', ARRAY[6], 'prime_time', 2, 3000000, 600, 1800, 2500, 7000, 6000, 20000, 25000),
((SELECT id FROM tv_networks WHERE name = 'Channel 4'), 'Sunday Brunch', 'morning_show', 'Tim Lovejoy', 'Sunday morning entertainment', ARRAY[0], 'morning', 2, 600000, 200, 500, 500, 1500, 800, 3000, 4000),
((SELECT id FROM tv_networks WHERE name = 'Channel 4'), 'The Last Leg', 'entertainment', 'Adam Hills', 'Comedy entertainment show', ARRAY[5], 'late_night', 1, 800000, 300, 700, 800, 2000, 1500, 5000, 6000),
((SELECT id FROM tv_networks WHERE name = 'MTV UK'), 'MTV Fresh', 'music_special', NULL, 'New music showcase', ARRAY[1,2,3,4,5], 'afternoon', 2, 200000, 100, 300, 300, 900, 500, 2000, 1000),
((SELECT id FROM tv_networks WHERE name = 'MTV UK'), 'MTV Unplugged', 'music_special', NULL, 'Acoustic performances', ARRAY[6], 'prime_time', 1, 400000, 400, 1000, 1000, 3000, 2000, 8000, 8000),
((SELECT id FROM tv_networks WHERE name = 'London Live'), 'London Tonight', 'news', NULL, 'London evening news', ARRAY[1,2,3,4,5], 'prime_time', 1, 100000, 50, 150, 100, 400, 200, 800, 200),
((SELECT id FROM tv_networks WHERE name = 'London Live'), 'The Music Show', 'music_special', NULL, 'Local music showcase', ARRAY[6], 'afternoon', 2, 50000, 30, 100, 80, 250, 100, 500, 50),
((SELECT id FROM tv_networks WHERE name = 'Sky Arts'), 'Songwriters Circle', 'music_special', NULL, 'Intimate songwriter sessions', ARRAY[0], 'prime_time', 2, 300000, 200, 500, 500, 1500, 1000, 4000, 3000);

-- Newspapers
INSERT INTO newspapers (name, newspaper_type, country, circulation, quality_level, min_fame_required, genres, description, interview_slots_per_day, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max) VALUES
('The Guardian', 'broadsheet', 'United Kingdom', 150000, 9, 8000, ARRAY['indie', 'alternative', 'world'], 'Quality broadsheet newspaper', 2, 200, 600, 500, 1500, 500, 3000),
('The Times', 'broadsheet', 'United Kingdom', 400000, 10, 12000, ARRAY['classical', 'jazz', 'pop'], 'Prestigious broadsheet', 1, 300, 800, 700, 2000, 800, 4000),
('The Telegraph', 'broadsheet', 'United Kingdom', 350000, 9, 10000, ARRAY['rock', 'classical', 'pop'], 'Conservative broadsheet', 1, 250, 700, 600, 1800, 600, 3500),
('The Independent', 'broadsheet', 'United Kingdom', 200000, 8, 5000, ARRAY['indie', 'electronic', 'alternative'], 'Independent quality paper', 2, 150, 500, 400, 1200, 400, 2500),
('The Sun', 'tabloid', 'United Kingdom', 1200000, 5, 3000, ARRAY['pop', 'rock'], 'Best-selling tabloid', 3, 100, 400, 600, 2000, 300, 1500),
('Daily Mail', 'tabloid', 'United Kingdom', 1000000, 5, 4000, ARRAY['pop', 'rock'], 'Popular tabloid', 2, 120, 450, 700, 2200, 400, 2000),
('Daily Mirror', 'tabloid', 'United Kingdom', 500000, 5, 2000, ARRAY['pop', 'rock', 'indie'], 'Left-leaning tabloid', 2, 80, 300, 400, 1200, 200, 1000),
('Evening Standard', 'regional', 'United Kingdom', 800000, 7, 2000, ARRAY['pop', 'indie', 'rock'], 'London evening paper', 2, 100, 350, 300, 1000, 300, 1500),
('Manchester Evening News', 'local', 'United Kingdom', 100000, 5, 200, ARRAY['indie', 'rock'], 'Manchester local paper', 2, 30, 100, 100, 350, 50, 300),
('Glasgow Herald', 'regional', 'United Kingdom', 150000, 6, 500, ARRAY['folk', 'rock', 'indie'], 'Scottish quality paper', 1, 50, 180, 150, 500, 100, 600),
('Irish Times', 'broadsheet', 'Ireland', 100000, 8, 3000, ARRAY['folk', 'rock', 'pop'], 'Irish quality paper', 1, 100, 350, 250, 800, 200, 1200),
('Bild', 'tabloid', 'Germany', 2000000, 5, 5000, ARRAY['pop', 'rock'], 'German tabloid', 2, 150, 500, 800, 2500, 400, 2000),
('Le Monde', 'broadsheet', 'France', 300000, 9, 8000, ARRAY['jazz', 'electronic', 'world'], 'French quality paper', 1, 200, 600, 500, 1500, 500, 3000);

-- Magazines
INSERT INTO magazines (name, magazine_type, country, readership, quality_level, min_fame_required, genres, description, publication_frequency, interview_slots_per_issue, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max) VALUES
('NME', 'music', 'United Kingdom', 500000, 9, 3000, ARRAY['indie', 'rock', 'alternative'], 'Iconic music magazine', 'weekly', 4, 200, 600, 600, 2000, 500, 3000),
('Kerrang', 'music', 'United Kingdom', 300000, 8, 2000, ARRAY['rock', 'metal', 'punk'], 'Rock and metal magazine', 'weekly', 3, 150, 500, 500, 1500, 400, 2500),
('Mojo', 'music', 'United Kingdom', 200000, 9, 5000, ARRAY['rock', 'classic rock', 'folk'], 'Classic rock magazine', 'monthly', 5, 250, 700, 700, 2200, 600, 4000),
('Q Magazine', 'music', 'United Kingdom', 250000, 8, 4000, ARRAY['pop', 'rock', 'indie'], 'Popular music magazine', 'monthly', 4, 200, 600, 600, 1800, 500, 3500),
('Clash Magazine', 'music', 'United Kingdom', 100000, 7, 1500, ARRAY['indie', 'electronic', 'hip-hop'], 'Alternative music mag', 'monthly', 3, 100, 350, 350, 1000, 300, 1500),
('DIY Magazine', 'music', 'United Kingdom', 80000, 6, 500, ARRAY['indie', 'punk', 'alternative'], 'Underground music zine', 'monthly', 4, 60, 200, 200, 700, 100, 800),
('Metal Hammer', 'music', 'United Kingdom', 150000, 7, 1500, ARRAY['metal', 'rock'], 'Heavy metal magazine', 'monthly', 3, 120, 400, 400, 1200, 300, 2000),
('Heat', 'celebrity', 'United Kingdom', 400000, 5, 5000, ARRAY['pop'], 'Celebrity gossip mag', 'weekly', 2, 100, 350, 400, 1200, 200, 1200),
('OK Magazine', 'celebrity', 'United Kingdom', 350000, 5, 6000, ARRAY['pop'], 'Celebrity magazine', 'weekly', 2, 120, 400, 500, 1500, 300, 1500),
('GQ', 'lifestyle', 'United Kingdom', 200000, 9, 10000, ARRAY['pop', 'rock', 'hip-hop'], 'Mens lifestyle magazine', 'monthly', 2, 300, 900, 800, 2500, 800, 5000),
('Vogue', 'lifestyle', 'United Kingdom', 180000, 10, 20000, ARRAY['pop'], 'Fashion and culture bible', 'monthly', 1, 500, 1500, 1500, 5000, 2000, 10000),
('Music Week', 'industry', 'United Kingdom', 50000, 8, 2000, ARRAY['pop', 'rock', 'electronic'], 'Industry trade magazine', 'weekly', 3, 100, 300, 200, 600, 300, 1500),
('Rolling Stone', 'music', 'United States', 500000, 10, 15000, ARRAY['rock', 'pop', 'hip-hop'], 'Legendary music magazine', 'monthly', 3, 400, 1200, 1500, 5000, 1500, 8000),
('Billboard', 'industry', 'United States', 300000, 9, 10000, ARRAY['pop', 'hip-hop', 'rock'], 'Chart and industry mag', 'weekly', 2, 300, 900, 800, 2500, 800, 5000),
('Pitchfork', 'music', 'United States', 400000, 9, 5000, ARRAY['indie', 'electronic', 'hip-hop'], 'Influential online mag', 'weekly', 4, 250, 800, 700, 2200, 500, 3500);

-- YouTube Channels
INSERT INTO youtube_channels (channel_name, channel_type, subscriber_count, avg_views, quality_level, min_fame_required, genres, host_name, description, slots_per_week, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max) VALUES
('BBC Music', 'music', 5000000, 500000, 10, 10000, ARRAY['pop', 'rock', 'indie'], NULL, 'Official BBC Music channel', 3, 300, 900, 1000, 3500, 1000, 5000),
('COLORS', 'music', 8000000, 2000000, 10, 8000, ARRAY['r&b', 'hip-hop', 'soul', 'pop'], NULL, 'Unique performance series', 2, 500, 1500, 2000, 7000, 2000, 8000),
('Tiny Desk Concerts', 'music', 12000000, 3000000, 10, 12000, ARRAY['indie', 'folk', 'rock', 'jazz'], NULL, 'NPR intimate concerts', 1, 800, 2500, 4000, 12000, 0, 2000),
('VEVO UK', 'music', 3000000, 200000, 8, 5000, ARRAY['pop', 'rock', 'hip-hop'], NULL, 'Official music videos', 5, 200, 600, 500, 1800, 500, 2500),
('The Needle Drop', 'reaction', 2000000, 300000, 8, 3000, ARRAY['indie', 'hip-hop', 'electronic'], 'Anthony Fantano', 'Music reviews and interviews', 2, 200, 600, 600, 2000, 0, 1000),
('Genius', 'interview', 6000000, 800000, 9, 6000, ARRAY['hip-hop', 'pop', 'r&b'], NULL, 'Lyrics and artist interviews', 4, 300, 900, 1000, 3500, 800, 4000),
('Audiotree Live', 'music', 500000, 50000, 7, 1000, ARRAY['indie', 'rock', 'folk'], NULL, 'Live session recordings', 3, 100, 350, 300, 1000, 200, 1000),
('Sofar Sounds', 'music', 1000000, 100000, 7, 500, ARRAY['indie', 'folk', 'acoustic'], NULL, 'Intimate house concerts', 5, 80, 250, 250, 800, 100, 600),
('First We Feast', 'interview', 14000000, 5000000, 9, 15000, ARRAY['pop', 'hip-hop', 'rock'], 'Sean Evans', 'Hot Ones interview series', 1, 600, 2000, 3000, 10000, 3000, 15000),
('Zane Lowe', 'interview', 800000, 100000, 9, 8000, ARRAY['pop', 'hip-hop', 'rock'], 'Zane Lowe', 'In-depth artist interviews', 2, 300, 900, 800, 2800, 1000, 5000);

-- Podcasts
INSERT INTO podcasts (podcast_name, podcast_type, listener_base, quality_level, min_fame_required, genres, host_name, description, episodes_per_week, slots_per_episode, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, compensation_min, compensation_max) VALUES
('Desert Island Discs', 'interview', 3000000, 10, 15000, ARRAY['all'], 'Lauren Laverne', 'BBC Radio 4 classic', 1, 1, 400, 1200, 1500, 5000, 2000, 8000),
('Song Exploder', 'music', 500000, 9, 5000, ARRAY['indie', 'rock', 'pop', 'electronic'], 'Hrishikesh Hirway', 'Artists break down their songs', 1, 1, 200, 600, 500, 1800, 500, 2500),
('Broken Record', 'interview', 400000, 9, 8000, ARRAY['rock', 'pop', 'hip-hop'], 'Rick Rubin', 'Music production insights', 1, 1, 250, 800, 700, 2500, 800, 4000),
('Popcast', 'culture', 300000, 8, 3000, ARRAY['pop', 'hip-hop', 'r&b'], 'Jon Caramanica', 'NYT pop music podcast', 1, 2, 150, 500, 400, 1400, 400, 2000),
('Sound Opinions', 'interview', 200000, 8, 2000, ARRAY['rock', 'indie', 'alternative'], 'Jim DeRogatis', 'Music discussion and interviews', 1, 2, 100, 400, 300, 1000, 300, 1500),
('Tape Notes', 'industry', 100000, 7, 1500, ARRAY['pop', 'rock', 'electronic'], 'John Kennedy', 'Behind the music', 1, 1, 80, 300, 200, 700, 200, 1000),
('The Joe Rogan Experience', 'interview', 11000000, 9, 20000, ARRAY['rock', 'hip-hop', 'comedy'], 'Joe Rogan', 'Mega podcast', 2, 1, 600, 2000, 3000, 10000, 5000, 20000),
('Dissect', 'storytelling', 500000, 9, 4000, ARRAY['hip-hop', 'r&b', 'pop'], 'Cole Cuchna', 'Album analysis podcast', 1, 1, 200, 600, 500, 1800, 500, 2500),
('All Songs Considered', 'music', 400000, 8, 2500, ARRAY['indie', 'folk', 'alternative'], 'Bob Boilen', 'NPR music discovery', 1, 2, 150, 500, 400, 1400, 400, 2000),
('Radio 1 Live Lounge', 'music', 2000000, 9, 8000, ARRAY['pop', 'rock', 'indie'], NULL, 'BBC Radio 1 sessions', 5, 1, 300, 1000, 1000, 3500, 1000, 5000),
('Annie Mac Presents', 'interview', 800000, 8, 4000, ARRAY['electronic', 'dance', 'pop'], 'Annie Mac', 'Dance music podcast', 1, 1, 150, 500, 400, 1500, 500, 2500),
('Adam Buxton Podcast', 'interview', 600000, 8, 5000, ARRAY['indie', 'rock', 'comedy'], 'Adam Buxton', 'Ramble chats with artists', 1, 1, 180, 550, 500, 1700, 600, 3000);

-- Film Studios
INSERT INTO film_studios (name, studio_type, country, prestige_level, min_fame_required, description) VALUES
('Universal Pictures UK', 'major', 'United Kingdom', 10, 50000, 'Major Hollywood studio UK branch'),
('Warner Bros UK', 'major', 'United Kingdom', 10, 50000, 'Major studio with UK presence'),
('Working Title Films', 'major', 'United Kingdom', 9, 40000, 'British film production company'),
('Film4 Productions', 'independent', 'United Kingdom', 8, 25000, 'Channel 4 film arm'),
('Vertigo Films', 'independent', 'United Kingdom', 7, 20000, 'British independent studio'),
('Lionsgate UK', 'major', 'United Kingdom', 8, 35000, 'International studio'),
('Netflix Films', 'streaming', 'Global', 9, 45000, 'Netflix original productions'),
('Amazon Studios', 'streaming', 'Global', 8, 40000, 'Amazon original content'),
('BBC Films', 'independent', 'United Kingdom', 8, 30000, 'BBC film production'),
('Pathe UK', 'independent', 'United Kingdom', 7, 25000, 'European film studio');

-- Film Productions
INSERT INTO film_productions (studio_id, title, film_type, genre, description, min_fame_required, compensation_min, compensation_max, fame_boost, fan_boost, filming_duration_days) VALUES
((SELECT id FROM film_studios WHERE name = 'Film4 Productions'), 'Rock Documentary', 'cameo', 'Documentary', 'Music documentary appearance', 25000, 5000, 15000, 2000, 10000, 7),
((SELECT id FROM film_studios WHERE name = 'Vertigo Films'), 'London Nights', 'cameo', 'Drama', 'Brief club scene appearance', 20000, 3000, 10000, 1500, 8000, 7),
((SELECT id FROM film_studios WHERE name = 'BBC Films'), 'British Music Story', 'cameo', 'Documentary', 'Interview and performance', 25000, 8000, 20000, 3000, 15000, 7),
((SELECT id FROM film_studios WHERE name = 'Netflix Films'), 'Music Biopic The Early Years', 'cameo', 'Drama', 'Background musician role', 30000, 10000, 25000, 4000, 18000, 7),
((SELECT id FROM film_studios WHERE name = 'Working Title Films'), 'Festival', 'supporting', 'Comedy', 'Supporting role as festival performer', 50000, 30000, 80000, 8000, 35000, 7),
((SELECT id FROM film_studios WHERE name = 'Lionsgate UK'), 'The Band', 'supporting', 'Drama', 'Band member role', 45000, 25000, 60000, 6000, 28000, 7),
((SELECT id FROM film_studios WHERE name = 'Amazon Studios'), 'Garage Days', 'supporting', 'Comedy', 'Struggling musician role', 40000, 20000, 50000, 5000, 22000, 7),
((SELECT id FROM film_studios WHERE name = 'Film4 Productions'), 'Northern Soul', 'supporting', 'Drama', 'DJ character', 35000, 18000, 45000, 4500, 20000, 7),
((SELECT id FROM film_studios WHERE name = 'Universal Pictures UK'), 'Rockstar', 'lead', 'Drama', 'Lead role as rising star', 100000, 150000, 400000, 25000, 100000, 7),
((SELECT id FROM film_studios WHERE name = 'Warner Bros UK'), 'Vinyl Dreams', 'lead', 'Drama', 'Lead singer biopic', 90000, 120000, 350000, 20000, 85000, 7),
((SELECT id FROM film_studios WHERE name = 'Netflix Films'), 'The Sound', 'lead', 'Thriller', 'Musician thriller lead', 80000, 100000, 300000, 18000, 75000, 7),
((SELECT id FROM film_studios WHERE name = 'Working Title Films'), 'Yesterday 2', 'lead', 'Comedy', 'Musical comedy lead', 120000, 200000, 500000, 30000, 120000, 7);

-- PR Consultants
INSERT INTO pr_consultants (name, specialty, tier, weekly_fee, success_rate, description) VALUES
('Sarah Mitchell PR', 'music', 'basic', 5000, 0.7, 'Local music PR specialist'),
('Stellar Artists Management', 'music', 'premium', 15000, 0.85, 'Established music PR firm'),
('Icon Media Group', 'general', 'elite', 35000, 0.95, 'Top-tier celebrity PR'),
('Rising Star PR', 'music', 'basic', 4000, 0.65, 'Emerging artist specialists'),
('Media Maven', 'general', 'premium', 20000, 0.88, 'Full-service media relations'),
('FilmStar Agency', 'film', 'elite', 50000, 0.92, 'Film industry PR experts'),
('Broadcast Connect', 'general', 'premium', 18000, 0.82, 'TV and radio specialists'),
('Digital Buzz PR', 'music', 'basic', 6000, 0.72, 'Social media and podcast PR');