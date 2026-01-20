-- Add cooldown_days to magazines and podcasts if missing
ALTER TABLE public.magazines ADD COLUMN IF NOT EXISTS cooldown_days INTEGER DEFAULT 14;
ALTER TABLE public.podcasts ADD COLUMN IF NOT EXISTS cooldown_days INTEGER DEFAULT 14;

-- Seed more TV networks (20 more) with correct columns
INSERT INTO public.tv_networks (name, network_type, country, viewer_base, min_fame_required, min_fans_required, is_active) VALUES
('Channel 5 UK', 'national', 'United Kingdom', 5000000, 3000, 1000, true),
('ITV2', 'national', 'United Kingdom', 4000000, 2000, 500, true),
('RTL Germany', 'national', 'Germany', 8000000, 5000, 2000, true),
('ProSieben', 'national', 'Germany', 6000000, 4000, 1500, true),
('TF1', 'national', 'France', 10000000, 8000, 3000, true),
('France 2', 'national', 'France', 7000000, 5000, 2000, true),
('Rai Uno', 'national', 'Italy', 9000000, 6000, 2500, true),
('Canale 5', 'national', 'Italy', 7000000, 4000, 1500, true),
('Antena 3', 'national', 'Spain', 5000000, 3000, 1000, true),
('TVE', 'national', 'Spain', 6000000, 4000, 1500, true),
('NHK', 'national', 'Japan', 15000000, 10000, 5000, true),
('Fuji TV', 'national', 'Japan', 10000000, 7000, 3000, true),
('KBS', 'national', 'South Korea', 8000000, 6000, 2500, true),
('MBC', 'national', 'South Korea', 7000000, 5000, 2000, true),
('CBC', 'national', 'Canada', 5000000, 3000, 1000, true),
('CTV', 'national', 'Canada', 6000000, 4000, 1500, true),
('Network Ten', 'national', 'Australia', 4000000, 2500, 800, true),
('Channel 7', 'national', 'Australia', 5000000, 3000, 1000, true),
('TV Globo', 'national', 'Brazil', 20000000, 15000, 8000, true),
('SBT', 'national', 'Brazil', 10000000, 8000, 4000, true)
ON CONFLICT DO NOTHING;

-- Seed more magazines (20 more) with correct columns
INSERT INTO public.magazines (name, magazine_type, country, readership, min_fame_required, cooldown_days, is_active, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max) VALUES
('Classic Rock Magazine', 'music', 'United Kingdom', 50000, 2000, 14, true, 100, 400, 30, 100, 10, 50),
('Kerrang!', 'music', 'United Kingdom', 40000, 1500, 14, true, 80, 350, 25, 80, 8, 40),
('MOJO', 'music', 'United Kingdom', 60000, 3000, 21, true, 150, 500, 40, 120, 15, 60),
('Uncut', 'music', 'United Kingdom', 45000, 2500, 14, true, 120, 420, 35, 100, 12, 50),
('Metal Hammer', 'music', 'United Kingdom', 35000, 1000, 14, true, 70, 300, 20, 70, 6, 35),
('Musikexpress', 'music', 'Germany', 50000, 2000, 14, true, 100, 400, 30, 100, 10, 50),
('Rock Hard', 'music', 'Germany', 30000, 1500, 14, true, 75, 320, 22, 75, 7, 38),
('Les Inrockuptibles', 'music', 'France', 40000, 2000, 14, true, 100, 400, 30, 95, 10, 48),
('Rock And Folk', 'music', 'France', 35000, 1500, 14, true, 80, 350, 25, 85, 8, 42),
('Rockerilla', 'music', 'Italy', 25000, 1000, 14, true, 60, 280, 18, 65, 5, 32),
('Rockdelux', 'music', 'Spain', 30000, 1500, 14, true, 75, 320, 22, 75, 7, 38),
('Rockin On', 'music', 'Japan', 80000, 5000, 21, true, 200, 700, 55, 160, 20, 80),
('Music Magazine Japan', 'music', 'Japan', 60000, 3000, 14, true, 150, 550, 42, 130, 15, 65),
('Canadian Musician', 'music', 'Canada', 25000, 1000, 14, true, 60, 280, 18, 65, 5, 32),
('Exclaim Magazine', 'music', 'Canada', 30000, 1500, 14, true, 75, 320, 22, 75, 7, 38),
('Rolling Stone Australia', 'music', 'Australia', 40000, 2000, 21, true, 100, 420, 30, 100, 10, 50),
('Blunt Magazine', 'music', 'Australia', 20000, 800, 14, true, 50, 220, 15, 55, 4, 28),
('Rockin Press Brazil', 'music', 'Brazil', 35000, 1500, 14, true, 80, 350, 25, 85, 8, 42),
('Alternative Press', 'music', 'United States', 100000, 5000, 21, true, 250, 850, 65, 190, 25, 95),
('Revolver Magazine', 'music', 'United States', 80000, 4000, 21, true, 200, 700, 55, 160, 20, 80)
ON CONFLICT DO NOTHING;

-- Seed more podcasts (20 more) with correct columns
INSERT INTO public.podcasts (podcast_name, podcast_type, country, listener_base, min_fame_required, cooldown_days, is_active, host_name, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max) VALUES
('The Rock Show Podcast', 'music', 'United States', 50000, 1000, 14, true, 'Dave Roberts', 50, 200, 20, 60, 5, 25),
('Metal Injection Podcast', 'music', 'United States', 80000, 2000, 14, true, 'Robert Pasbani', 80, 320, 30, 90, 10, 45),
('The Punk Rock MBA', 'music', 'United States', 100000, 3000, 21, true, 'Finn McKenty', 100, 400, 40, 120, 15, 60),
('Broken Record Podcast', 'music', 'United States', 500000, 10000, 30, true, 'Rick Rubin', 500, 2000, 150, 400, 60, 200),
('Switched On Pop', 'music', 'United States', 200000, 5000, 21, true, 'Charlie Harding', 200, 800, 70, 200, 30, 100),
('Sound Opinions Podcast', 'music', 'United States', 150000, 4000, 21, true, 'Jim DeRogatis', 150, 600, 55, 160, 25, 80),
('All Songs Considered', 'music', 'United States', 300000, 6000, 21, true, 'Bob Boilen', 300, 1200, 100, 280, 40, 140),
('Kreative Kontrol', 'music', 'Canada', 40000, 1000, 14, true, 'Vish Khanna', 40, 160, 15, 50, 4, 20),
('Turned Out A Punk', 'music', 'Canada', 60000, 1500, 14, true, 'Damian Abraham', 60, 240, 22, 70, 7, 35),
('The Music Podcast UK', 'music', 'United Kingdom', 80000, 2000, 14, true, 'James Wilson', 80, 320, 30, 90, 10, 45),
('Loud Hailer Podcast', 'music', 'United Kingdom', 30000, 800, 14, true, 'Carrie Dunn', 30, 120, 12, 40, 3, 15),
('Musik Express Podcast', 'music', 'Germany', 50000, 1500, 14, true, 'Max Schmidt', 50, 200, 20, 60, 5, 25),
('RockFM Podcast', 'music', 'Spain', 40000, 1000, 14, true, 'Carlos Vega', 40, 160, 15, 50, 4, 20),
('Rock en Seine Podcast', 'music', 'France', 45000, 1200, 14, true, 'Pierre Dubois', 45, 180, 18, 55, 5, 22),
('J-Rock Talk Podcast', 'music', 'Japan', 60000, 2000, 14, true, 'Yuki Tanaka', 60, 240, 22, 70, 7, 35),
('K-Pop Now Podcast', 'music', 'South Korea', 150000, 5000, 21, true, 'Min-Ji Park', 150, 600, 55, 160, 25, 80),
('Aussie Music Show', 'music', 'Australia', 35000, 1000, 14, true, 'Steve Collins', 35, 140, 14, 45, 3, 18),
('Brazilian Beats Podcast', 'music', 'Brazil', 70000, 2000, 14, true, 'Ricardo Santos', 70, 280, 26, 80, 8, 40),
('Nordic Sounds Podcast', 'music', 'Sweden', 25000, 800, 14, true, 'Erik Johansson', 25, 100, 10, 35, 2, 12),
('Dutch Music Hour', 'music', 'Netherlands', 30000, 1000, 14, true, 'Anna de Vries', 30, 120, 12, 40, 3, 15)
ON CONFLICT DO NOTHING;

-- Seed more websites (15 more) with correct columns
INSERT INTO public.websites (name, website_url, country, traffic_rank, min_fame_required, compensation_min, compensation_max, fame_boost_min, fame_boost_max, fan_boost_min, fan_boost_max, is_active) VALUES
('Consequence of Sound', 'https://consequence.net', 'United States', 5000, 3000, 200, 800, 50, 200, 20, 100, true),
('Stereogum', 'https://stereogum.com', 'United States', 8000, 2000, 150, 600, 40, 150, 15, 80, true),
('Brooklyn Vegan', 'https://brooklynvegan.com', 'United States', 12000, 1500, 100, 500, 30, 120, 10, 60, true),
('The Line of Best Fit', 'https://thelineofbestfit.com', 'United Kingdom', 15000, 1000, 80, 400, 25, 100, 8, 50, true),
('DIY Magazine Online', 'https://diymag.com', 'United Kingdom', 20000, 800, 60, 300, 20, 80, 5, 40, true),
('The 405 Music', 'https://the405.com', 'United Kingdom', 25000, 500, 40, 200, 15, 60, 3, 30, true),
('Metal Injection Site', 'https://metalinjection.net', 'United States', 10000, 1500, 100, 450, 30, 110, 10, 55, true),
('Loudwire', 'https://loudwire.com', 'United States', 6000, 2500, 150, 650, 45, 170, 18, 85, true),
('Indie Shuffle', 'https://indieshuffle.com', 'United States', 18000, 800, 70, 350, 22, 90, 7, 45, true),
('Gigwise', 'https://gigwise.com', 'United Kingdom', 22000, 600, 50, 250, 18, 70, 5, 35, true),
('Clash Magazine Online', 'https://clashmusic.com', 'United Kingdom', 16000, 700, 65, 320, 20, 85, 6, 42, true),
('Exclaim Music Site', 'https://exclaim.ca/music', 'Canada', 25000, 500, 45, 220, 16, 65, 4, 32, true),
('FasterLouder AU', 'https://fasterlouder.com.au', 'Australia', 30000, 400, 35, 180, 12, 50, 3, 25, true),
('Tenho Mais Discos', 'https://tenhomaisdicosquevoce.com', 'Brazil', 35000, 300, 30, 150, 10, 40, 2, 20, true),
('Musikexpress Online', 'https://musikexpress.de', 'Germany', 14000, 700, 60, 280, 18, 75, 5, 38, true)
ON CONFLICT DO NOTHING;