-- Add discovery trigger columns for venue/studio-based discovery
ALTER TABLE public.education_mentors 
ADD COLUMN IF NOT EXISTS discovery_venue_id uuid REFERENCES public.venues(id),
ADD COLUMN IF NOT EXISTS discovery_studio_id uuid REFERENCES public.city_studios(id),
ADD COLUMN IF NOT EXISTS discovery_type text DEFAULT 'exploration' CHECK (discovery_type IN ('exploration', 'venue_gig', 'studio_session', 'automatic'));

-- Update Marcus Stone - Starter Master (London, any day, automatic discovery)
UPDATE education_mentors SET
  city_id = '9f26ad86-51ed-4477-856d-610f14979310', -- London
  available_day = NULL, -- Available any day
  cost = 15000,
  is_discoverable = false, -- Automatically discovered
  discovery_type = 'automatic',
  lore_biography = 'Marcus Stone spent 30 years as a session guitarist in London''s legendary studios before retiring to teach. He played on countless hit records in the 80s and 90s.',
  lore_achievement = 'Session work on over 200 platinum albums',
  discovery_hint = 'Available to all musicians. Find him in London.'
WHERE name = 'Marcus Stone';

-- Burt Backache - Nashville, Wednesdays, discovered at Ryman Auditorium
UPDATE education_mentors SET
  city_id = '2a518758-067c-4d34-8ff6-666a31169fe7', -- Nashville
  available_day = 3, -- Wednesday
  cost = 25000,
  is_discoverable = true,
  discovery_type = 'venue_gig',
  discovery_venue_id = '6fb6a696-0c8d-4967-80be-b4c85830685b', -- Ryman Auditorium
  lore_biography = 'The legendary songwriter behind dozens of country crossover hits. Burt wrote his first #1 at age 19 and never stopped.',
  lore_achievement = 'Wrote 47 Billboard Hot 100 songs',
  discovery_hint = 'Play a gig at the legendary Ryman Auditorium in Nashville to catch his attention.'
WHERE name = 'Burt Backache';

-- Tommy Beats - Sydney, Mondays
UPDATE education_mentors SET
  city_id = '06a16e6b-5888-4046-90d8-dfca01eda238', -- Sydney
  available_day = 1, -- Monday
  cost = 30000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Australian drumming icon who pioneered the fusion of Aboriginal rhythms with rock. His unconventional techniques changed modern drumming.',
  lore_achievement = 'Invented the "Outback Shuffle" technique',
  discovery_hint = 'Explore Sydney on a Monday to find this legendary drummer.'
WHERE name = 'Tommy Beats';

-- Eddie Van Bumdem - Berlin, Fridays
UPDATE education_mentors SET
  city_id = '16cf4b7e-be33-47a4-aa95-777242492a1e', -- Munich (German connection)
  available_day = 5, -- Friday
  cost = 35000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'The Dutch-German guitar virtuoso who defined European hard rock in the 70s. Known for his explosive riffs and theatrical performances.',
  lore_achievement = 'Created the "Bumdem Bounce" riff style',
  discovery_hint = 'Friday nights in Munich, look for the man with the legendary flying V.'
WHERE name = 'Eddie Van Bumdem';

-- Groove Master D - Detroit, Tuesdays, discovered at Detroit studio
UPDATE education_mentors SET
  city_id = '0f6c3eea-29c4-443b-b505-171a6d97c3f5', -- Detroit
  available_day = 2, -- Tuesday
  cost = 20000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Motown legend who laid down the bass lines that defined soul music. His groove pocket is tighter than a sealed drum.',
  lore_achievement = 'Played on every Motown hit from 1965-1978',
  discovery_hint = 'Tuesdays in Detroit, the soul of Motown still beats.'
WHERE name = 'Groove Master D';

-- Charisma King - Atlanta, Saturdays
UPDATE education_mentors SET
  city_id = '872150e0-6fa6-4150-b622-b0f8e60ea6fb', -- Atlanta
  available_day = 6, -- Saturday
  cost = 18000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'The stage presence guru who trained generations of hip-hop and R&B performers. When he walks on stage, every eye follows.',
  lore_achievement = 'Coached 15 Grammy-winning performers',
  discovery_hint = 'Saturday nights in Atlanta, where the stars learn to shine.'
WHERE name = 'Charisma King';

-- Crystal Rhythm - New Orleans, Sundays
UPDATE education_mentors SET
  city_id = '1af689bb-b396-4e60-9c71-2b788ba8e54f', -- New Orleans
  available_day = 0, -- Sunday
  cost = 22000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Jazz drummer extraordinaire who can play any style but makes jazz her home. Her independence between hands is supernatural.',
  lore_achievement = 'First woman to win the Jazz Drummers Guild Award',
  discovery_hint = 'Sunday jazz brunches in New Orleans might reveal a master.'
WHERE name = 'Crystal Rhythm';

-- Diana Voice - Liverpool, Thursdays
UPDATE education_mentors SET
  city_id = '5030bf72-9301-4b8a-80f3-123e72bdb117', -- Liverpool
  available_day = 4, -- Thursday
  cost = 16000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Pop vocal coach from the Beatles'' hometown who has trained chart-topping singers for three decades.',
  lore_achievement = 'Vocal coach for 8 Eurovision winners',
  discovery_hint = 'Thursday evenings in Liverpool, follow the sound of perfect pitch.'
WHERE name = 'Diana Voice';

-- Elena Rodriguez - Buenos Aires, Mondays  
UPDATE education_mentors SET
  city_id = '03074fa3-94d0-450d-9520-092f3461daab', -- Buenos Aires
  available_day = 1, -- Monday
  cost = 19000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Classical guitar master from Argentina who blends flamenco fire with tango soul. Her fingerstyle technique is poetry in motion.',
  lore_achievement = 'Principal guitarist at Teatro Colón for 20 years',
  discovery_hint = 'Monday afternoons in Buenos Aires, where tango meets classical mastery.'
WHERE name = 'Elena Rodriguez';

-- Jake Thunder - Austin, Fridays, discovered at Austin City Limits Live
UPDATE education_mentors SET
  city_id = '8215d23e-5714-478e-9ac8-b7b82994fdc6', -- Austin
  available_day = 5, -- Friday
  cost = 28000,
  is_discoverable = true,
  discovery_type = 'venue_gig',
  discovery_venue_id = 'bb949a16-80f1-408c-aefc-b7f22684e065', -- Austin City Limits Live
  lore_biography = 'Texas shred king whose fingers move faster than lightning. He''s played every genre but speed is his religion.',
  lore_achievement = 'Guinness record for fastest guitar solo (2003)',
  discovery_hint = 'Play Austin City Limits Live and show him what you''ve got.'
WHERE name = 'Jake Thunder';

-- Lyrical Genius - Dublin, Wednesdays
UPDATE education_mentors SET
  city_id = '31f54d08-a832-417a-8db1-3f0900e11b6a', -- Dublin
  available_day = 3, -- Wednesday
  cost = 21000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Irish poet-songwriter whose lyrics have been studied in universities. Every word he writes carries the weight of centuries.',
  lore_achievement = 'Won the Ivor Novello Award three consecutive years',
  discovery_hint = 'Wednesday evenings in Dublin, where words become music.'
WHERE name = 'Lyrical Genius';

-- Melody Maker - Stockholm, Tuesdays
UPDATE education_mentors SET
  city_id = '2e670249-4f15-4089-b3cf-a1c2545bb5fa', -- Stockholm
  available_day = 2, -- Tuesday
  cost = 17000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Swedish pop mastermind behind countless Eurovision hits and ABBA-inspired melodies. She knows what makes a hook unforgettable.',
  lore_achievement = 'Wrote hooks for 50+ platinum singles',
  discovery_hint = 'Tuesdays in Stockholm, the land of perfect pop melodies.'
WHERE name = 'Melody Maker';

-- Mike Blastbeat - Glasgow, Saturdays
UPDATE education_mentors SET
  city_id = '9120351f-07d6-4b6a-bc64-6914d90540a1', -- Glasgow
  available_day = 6, -- Saturday
  cost = 32000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Scottish metal drummer whose blast beats defy physics. He trained with military precision and plays with demonic intensity.',
  lore_achievement = 'Recorded 500+ BPM blast beats on album',
  discovery_hint = 'Saturday nights in Glasgow, where metal lives and breathes.'
WHERE name = 'Mike Blastbeat';

-- Professor Aria - Vienna, Sundays
UPDATE education_mentors SET
  city_id = '3a32d826-cead-4d80-a829-87abda80d991', -- Vienna
  available_day = 0, -- Sunday
  cost = 40000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Former Vienna Philharmonic composer who now shares the secrets of classical technique with rock musicians seeking refinement.',
  lore_achievement = 'Composed for the Vienna State Opera',
  discovery_hint = 'Sunday mornings in Vienna, where classical meets contemporary.'
WHERE name = 'Professor Aria';

-- Sarah Lowend - Chicago, Thursdays
UPDATE education_mentors SET
  city_id = '29809134-e947-408b-9786-6d7b51181548', -- Chicago
  available_day = 4, -- Thursday
  cost = 23000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Chicago jazz bass legend whose walking lines have graced a thousand smoky clubs. She makes the upright sing.',
  lore_achievement = 'House bassist at Green Mill for 15 years',
  discovery_hint = 'Thursday nights in Chicago, where jazz bass walks.'
WHERE name = 'Sarah Lowend';

-- Screaming Steve - Seattle, Mondays
UPDATE education_mentors SET
  city_id = 'ee3d48a3-02a6-495e-95c3-3016a0529302', -- Seattle
  available_day = 1, -- Monday
  cost = 26000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Grunge-era screamer who preserved his voice for 40 years. He knows every technique to project power without damage.',
  lore_achievement = 'Vocal coach for the Seattle grunge movement',
  discovery_hint = 'Mondays in Seattle, where the grunge spirit never died.'
WHERE name = 'Screaming Steve';

-- Stage Commander - Rio de Janeiro, Fridays
UPDATE education_mentors SET
  city_id = '0c9c8a7e-c6b4-4927-932a-8491c2b40a06', -- Rio de Janeiro
  available_day = 5, -- Friday
  cost = 24000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Brazilian carnival performer turned stage coach. He taught rock stars how to own massive festival crowds.',
  lore_achievement = 'Choreographed Rock in Rio headlining performances',
  discovery_hint = 'Friday evenings in Rio, where stage presence meets carnival energy.'
WHERE name = 'Stage Commander';

-- The Producer - Manchester, Wednesdays, discovered at a studio
UPDATE education_mentors SET
  city_id = '8bb73a75-bd57-49b3-9a03-a68f37a19f56', -- Manchester
  available_day = 3, -- Wednesday
  cost = 45000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'The anonymous producer behind countless UK indie hits. Nobody knows his real name, but everyone knows his sound.',
  lore_achievement = 'Produced 12 Mercury Prize nominees',
  discovery_hint = 'Wednesdays in Manchester, seek the mysterious producer.'
WHERE name = 'The Producer';

-- The Showstopper - Miami, Saturdays
UPDATE education_mentors SET
  city_id = '96c964de-4dbd-4bbe-80b7-6c9f68d4ba32', -- Miami
  available_day = 6, -- Saturday
  cost = 50000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'The ultimate show production master who orchestrates spectacles. From pyro to costume changes, she designs complete experiences.',
  lore_achievement = 'Designed tours for 5 stadium-touring artists',
  discovery_hint = 'Saturday nights in Miami, where spectacle becomes art.'
WHERE name = 'The Showstopper';

-- Victor Thunderfingers - São Paulo, Thursdays, discovered at studio
UPDATE education_mentors SET
  city_id = '88e56016-9e1d-45df-9196-f0700c50d017', -- São Paulo
  available_day = 4, -- Thursday
  cost = 35000,
  is_discoverable = true,
  discovery_type = 'exploration',
  lore_biography = 'Brazilian bass virtuoso whose slap technique influenced funk worldwide. His harmonics ring like church bells.',
  lore_achievement = 'Session work on 100+ Brazilian gold records',
  discovery_hint = 'Thursday nights in São Paulo, where bass becomes thunder.'
WHERE name = 'Victor Thunderfingers';

-- Ensure Marcus Stone is auto-discovered for all existing profiles
INSERT INTO player_master_discoveries (profile_id, mentor_id, discovered_at)
SELECT 
  p.id,
  m.id,
  now()
FROM profiles p
CROSS JOIN education_mentors m
WHERE m.name = 'Marcus Stone'
  AND NOT EXISTS (
    SELECT 1 FROM player_master_discoveries pmd 
    WHERE pmd.profile_id = p.id AND pmd.mentor_id = m.id
  );