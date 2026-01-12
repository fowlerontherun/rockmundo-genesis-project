-- Radio jingles and adverts content table
CREATE TABLE public.radio_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('jingle', 'advert')),
  title text NOT NULL,
  script text NOT NULL,
  audio_url text,
  audio_status text DEFAULT 'pending' CHECK (audio_status IN ('pending', 'generating', 'completed', 'failed')),
  voice_id text DEFAULT 'JBFqnCBsd6RMkjVDRZzb',
  category text,
  brand_name text,
  humor_style text CHECK (humor_style IN ('absurd', 'parody', 'cheesy', 'deadpan')),
  duration_seconds integer,
  play_weight integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.radio_content ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Radio content is publicly readable"
ON public.radio_content FOR SELECT
USING (true);

-- Allow authenticated users to manage (for admin)
CREATE POLICY "Authenticated users can manage radio content"
ON public.radio_content FOR ALL
USING (auth.uid() IS NOT NULL);

-- Pre-populate with script templates
INSERT INTO radio_content (content_type, title, script, category, brand_name, humor_style, play_weight) VALUES
-- Station Jingles
('jingle', 'RM Radio Station ID', 'You''re listening to RM Radio! The heartbeat of Rockmundo, playing the best unsigned talent 24/7!', 'station_id', NULL, 'cheesy', 3),
('jingle', 'RM Radio Night Owl', 'It''s late, you''re still up, and so are we. RM Radio, keeping you company all night long.', 'station_id', NULL, 'deadpan', 2),
('jingle', 'RM Radio Weather', 'RM Radio weather update: It''s always sunny in Rockmundo... unless your gig flopped, then it''s raining on your parade.', 'weather', NULL, 'absurd', 1),
('jingle', 'RM Radio Morning Show', 'Good morning Rockmundo! Time to wake up, tune your guitars, and dream of sold-out stadiums!', 'station_id', NULL, 'cheesy', 2),
('jingle', 'RM Radio Hit Station', 'RM Radio! Where unknown bands become legends... or at least get one stream from their mom.', 'station_id', NULL, 'absurd', 2),

-- Fake Adverts
('advert', 'Guitar Strings Insurance', 'Tired of broken strings ruining your big moment? Introducing StringSafe Insurance! For just 5 coins a month, we''ll replace any string that snaps mid-solo. StringSafe: Because your E string shouldn''t end your career!', 'fake_product', 'StringSafe Insurance', 'parody', 2),
('advert', 'Stage Fright Energy Drink', 'New from Rockmundo Labs: Stage Fright Energy Drink! Guaranteed to make you forget you''re playing to 3 people in a half-empty bar. Stage Fright: Drink it before you think about it!', 'fake_product', 'Stage Fright Energy', 'absurd', 2),
('advert', 'Manager Hotline', 'Stuck in a dead-end venue? Fans not growing? Call 1-800-GET-FAME! Our AI-powered managers will book you gigs you''re not qualified for! Side effects may include imposter syndrome and bad reviews.', 'fake_service', 'GET-FAME Hotline', 'absurd', 1),
('advert', 'Vintage Guitar Polish', 'Make your starter guitar look like a vintage Les Paul with Faker''s Guitar Polish! Warning: Does not improve actual sound quality. Faker''s: Looking good is half the battle!', 'fake_product', 'Faker''s Polish', 'parody', 1),
('advert', 'Fan Generator 3000', 'Introducing the Fan Generator 3000! Creates realistic crowd noise to drown out your mistakes! Perfect for open mic nights and awkward silences. Order now and we''ll throw in a free applause track!', 'fake_product', 'Fan Generator 3000', 'absurd', 2),
('advert', 'Rockmundo Premium', 'Upgrade to Rockmundo Premium! Get faster travel, bigger venues, and a 10 percent chance the sound engineer actually shows up on time. Rockmundo Premium: Because regular Rockmundo is hard enough.', 'fake_service', 'Rockmundo Premium', 'deadpan', 2),
('advert', 'Drummer''s Anonymous', 'Are you a drummer who can''t keep time? Join Drummer''s Anonymous! Weekly meetings every Thursday at 8... ish. Because nobody expects you to be on time anyway.', 'fake_service', 'Drummer''s Anonymous', 'absurd', 1),
('advert', 'AutoTune Pro Max', 'Introducing AutoTune Pro Max! Now with 200 percent more pitch correction. Your fans will never know you can''t actually sing. AutoTune Pro Max: Be the star you pretend to be!', 'fake_product', 'AutoTune Pro Max', 'parody', 2),
('advert', 'Groupie Repellent', 'New from Rockmundo Labs: Groupie Repellent Spray! For when you just want to pack up and go home after the gig. One spray and they''ll remember they have work tomorrow.', 'fake_product', 'Groupie Repellent', 'absurd', 1),
('advert', 'Roadie Rental', 'Tired of carrying your own gear? Try Roadie Rental! Professional roadies by the hour. Because your friends stopped helping after the third gig. Roadie Rental: We lift so you don''t have to!', 'fake_service', 'Roadie Rental', 'parody', 1);