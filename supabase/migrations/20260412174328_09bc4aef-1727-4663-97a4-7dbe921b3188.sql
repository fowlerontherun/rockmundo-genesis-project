
-- 1. Create radio_hosts table
CREATE TABLE public.radio_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  personality_traits JSONB DEFAULT '{}',
  speciality_genres TEXT[] DEFAULT '{}',
  city_id UUID REFERENCES public.cities(id),
  catchphrase TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.radio_hosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view radio hosts"
  ON public.radio_hosts FOR SELECT USING (true);

-- 2. Add host_id to radio_shows
ALTER TABLE public.radio_shows
  ADD COLUMN host_id UUID REFERENCES public.radio_hosts(id);

-- 3. Seed existing hosts
INSERT INTO public.radio_hosts (name, speciality_genres, bio, catchphrase) VALUES
  ('Annie Mac', ARRAY['EDM','Electronica','House'], 'Legendary electronic music tastemaker and DJ.', 'Let the bass drop!'),
  ('Bob Boilen', ARRAY['Indie/Bedroom Pop','Folk','Rock'], 'NPR veteran and music discovery champion.', 'Tiny Desk, big sound.'),
  ('Bobby Bones', ARRAY['Country','Pop'], 'Americas most-listened-to country radio host.', 'Rise and grind!'),
  ('Bryce Mills', ARRAY['Pop','Modern Rock'], 'High-energy morning show host.', 'Wake up and rock!'),
  ('Carlos Silva', ARRAY['Latin','Reggae'], 'Latin music specialist with global reach.', 'Ritmo y sabor!'),
  ('Chris Moyles', ARRAY['Pop','Rock'], 'Iconic UK breakfast show host.', 'Its Chris Moyles in the morning!'),
  ('Clara Amfo', ARRAY['R&B','Pop','Hip Hop'], 'Award-winning broadcaster and music journalist.', 'Music is everything.'),
  ('Danny Howard', ARRAY['EDM','House','Techno'], 'Dance music authority and remix master.', 'Nothing but the hottest!'),
  ('Dave Thompson', ARRAY['Rock','Blues'], 'Classic rock encyclopedia and storyteller.', 'Lets go back in time.'),
  ('Diplo', ARRAY['EDM','Trap','Dubstep'], 'Global superstar DJ and producer.', 'Mad decent vibes only.'),
  ('DJ Bee Radi', ARRAY['Hip Hop','Boom Bap'], 'Underground hip hop champion.', 'Keep it real, keep it raw.'),
  ('DJ Dave', ARRAY['Pop','EDM'], 'Party starter and crowd pleaser.', 'Hands in the air!'),
  ('DJ Midnight', ARRAY['Synthwave','Ambient','Lo-Fi Hip Hop'], 'Late night vibes curator.', 'After dark, the music speaks.'),
  ('DJ Morning', ARRAY['Pop','Country'], 'Sunrise energy and good vibes.', 'Good morning, music lovers!'),
  ('DJ Noon', ARRAY['Jazz','Blues','Soul'], 'Midday smooth grooves specialist.', 'Smooth sailing from here.'),
  ('DJ Rush', ARRAY['Techno','Industrial'], 'Relentless techno pioneer.', 'No mercy on the dancefloor.'),
  ('DJ Sunset', ARRAY['Trance','Ambient'], 'Golden hour soundscapes.', 'Chase the horizon.'),
  ('DJ Target', ARRAY['Grime','Drill','Hip Hop'], 'UK urban music authority.', 'Target locked!'),
  ('Elvis Duran', ARRAY['Pop','Modern Rock'], 'Legendary morning show host.', 'Its a beautiful day for radio!'),
  ('Gary Davies', ARRAY['Pop','Synthwave'], '80s nostalgia king.', 'Bit of a classic!'),
  ('Greg James', ARRAY['Pop','Indie/Bedroom Pop'], 'BBC Radio 1 breakfast show host.', 'Good morning, this is Greg James!'),
  ('Jamie Theakston', ARRAY['Pop','Rock'], 'Heart FM morning favourite.', 'More music variety!'),
  ('Jo Whiley', ARRAY['Rock','Indie/Bedroom Pop','Electronica'], 'Music broadcasting legend.', 'Music connects us all.'),
  ('Johnny K', ARRAY['Heavy Metal','Punk Rock'], 'Metal and punk radio warrior.', 'Turn it up to 11!'),
  ('Jordan Banjo', ARRAY['Hip Hop','R&B','Pop'], 'Dance and music presenter.', 'Lets get moving!'),
  ('Marvin Humes', ARRAY['R&B','Pop','EDM'], 'Former JLS star turned radio host.', 'Friday feeling all week!'),
  ('Max Weber', ARRAY['Classical','Jazz'], 'Refined classical music presenter.', 'Music for the soul.'),
  ('Raina Douris', ARRAY['Indie/Bedroom Pop','Modern Rock'], 'World Cafe host and music explorer.', 'Discover something new.'),
  ('Roman Kemp', ARRAY['Pop','Hip Hop'], 'Capital FMs golden boy.', 'Wake up with Capital!'),
  ('Ryan Seacrest', ARRAY['Pop'], 'Americas most famous radio host.', 'Seacrest out!'),
  ('Steve Wright', ARRAY['Pop','Rock'], 'Afternoon legend of BBC Radio.', 'Serious jockin!'),
  ('Yuki Tanaka', ARRAY['K-Pop/J-Pop','Electronica'], 'Asian pop culture specialist.', 'Kawaii beats!'),
  ('Zoe Ball', ARRAY['Pop','Rock','Dance'], 'BBC Radio 2 breakfast icon.', 'Morning, gorgeous!');

-- 4. New genre-specific hosts
INSERT INTO public.radio_hosts (name, speciality_genres, bio, catchphrase, personality_traits) VALUES
  ('Soul Sister Serena', ARRAY['Soul','R&B','Gospel'], 'Voice of soul radio for over a decade.', 'Feel it in your soul!', '{"warm": true, "spiritual": true}'),
  ('Funky Phil', ARRAY['Funk','Soul'], 'Keeping the funk alive since the 70s.', 'Get up and get down!', '{"energetic": true, "retro": true}'),
  ('Reverend Beats', ARRAY['Gospel','Soul','R&B'], 'From the church choir to the airwaves.', 'Praise through music!', '{"spiritual": true, "uplifting": true}'),
  ('Grunge Gary', ARRAY['Grunge','Punk Rock','Modern Rock'], 'Seattle veteran who lived through the grunge explosion.', 'Smells like good radio.', '{"rebellious": true, "nostalgic": true}'),
  ('Professor Prog', ARRAY['Progressive Rock','Classical','Ambient'], 'Music theory PhD turned radio host.', '21 minutes? Thats a short song.', '{"intellectual": true, "patient": true}'),
  ('Celtic Claire', ARRAY['Celtic','Folk','World Music'], 'Irish-born world music adventurer.', 'May the music carry you home.', '{"mystical": true, "storyteller": true}'),
  ('DJ Technika', ARRAY['Techno','House','EDM'], 'Berlin techno scene veteran.', 'Four to the floor, nothing more.', '{"minimal": true, "intense": true}'),
  ('Bass Commander', ARRAY['Dubstep','Drum and Bass','EDM'], 'Sub-bass obsessed low-end specialist.', 'Feel it in your chest!', '{"intense": true, "loud": true}'),
  ('Folksy Fiona', ARRAY['Folk','Bluegrass','Country'], 'Acoustic music purist and storyteller.', 'Every song tells a story.', '{"gentle": true, "authentic": true}'),
  ('Industrial Ian', ARRAY['Industrial','Heavy Metal','Electronica'], 'Noise enthusiast and factory floor DJ.', 'Beautiful destruction.', '{"dark": true, "experimental": true}'),
  ('Ambient Alice', ARRAY['Ambient','Lo-Fi Hip Hop','Electronica'], 'Soundscape designer and meditation guide.', 'Close your eyes and listen.', '{"calm": true, "ethereal": true}'),
  ('Trance Master Tom', ARRAY['Trance','EDM','Progressive Rock'], '138 BPM is his resting heart rate.', 'Uplifting energy incoming!', '{"euphoric": true, "spiritual": true}'),
  ('Ska Steve', ARRAY['Ska','Reggae','Punk Rock'], 'Two-tone warrior keeping ska alive.', 'Pick it up, pick it up!', '{"energetic": true, "nostalgic": true}'),
  ('Bluegrass Billy', ARRAY['Bluegrass','Country','Folk'], 'Fifth-generation banjo player from Kentucky.', 'Pickin and grinnin!', '{"authentic": true, "rural": true}'),
  ('House Mother Helen', ARRAY['House','EDM','Techno'], 'Chicago house music historian.', 'House is a feeling.', '{"soulful": true, "knowledgeable": true}'),
  ('DnB Danny', ARRAY['Drum and Bass','Dubstep','Grime'], 'Jungle veteran and breakbeat specialist.', 'Rollers only!', '{"fast": true, "energetic": true}'),
  ('Gospel Grace', ARRAY['Gospel','Soul','R&B'], 'Former choir director spreading joy.', 'Let the spirit move you!', '{"joyful": true, "uplifting": true}');

-- 5. Backfill host_id on existing radio_shows
UPDATE public.radio_shows rs
SET host_id = rh.id
FROM public.radio_hosts rh
WHERE rs.host_name = rh.name AND rs.host_id IS NULL;

-- 6. Insert new radio stations (all local type with city_id, quality 1-5)
-- Detroit = 0f6c3eea, Memphis = b4d3f32e, London = 9f26ad86, Nashville = 2a518758
-- Seattle = ee3d48a3, Dublin = 31f54d08, Berlin = cc1fd801, Amsterdam = de4787a9
-- Chicago = 29809134, Bristol = f3606ebd, Manchester = 8bb73a75, Edinburgh = f082fb21
-- LA = cb7bdfa8, NY = a6d76b84, Sydney = 06a16e6b

-- Soul
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Soul City FM', 'us', 'local', 4, 85000, '94.1 FM', ARRAY['Soul','R&B','Funk'], true, 'The heart and soul of music', '0f6c3eea-29c4-443b-b505-171a6d97c3f5'),
  ('Southern Soul Radio', 'us', 'local', 3, 45000, '101.3 FM', ARRAY['Soul','Gospel','Blues'], true, 'Deep southern soul grooves', 'b4d3f32e-d174-4b55-85e3-e37e4f29fe11'),
  ('Soul Britannia', 'uk', 'local', 4, 62000, '97.5 FM', ARRAY['Soul','R&B','Alt R&B/Neo-Soul'], true, 'British soul at its finest', '9f26ad86-51ed-4477-856d-610f14979310');

-- Funk
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Funk Nation Radio', 'us', 'local', 4, 72000, '95.7 FM', ARRAY['Funk','Soul','R&B'], true, 'Non-stop funk and groove', '0f6c3eea-29c4-443b-b505-171a6d97c3f5'),
  ('Planet Funk', 'uk', 'local', 3, 38000, '88.1 FM', ARRAY['Funk','Soul'], true, 'Funk from around the world', '9f26ad86-51ed-4477-856d-610f14979310'),
  ('Funky Town FM', 'us', 'local', 2, 28000, '88.9 FM', ARRAY['Funk','Hip Hop','Soul'], true, 'Where funk meets hip hop', 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a');

-- Gospel
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Gospel Fire Radio', 'us', 'local', 3, 55000, '91.1 FM', ARRAY['Gospel','Soul','R&B'], true, 'Uplifting gospel music 24/7', 'b4d3f32e-d174-4b55-85e3-e37e4f29fe11'),
  ('Praise FM', 'us', 'local', 4, 92000, '102.5 FM', ARRAY['Gospel','Soul'], true, 'Americas premier gospel station', '2a518758-067c-4d34-8ff6-666a31169fe7'),
  ('Gospel Waves UK', 'uk', 'local', 2, 25000, '106.3 FM', ARRAY['Gospel','Soul','R&B'], true, 'Gospel music across Britain', '8bb73a75-bd57-49b3-9a03-a68f37a19f56');

-- Folk
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Folk Roots Radio', 'uk', 'local', 3, 35000, '89.3 FM', ARRAY['Folk','Celtic','Bluegrass'], true, 'Traditional and contemporary folk', 'f082fb21-717b-4abb-af6e-8cb5556dd072'),
  ('Acoustic Highway', 'us', 'local', 2, 28000, '91.7 FM', ARRAY['Folk','Country','Bluegrass'], true, 'Unplugged music for the soul', '2a518758-067c-4d34-8ff6-666a31169fe7'),
  ('Folk FM', 'ie', 'local', 4, 42000, '98.1 FM', ARRAY['Folk','Celtic','World Music'], true, 'Irelands home of folk music', '31f54d08-a832-417a-8db1-3f0900e11b6a');

-- Grunge
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Grunge Radio Seattle', 'us', 'local', 5, 68000, '107.7 FM', ARRAY['Grunge','Punk Rock','Modern Rock'], true, 'Born in Seattle, loud everywhere', 'ee3d48a3-02a6-495e-95c3-3016a0529302'),
  ('Flannel FM', 'us', 'local', 3, 35000, '93.3 FM', ARRAY['Grunge','Rock','Punk Rock'], true, 'Grunge never died', 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a'),
  ('Dirty Sound Radio', 'au', 'local', 2, 22000, '99.5 FM', ARRAY['Grunge','Heavy Metal','Punk Rock'], true, 'Raw and unfiltered rock', '06a16e6b-5888-4046-90d8-dfca01eda238');

-- Progressive Rock
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Prog Planet Radio', 'uk', 'local', 5, 55000, '96.9 FM', ARRAY['Progressive Rock','Classical','Ambient'], true, 'Epic compositions and sonic journeys', '9f26ad86-51ed-4477-856d-610f14979310'),
  ('The Prog Vault', 'us', 'local', 4, 42000, '103.1 FM', ARRAY['Progressive Rock','Rock','Synthwave'], true, 'Deep cuts and extended jams', 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a'),
  ('Progresivo FM', 'es', 'local', 3, 30000, '99.1 FM', ARRAY['Progressive Rock','Classical','Jazz'], true, 'Progressive music from Spain', '6c2386aa-a874-4c36-b153-8e10376f4a6e');

-- Celtic
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Celtic Heart Radio', 'ie', 'local', 4, 48000, '100.5 FM', ARRAY['Celtic','Folk','World Music'], true, 'The spirit of Celtic music', '31f54d08-a832-417a-8db1-3f0900e11b6a'),
  ('Highland Sounds', 'uk', 'local', 3, 32000, '94.7 FM', ARRAY['Celtic','Folk'], true, 'Scottish and Irish traditional music', 'f082fb21-717b-4abb-af6e-8cb5556dd072'),
  ('Celtic Winds FM', 'uk', 'local', 2, 18000, '88.5 FM', ARRAY['Celtic','Folk','Bluegrass'], true, 'Celtic music in the new world', 'f3606ebd-278a-4bfc-8023-d9f9ebfedbf5');

-- House
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('House Nation Radio', 'us', 'local', 5, 120000, '95.5 FM', ARRAY['House','EDM','Techno'], true, 'Chicago house and beyond', '29809134-e947-408b-9786-6d7b51181548'),
  ('Deep House FM', 'uk', 'local', 4, 85000, '90.7 FM', ARRAY['House','Techno','Ambient'], true, 'Deep grooves 24/7', '9f26ad86-51ed-4477-856d-610f14979310'),
  ('Ibiza House Radio', 'es', 'local', 5, 200000, '99.9 FM', ARRAY['House','EDM','Trance'], true, 'The sound of the White Isle', '82ad6e5d-96a9-40a1-9cfc-b3cc256d1b4a');

-- Techno
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Techno Bunker Radio', 'de', 'local', 5, 150000, '98.3 FM', ARRAY['Techno','House','Industrial'], true, 'Berlin techno straight from the bunker', 'cc1fd801-c4b3-448f-ad55-f307e10e14a0'),
  ('Warehouse FM', 'uk', 'local', 4, 65000, '92.1 FM', ARRAY['Techno','House','EDM'], true, 'Underground techno sounds', '8bb73a75-bd57-49b3-9a03-a68f37a19f56'),
  ('Dark Techno Radio', 'nl', 'local', 3, 40000, '87.9 FM', ARRAY['Techno','Industrial','Ambient'], true, 'Hard-hitting dark techno', 'de4787a9-f69a-44d8-8747-1cb02cae0c1c');

-- Dubstep
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Sub FM', 'uk', 'local', 5, 75000, '87.1 FM', ARRAY['Dubstep','Drum and Bass','Grime'], true, 'Sub-bass culture radio', 'f3606ebd-278a-4bfc-8023-d9f9ebfedbf5'),
  ('Wobble Radio', 'us', 'local', 3, 35000, '104.3 FM', ARRAY['Dubstep','EDM','Trap'], true, 'Maximum wobble minimum compromise', 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a'),
  ('Bass Weight FM', 'uk', 'local', 4, 50000, '91.3 FM', ARRAY['Dubstep','Drum and Bass','Electronica'], true, 'Heavy bass music around the clock', '9f26ad86-51ed-4477-856d-610f14979310');

-- Drum and Bass
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Jungle Frequency', 'uk', 'local', 5, 88000, '89.9 FM', ARRAY['Drum and Bass','Dubstep','Grime'], true, 'From jungle to liquid and everything between', '9f26ad86-51ed-4477-856d-610f14979310'),
  ('DnB FM', 'uk', 'local', 4, 55000, '93.7 FM', ARRAY['Drum and Bass','Dubstep'], true, '174 BPM all day every day', 'f3606ebd-278a-4bfc-8023-d9f9ebfedbf5'),
  ('Breakbeat Radio', 'au', 'local', 3, 30000, '96.3 FM', ARRAY['Drum and Bass','Electronica','EDM'], true, 'Australian drum and bass', '06a16e6b-5888-4046-90d8-dfca01eda238');

-- Ambient
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Ambient Waves', 'uk', 'local', 4, 45000, '86.5 FM', ARRAY['Ambient','Electronica','Lo-Fi Hip Hop'], true, 'Sonic landscapes for the mind', '9f26ad86-51ed-4477-856d-610f14979310'),
  ('Drone Zone Radio', 'us', 'local', 3, 38000, '85.9 FM', ARRAY['Ambient','Classical','Electronica'], true, 'Atmospheric textures and drones', 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a'),
  ('Space Music FM', 'de', 'local', 4, 42000, '88.3 FM', ARRAY['Ambient','Synthwave','Progressive Rock'], true, 'Music from the cosmos', 'cc1fd801-c4b3-448f-ad55-f307e10e14a0');

-- Industrial
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Rust Radio', 'de', 'local', 4, 35000, '87.7 FM', ARRAY['Industrial','Heavy Metal','Electronica'], true, 'Steel and circuits', 'cc1fd801-c4b3-448f-ad55-f307e10e14a0'),
  ('Machine Music FM', 'us', 'local', 3, 28000, '86.1 FM', ARRAY['Industrial','Techno','Electronica'], true, 'Man meets machine', '29809134-e947-408b-9786-6d7b51181548'),
  ('Factory Floor Radio', 'uk', 'local', 2, 18000, '84.5 FM', ARRAY['Industrial','Punk Rock','Electronica'], true, 'Industrial noise from the underground', '8bb73a75-bd57-49b3-9a03-a68f37a19f56');

-- Trance (boost)
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Trance Energy FM', 'nl', 'local', 5, 130000, '97.1 FM', ARRAY['Trance','EDM','Progressive Rock'], true, 'Pure trance energy', 'de4787a9-f69a-44d8-8747-1cb02cae0c1c'),
  ('Uplifting Radio', 'uk', 'local', 4, 65000, '94.3 FM', ARRAY['Trance','EDM','Ambient'], true, 'Uplifting trance 24/7', '9f26ad86-51ed-4477-856d-610f14979310');

-- Bluegrass (boost)
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Banjo Creek Radio', 'us', 'local', 3, 25000, '90.3 FM', ARRAY['Bluegrass','Country','Folk'], true, 'Authentic bluegrass from the hollers', '2a518758-067c-4d34-8ff6-666a31169fe7'),
  ('Mountain Music FM', 'us', 'local', 4, 38000, '92.7 FM', ARRAY['Bluegrass','Folk','Country'], true, 'Appalachian music traditions', '2a518758-067c-4d34-8ff6-666a31169fe7');

-- Ska (boost)
INSERT INTO public.radio_stations (name, country, station_type, quality_level, listener_base, frequency, accepted_genres, is_active, description, city_id) VALUES
  ('Two Tone Radio', 'uk', 'local', 4, 42000, '95.1 FM', ARRAY['Ska','Reggae','Punk Rock'], true, 'Ska and two-tone revival', '9f26ad86-51ed-4477-856d-610f14979310'),
  ('Ska Parade FM', 'us', 'local', 3, 28000, '96.7 FM', ARRAY['Ska','Punk Rock','Reggae'], true, 'Third wave ska and beyond', 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a');
