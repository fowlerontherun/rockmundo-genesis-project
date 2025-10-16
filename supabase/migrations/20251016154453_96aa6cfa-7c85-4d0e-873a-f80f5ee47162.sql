-- Create recording producers table
CREATE TABLE IF NOT EXISTS public.recording_producers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  specialty_genre VARCHAR NOT NULL,
  quality_bonus INTEGER NOT NULL DEFAULT 5,
  mixing_skill INTEGER NOT NULL DEFAULT 50,
  mastering_skill INTEGER NOT NULL DEFAULT 50,
  arrangement_skill INTEGER NOT NULL DEFAULT 50,
  cost_per_hour INTEGER NOT NULL DEFAULT 100,
  tier VARCHAR NOT NULL DEFAULT 'budget' CHECK (tier IN ('budget', 'mid', 'premium', 'legendary')),
  bio TEXT,
  past_works TEXT[] DEFAULT '{}',
  grammy_wins INTEGER DEFAULT 0,
  platinum_records INTEGER DEFAULT 0,
  years_experience INTEGER NOT NULL DEFAULT 1,
  is_available BOOLEAN NOT NULL DEFAULT true,
  preferred_genres TEXT[] DEFAULT '{}',
  studio_id UUID REFERENCES public.city_studios(id) ON DELETE SET NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.recording_producers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Producers are viewable by everyone"
  ON public.recording_producers
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage producers"
  ON public.recording_producers
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed some producers
INSERT INTO public.recording_producers (name, specialty_genre, quality_bonus, mixing_skill, mastering_skill, arrangement_skill, cost_per_hour, tier, bio, past_works, grammy_wins, platinum_records, years_experience, preferred_genres) VALUES
-- Legendary Producers
('Rick Rubin', 'Rock', 30, 95, 90, 95, 2500, 'legendary', 'Minimalist producer known for raw, authentic sound. Co-founder of Def Jam Recordings.', 
  ARRAY['Red Hot Chili Peppers - Blood Sugar Sex Magik', 'Johnny Cash - American Recordings', 'System of a Down - Toxicity'],
  9, 25, 45, ARRAY['Rock', 'Hip Hop', 'Metal']),

('Quincy Jones', 'Pop', 30, 98, 95, 98, 3000, 'legendary', 'Legendary producer and composer. 28-time Grammy winner. Produced Thriller.', 
  ARRAY['Michael Jackson - Thriller', 'Frank Sinatra - It Might As Well Be Swing', 'We Are the World'],
  28, 35, 70, ARRAY['Pop', 'Jazz', 'Soul']),

('Dr. Dre', 'Hip Hop', 28, 95, 92, 90, 2800, 'legendary', 'Pioneer of West Coast G-funk. Founded Aftermath Entertainment.', 
  ARRAY['N.W.A - Straight Outta Compton', 'Eminem - The Marshall Mathers LP', 'Snoop Dogg - Doggystyle'],
  6, 18, 40, ARRAY['Hip Hop', 'Rap', 'R&B']),

('Max Martin', 'Pop', 29, 94, 93, 96, 2700, 'legendary', 'Swedish producer with 25 Billboard Hot 100 number-one hits. Master of pop hooks.', 
  ARRAY['Britney Spears - ...Baby One More Time', 'The Weeknd - Blinding Lights', 'Taylor Swift - Shake It Off'],
  5, 40, 35, ARRAY['Pop', 'Dance', 'Electronic']),

-- Premium Producers
('Pharrell Williams', 'R&B', 25, 90, 88, 92, 1800, 'premium', 'Innovative producer, singer, and songwriter. Known for The Neptunes production duo.', 
  ARRAY['Daft Punk - Get Lucky', 'Robin Thicke - Blurred Lines', 'Snoop Dogg - Drop It Like It''s Hot'],
  13, 22, 30, ARRAY['R&B', 'Hip Hop', 'Pop']),

('Timbaland', 'Hip Hop', 24, 92, 86, 89, 1600, 'premium', 'Innovative beatmaker known for unique percussion and futuristic sounds.', 
  ARRAY['Missy Elliott - Work It', 'Justin Timberlake - FutureSex/LoveSounds', 'Aaliyah - One in a Million'],
  4, 15, 32, ARRAY['Hip Hop', 'R&B', 'Pop']),

('Nigel Godrich', 'Alternative', 26, 93, 91, 88, 1700, 'premium', 'Experimental producer. Long-time collaborator with Radiohead. Known for sonic innovation.', 
  ARRAY['Radiohead - OK Computer', 'Beck - Sea Change', 'Paul McCartney - Chaos and Creation in the Backyard'],
  6, 8, 28, ARRAY['Alternative', 'Rock', 'Electronic']),

('Linda Perry', 'Rock', 23, 87, 85, 90, 1500, 'premium', 'Former 4 Non Blondes singer turned powerhouse producer for female rock artists.', 
  ARRAY['Pink - Missundaztood', 'Christina Aguilera - Beautiful', 'Gwen Stefani - What You Waiting For?'],
  2, 10, 25, ARRAY['Rock', 'Pop', 'Alternative']),

-- Mid-tier Producers
('Butch Vig', 'Alternative', 20, 85, 82, 84, 1000, 'mid', 'Grunge era producer. Drummer for Garbage. Known for polished alternative rock sound.', 
  ARRAY['Nirvana - Nevermind', 'Smashing Pumpkins - Siamese Dream', 'Foo Fighters - Wasting Light'],
  1, 12, 35, ARRAY['Alternative', 'Rock', 'Grunge']),

('Steve Albini', 'Indie', 19, 88, 80, 75, 900, 'mid', 'Indie rock engineer known for raw, uncompromising analog recordings. Refuses producer credit.', 
  ARRAY['Pixies - Surfer Rosa', 'Nirvana - In Utero', 'PJ Harvey - Rid of Me'],
  0, 5, 40, ARRAY['Indie', 'Alternative', 'Punk']),

('Danger Mouse', 'Electronic', 21, 86, 84, 87, 1100, 'mid', 'Genre-blending producer. Known for creative sampling and psychedelic production.', 
  ARRAY['Gnarls Barkley - Crazy', 'The Black Keys - El Camino', 'Gorillaz - Demon Days'],
  6, 8, 22, ARRAY['Electronic', 'Hip Hop', 'Alternative']),

('Sylvia Massy', 'Metal', 20, 84, 81, 82, 950, 'mid', 'Creative engineer known for experimental recording techniques and heavy rock expertise.', 
  ARRAY['Tool - Undertow', 'System of a Down - Self-titled', 'Johnny Cash - Unchained'],
  1, 7, 30, ARRAY['Metal', 'Rock', 'Alternative']),

-- Budget Producers
('Jake One', 'Hip Hop', 15, 75, 70, 78, 600, 'budget', 'Up-and-coming hip hop producer with underground street credibility.', 
  ARRAY['50 Cent - The Funeral', 'De La Soul - All Good?', 'Brother Ali - The Truth Is Here'],
  0, 2, 15, ARRAY['Hip Hop', 'Rap']),

('Emily Lazar', 'Electronic', 16, 78, 82, 72, 650, 'budget', 'First female mastering engineer to win Grammy. Specializes in electronic music.', 
  ARRAY['Beck - Colors', 'Vampire Weekend - Modern Vampires of the City', 'Haim - Days Are Gone'],
  3, 5, 20, ARRAY['Electronic', 'Pop', 'Indie']),

('Dave Cobb', 'Country', 17, 80, 76, 79, 700, 'budget', 'Nashville producer bringing raw, authentic sound back to country music.', 
  ARRAY['Chris Stapleton - Traveller', 'Jason Isbell - Southeastern', 'Sturgill Simpson - Metamodern Sounds'],
  4, 3, 18, ARRAY['Country', 'Americana', 'Rock']),

('J. Cole', 'Hip Hop', 14, 74, 72, 80, 550, 'budget', 'Rapper-producer crafting introspective beats with jazz and soul samples.', 
  ARRAY['J. Cole - 2014 Forest Hills Drive', 'Kendrick Lamar - various tracks', 'Various mixtapes'],
  1, 6, 12, ARRAY['Hip Hop', 'Rap', 'R&B']);

-- Create indexes for performance
CREATE INDEX idx_recording_producers_tier ON public.recording_producers(tier);
CREATE INDEX idx_recording_producers_specialty ON public.recording_producers(specialty_genre);
CREATE INDEX idx_recording_producers_available ON public.recording_producers(is_available);
CREATE INDEX idx_recording_producers_studio ON public.recording_producers(studio_id);

-- Create updated_at trigger
CREATE TRIGGER update_recording_producers_updated_at
  BEFORE UPDATE ON public.recording_producers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();