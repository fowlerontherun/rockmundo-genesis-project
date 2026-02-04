-- ======================================================
-- LEGENDARY MASTERS EXPANSION MIGRATION
-- Add cities, mentors, achievement discovery, and events
-- ======================================================

-- Part 1: Add missing cities for mentor locations
-- ======================================================

INSERT INTO cities (id, name, country, population, cost_of_living, music_scene, local_bonus, dominant_genre, latitude, longitude, region, timezone)
VALUES 
  (gen_random_uuid(), 'Memphis', 'USA', 633104, 65, 85, 15, 'blues', 35.1495, -90.0490, 'North America', 'America/Chicago'),
  (gen_random_uuid(), 'Kingston', 'Jamaica', 1041203, 55, 90, 20, 'reggae', 17.9714, -76.7936, 'Caribbean', 'America/Jamaica'),
  (gen_random_uuid(), 'Havana', 'Cuba', 2130517, 45, 88, 18, 'latin', 23.1136, -82.3666, 'Caribbean', 'America/Havana'),
  (gen_random_uuid(), 'Detroit', 'USA', 639111, 60, 87, 16, 'hip_hop', 42.3314, -83.0458, 'North America', 'America/Detroit'),
  (gen_random_uuid(), 'Nashville', 'USA', 715884, 70, 92, 18, 'country', 36.1627, -86.7816, 'North America', 'America/Chicago'),
  (gen_random_uuid(), 'Atlanta', 'USA', 498715, 72, 88, 17, 'hip_hop', 33.7490, -84.3880, 'North America', 'America/New_York')
ON CONFLICT DO NOTHING;

-- Part 2: Add achievement discovery column to education_mentors
-- ======================================================

ALTER TABLE education_mentors
ADD COLUMN IF NOT EXISTS discovery_achievement_id uuid REFERENCES achievements(id);

-- Part 3: Add new legendary masters
-- ======================================================

DO $$
DECLARE
  v_memphis_id uuid;
  v_kingston_id uuid;
  v_havana_id uuid;
  v_detroit_id uuid;
  v_berlin_id uuid;
  v_los_angeles_id uuid;
  v_ibiza_id uuid;
  v_tokyo_id uuid;
  v_new_york_id uuid;
  v_new_orleans_id uuid;
  v_london_id uuid;
  v_rio_id uuid;
  v_seoul_id uuid;
  v_las_vegas_id uuid;
  v_paris_id uuid;
  v_amsterdam_id uuid;
  v_vienna_id uuid;
  v_prague_id uuid;
  v_lagos_id uuid;
  v_nashville_id uuid;
  v_dublin_id uuid;
  v_atlanta_id uuid;
BEGIN
  -- Get city IDs
  SELECT id INTO v_berlin_id FROM cities WHERE name = 'Berlin' LIMIT 1;
  SELECT id INTO v_los_angeles_id FROM cities WHERE name = 'Los Angeles' LIMIT 1;
  SELECT id INTO v_ibiza_id FROM cities WHERE name = 'Ibiza' LIMIT 1;
  SELECT id INTO v_tokyo_id FROM cities WHERE name = 'Tokyo' LIMIT 1;
  SELECT id INTO v_new_york_id FROM cities WHERE name = 'New York' LIMIT 1;
  SELECT id INTO v_new_orleans_id FROM cities WHERE name = 'New Orleans' LIMIT 1;
  SELECT id INTO v_london_id FROM cities WHERE name = 'London' LIMIT 1;
  SELECT id INTO v_rio_id FROM cities WHERE name = 'Rio de Janeiro' LIMIT 1;
  SELECT id INTO v_seoul_id FROM cities WHERE name = 'Seoul' LIMIT 1;
  SELECT id INTO v_las_vegas_id FROM cities WHERE name = 'Las Vegas' LIMIT 1;
  SELECT id INTO v_paris_id FROM cities WHERE name = 'Paris' LIMIT 1;
  SELECT id INTO v_amsterdam_id FROM cities WHERE name = 'Amsterdam' LIMIT 1;
  SELECT id INTO v_vienna_id FROM cities WHERE name = 'Vienna' LIMIT 1;
  SELECT id INTO v_prague_id FROM cities WHERE name = 'Prague' LIMIT 1;
  SELECT id INTO v_lagos_id FROM cities WHERE name = 'Lagos' LIMIT 1;
  SELECT id INTO v_nashville_id FROM cities WHERE name = 'Nashville' LIMIT 1;
  SELECT id INTO v_dublin_id FROM cities WHERE name = 'Dublin' LIMIT 1;
  SELECT id INTO v_atlanta_id FROM cities WHERE name = 'Atlanta' LIMIT 1;
  SELECT id INTO v_memphis_id FROM cities WHERE name = 'Memphis' LIMIT 1;
  SELECT id INTO v_kingston_id FROM cities WHERE name = 'Kingston' LIMIT 1;
  SELECT id INTO v_havana_id FROM cities WHERE name = 'Havana' LIMIT 1;
  SELECT id INTO v_detroit_id FROM cities WHERE name = 'Detroit' LIMIT 1;
  
  -- Production & Recording Masters
  INSERT INTO education_mentors (name, focus_skill, description, specialty, cost, cooldown_hours, base_xp, difficulty, attribute_keys, required_skill_value, skill_gain_ratio, bonus_description, city_id, available_day, lore_biography, discovery_hint, discovery_type, is_discoverable)
  VALUES
    ('Dr. Dub', 'songwriting_basic_composing', 'The godfather of dub production who shaped reggae''s psychedelic sound.', 'Dub & Reggae Production', 45000, 168, 1200, 'advanced', '["creativity", "focus"]'::jsonb, 15, 1.4, '+3 Creativity, +2 Focus', v_kingston_id, 2, 'In the smoky studios of Kingston, Dr. Dub pioneered the art of the remix before it had a name.', 'Record at a reggae studio to meet the dub architect', 'studio_session', true),
    ('Nina Frequency', 'genres_basic_electronica', 'Berlin''s queen of analog synthesis and sound design.', 'Sound Design & Synthesis', 55000, 168, 1300, 'advanced', '["creativity", "focus"]'::jsonb, 20, 1.5, '+4 Creativity, +2 Focus', v_berlin_id, 4, 'Nina Frequency built synthesizers from scrap electronics in East Berlin before the wall fell.', 'Thursday nights in Kreuzberg, follow the bassline', 'exploration', true),
    ('The Architect', 'songwriting_basic_composing', 'Hollywood''s most sought-after record producer with 50+ platinum albums.', 'Record Production', 150000, 168, 2500, 'advanced', '["charisma", "focus"]'::jsonb, 30, 1.8, '+5 Charisma, +4 Focus', v_los_angeles_id, 1, 'The Architect earned his name by constructing perfect pop records like blueprints.', 'The Hollywood studios know his number', 'studio_session', true),
    ('DJ Phantom', 'genres_basic_edm', 'The invisible hand behind Ibiza''s biggest club anthems.', 'DJ & EDM Production', 75000, 168, 1600, 'advanced', '["stamina", "charisma"]'::jsonb, 25, 1.6, '+4 Stamina, +3 Charisma', v_ibiza_id, 6, 'No one has seen DJ Phantom''s face, but everyone has danced to his drops.', 'Headline at Amnesia to catch his attention', 'venue_gig', true),
    ('Madame Analog', 'songwriting_basic_composing', 'Tokyo''s reclusive master of vintage recording techniques.', 'Analog Recording & DAW', 65000, 168, 1400, 'advanced', '["focus", "creativity"]'::jsonb, 22, 1.5, '+4 Focus, +3 Creativity', v_tokyo_id, 3, 'Madame Analog refuses to touch anything digital.', 'She only teaches those who respect the old ways', 'exploration', true),
    ('The Sampler King', 'genres_basic_hip_hop', 'Brooklyn legend who turned crate-digging into an art form.', 'Sampling & Remixing', 50000, 168, 1100, 'intermediate', '["creativity", "focus"]'::jsonb, 18, 1.4, '+3 Creativity, +3 Focus', v_new_york_id, 5, 'Before sample clearance was a thing, The Sampler King was flipping obscure records into gold.', 'Brooklyn warehouses hold his secrets', 'exploration', true);

  -- Genre Specialists
  INSERT INTO education_mentors (name, focus_skill, description, specialty, cost, cooldown_hours, base_xp, difficulty, attribute_keys, required_skill_value, skill_gain_ratio, bonus_description, city_id, available_day, lore_biography, discovery_hint, discovery_type, is_discoverable)
  VALUES
    ('Bluesman Jack', 'genres_basic_blues', 'The last living link to the Delta blues tradition.', 'Blues Guitar & Soul', 35000, 168, 1000, 'intermediate', '["creativity", "stamina"]'::jsonb, 12, 1.3, '+3 Creativity, +2 Stamina', v_memphis_id, 5, 'Bluesman Jack learned guitar sitting on Muddy Waters'' porch. At 82, his fingers still bend notes that make grown men weep.', 'Play Beale Street to earn his respect', 'venue_gig', true),
    ('Salsa Queen Rosa', 'genres_basic_latin', 'Havana''s undisputed queen of salsa and Afro-Cuban rhythms.', 'Latin & Salsa', 40000, 168, 1050, 'intermediate', '["charisma", "stamina"]'::jsonb, 14, 1.35, '+3 Charisma, +3 Stamina', v_havana_id, 5, 'Rosa danced with Tito Puente and sang with Celia Cruz.', 'She dances on Friday evenings by the Malecón', 'exploration', true),
    ('MC Prophet', 'genres_basic_hip_hop', 'The Bronx godfather who witnessed hip-hop''s birth.', 'Hip Hop & Lyricism', 55000, 168, 1250, 'intermediate', '["creativity", "charisma"]'::jsonb, 18, 1.45, '+4 Creativity, +3 Charisma', v_new_york_id, 1, 'MC Prophet was there when Herc threw the first block party.', 'The Bronx remembers those who pay homage', 'exploration', true),
    ('Count Jazzula', 'genres_basic_jazz', 'New Orleans'' most eccentric jazz virtuoso.', 'Jazz Improvisation', 60000, 168, 1350, 'advanced', '["creativity", "focus"]'::jsonb, 22, 1.5, '+4 Creativity, +4 Focus', v_new_orleans_id, 6, 'They call him Count Jazzula because he only performs after midnight.', 'Midnight at Preservation Hall reveals him', 'venue_gig', true),
    ('Synth Lord', 'genres_basic_edm', 'Berlin techno pioneer who invented the four-on-the-floor industrial sound.', 'Techno & EDM', 70000, 168, 1500, 'advanced', '["stamina", "focus"]'::jsonb, 25, 1.55, '+4 Stamina, +4 Focus', v_berlin_id, 0, 'Synth Lord opened Berghain''s doors on the first night.', 'Pack Berghain and he''ll find you', 'venue_gig', true),
    ('Punk Patriarch', 'genres_basic_punk_rock', 'The original Camden punk who spat at the establishment.', 'Punk Rock & Attitude', 30000, 168, 900, 'beginner', '["charisma", "stamina"]'::jsonb, 8, 1.2, '+3 Charisma, +2 Stamina', v_london_id, 6, 'The Patriarch was there when the Pistols played their first gig.', 'Camden Market punks whisper his name', 'exploration', true),
    ('Samba Master Rafa', 'genres_basic_latin', 'Rio''s legendary carnival bandleader with 40 years of sambódromo experience.', 'Samba & Brazilian Music', 45000, 168, 1100, 'intermediate', '["charisma", "stamina"]'::jsonb, 16, 1.4, '+4 Charisma, +3 Stamina', v_rio_id, 0, 'Rafa led the Mangueira samba school to 15 championships.', 'Carnival knows his rhythm', 'exploration', true),
    ('K-Pop Sensei', 'genres_basic_k_pop_j_pop', 'Seoul''s secret weapon behind multiple idol group debuts.', 'K-Pop Production & Performance', 85000, 168, 1700, 'advanced', '["charisma", "focus"]'::jsonb, 28, 1.6, '+5 Charisma, +4 Focus', v_seoul_id, 3, 'Before the Hallyu wave swept the world, K-Pop Sensei was training idols in Gangnam.', 'The trainees know where he teaches', 'studio_session', true);

  -- Performance & Showmanship Masters
  INSERT INTO education_mentors (name, focus_skill, description, specialty, cost, cooldown_hours, base_xp, difficulty, attribute_keys, required_skill_value, skill_gain_ratio, bonus_description, city_id, available_day, lore_biography, discovery_hint, discovery_type, is_discoverable)
  VALUES
    ('The Hypnotist', 'showmanship_basic_stage_presence', 'Las Vegas headliner who commands audiences of 50,000.', 'Crowd Control & Interaction', 95000, 168, 1800, 'advanced', '["charisma", "stamina"]'::jsonb, 30, 1.65, '+5 Charisma, +4 Stamina', v_las_vegas_id, 6, 'The Hypnotist once held a stadium silent for three minutes with just eye contact.', 'Fill an arena on The Strip', 'venue_gig', true),
    ('Madam Mystique', 'showmanship_basic_stage_presence', 'Parisian cabaret legend and master of theatrical performance.', 'Showmanship & Theater', 65000, 168, 1400, 'advanced', '["charisma", "creativity"]'::jsonb, 24, 1.5, '+4 Charisma, +4 Creativity', v_paris_id, 4, 'From the stages of the Moulin Rouge to sold-out arenas, Madam Mystique transforms.', 'She observes from Le Marais cafes', 'exploration', true),
    ('Loop Wizard', 'showmanship_basic_stage_presence', 'Amsterdam street performer who mastered live looping.', 'Live Looping & One-Man-Band', 40000, 168, 1000, 'intermediate', '["creativity", "focus"]'::jsonb, 15, 1.35, '+3 Creativity, +3 Focus', v_amsterdam_id, 2, 'The Loop Wizard built his career one layer at a time on the Leidseplein.', 'The canals echo his experiments', 'exploration', true),
    ('Viral Vince', 'showmanship_basic_stage_presence', 'Social media mastermind with 50 million followers.', 'Social Media Performance', 80000, 168, 1600, 'advanced', '["charisma", "focus"]'::jsonb, 26, 1.55, '+5 Charisma, +3 Focus', v_los_angeles_id, 1, 'Vince cracked the algorithm before anyone knew what that meant.', 'Reach 100k followers to unlock', 'exploration', true);

  -- Instrument Virtuosos
  INSERT INTO education_mentors (name, focus_skill, description, specialty, cost, cooldown_hours, base_xp, difficulty, attribute_keys, required_skill_value, skill_gain_ratio, bonus_description, city_id, available_day, lore_biography, discovery_hint, discovery_type, is_discoverable)
  VALUES
    ('Ivory Empress', 'songwriting_basic_composing', 'Classical pianist who bridges baroque and modern music.', 'Piano & Classical Technique', 75000, 168, 1550, 'advanced', '["focus", "creativity"]'::jsonb, 28, 1.55, '+4 Focus, +4 Creativity', v_vienna_id, 0, 'The Ivory Empress played Rachmaninoff at age 8 and jazz with Herbie Hancock at 20.', 'Play the Musikverein to earn an audience', 'venue_gig', true),
    ('String Theory', 'instruments_basic_acoustic_guitar', 'Prague''s avant-garde string arranger.', 'Strings & Orchestration', 55000, 168, 1300, 'advanced', '["focus", "creativity"]'::jsonb, 22, 1.5, '+4 Focus, +3 Creativity', v_prague_id, 4, 'String Theory reimagined how rock bands use orchestras.', 'The classical halls know her touch', 'exploration', true),
    ('Brass Baron', 'instruments_basic_acoustic_guitar', 'New Orleans brass band legend keeping the tradition alive.', 'Brass & Wind Instruments', 35000, 168, 950, 'intermediate', '["stamina", "charisma"]'::jsonb, 12, 1.3, '+3 Stamina, +2 Charisma', v_new_orleans_id, 0, 'The Baron has played every second-line parade for 45 years.', 'Second Line parades reveal him', 'exploration', true),
    ('Percussion Prophet', 'instruments_basic_drum_kit', 'Lagos polyrhythm master bridging African and Western drumming.', 'Percussion & Polyrhythm', 50000, 168, 1200, 'advanced', '["stamina", "focus"]'::jsonb, 20, 1.45, '+4 Stamina, +3 Focus', v_lagos_id, 3, 'The Percussion Prophet studied with Fela Kuti''s drummers.', 'The talking drums carry his message', 'exploration', true),
    ('Steel Fingers', 'instruments_basic_acoustic_guitar', 'Nashville''s most recorded session guitarist.', 'Acoustic & Country Guitar', 60000, 168, 1350, 'advanced', '["focus", "creativity"]'::jsonb, 24, 1.5, '+4 Focus, +3 Creativity', v_nashville_id, 2, 'Steel Fingers has played on more country #1 hits than anyone alive.', 'Country legends remember his sessions', 'venue_gig', true),
    ('Bass Prophet', 'instruments_basic_bass_guitar', 'Detroit funk and Motown bass innovator.', 'Bass Guitar & Groove', 45000, 168, 1100, 'intermediate', '["stamina", "focus"]'::jsonb, 18, 1.4, '+3 Stamina, +3 Focus', v_detroit_id, 5, 'Bass Prophet laid down the foundation for Motown''s greatest hits.', 'Motown echoes speak of him', 'exploration', true);

  -- Vocal & Lyrics Coaches
  INSERT INTO education_mentors (name, focus_skill, description, specialty, cost, cooldown_hours, base_xp, difficulty, attribute_keys, required_skill_value, skill_gain_ratio, bonus_description, city_id, available_day, lore_biography, discovery_hint, discovery_type, is_discoverable)
  VALUES
    ('The Wordsmith', 'songwriting_basic_composing', 'Dublin''s legendary lyricist and poet laureate of rock.', 'Lyrics & Poetry', 40000, 168, 1050, 'intermediate', '["creativity", "focus"]'::jsonb, 15, 1.35, '+4 Creativity, +2 Focus', v_dublin_id, 1, 'The Wordsmith wrote verses that Bono and Van Morrison quote to this day.', 'Temple Bar poets trade in his verses', 'exploration', true),
    ('Soul Sister Supreme', 'songwriting_basic_composing', 'Memphis gospel and soul vocal coach.', 'Soul & Gospel Vocals', 55000, 168, 1250, 'intermediate', '["charisma", "stamina"]'::jsonb, 20, 1.45, '+4 Charisma, +3 Stamina', v_memphis_id, 0, 'Soul Sister Supreme sang backup for Aretha and Mavis Staples.', 'Gospel choirs carry her legacy', 'exploration', true),
    ('Rhyme Oracle', 'genres_basic_hip_hop', 'Atlanta trap pioneer and flow architect.', 'Rapping & Flow', 60000, 168, 1300, 'advanced', '["creativity", "charisma"]'::jsonb, 22, 1.5, '+4 Creativity, +4 Charisma', v_atlanta_id, 4, 'The Rhyme Oracle predicted every flow trend before it happened.', 'Chart a hip-hop track to prove your worth', 'exploration', true),
    ('Harmony Queen', 'songwriting_basic_composing', 'Nashville''s most requested vocal harmony arranger.', 'Vocal Harmony & Arranging', 50000, 168, 1150, 'intermediate', '["charisma", "focus"]'::jsonb, 18, 1.4, '+3 Charisma, +3 Focus', v_nashville_id, 3, 'Harmony Queen arranged the background vocals on hundreds of country hits.', 'Recording engineers know her booth', 'studio_session', true);
END $$;

-- Part 4: Create Master Encounter Random Events
-- ======================================================

INSERT INTO random_events (id, title, description, category, is_common, health_min, health_max, 
  option_a_text, option_a_effects, option_a_outcome_text,
  option_b_text, option_b_effects, option_b_outcome_text, is_active)
VALUES
  (gen_random_uuid(), 'A Whisper in the Smoky Club', 
   'An old musician at the bar leans in: "I know someone who could take your sound to the next level. Interested?"',
   'opportunity', false, 0, 100,
   'Ask for the introduction',
   '{"cash": -500, "fame": 10}'::jsonb,
   'You slip them a tip and receive a cryptic address. A legendary master may be waiting...',
   'Politely decline',
   '{}'::jsonb,
   'You thank them but focus on your drink. Some mysteries are better left unsolved.',
   true),
   
  (gen_random_uuid(), 'Street Corner Respect',
   'A crowd gathers around a street performer whose skills are clearly world-class. They notice you watching.',
   'opportunity', false, 0, 100,
   'Join in and jam together',
   '{"cash": 0, "fame": 15}'::jsonb,
   'Your impromptu collaboration draws cheers. The performer mentions knowing a true master who might teach you...',
   'Just watch and learn',
   '{"cash": 0, "fame": 5}'::jsonb,
   'You absorb every nuance of their technique. Sometimes observation is the best teacher.',
   true),
   
  (gen_random_uuid(), 'The Producer''s Invitation',
   'A legendary producer''s assistant approaches you backstage: "My boss has been following your career. Would you like to meet them?"',
   'opportunity', false, 0, 100,
   'Accept immediately',
   '{"cash": -1000, "fame": 35}'::jsonb,
   'The meeting is brief but impactful. You''ve gained access to someone who could change everything...',
   'Request more details first',
   '{"cash": 0, "fame": 8}'::jsonb,
   'The assistant smiles mysteriously and hands you a business card. The door remains open.',
   true),
   
  (gen_random_uuid(), 'Recording Studio Encounter',
   'While waiting for your session, you notice a reclusive artist through the glass. The engineer whispers: "That''s one of the greats."',
   'opportunity', false, 0, 100,
   'Ask for an introduction',
   '{"cash": -200, "fame": 20}'::jsonb,
   'The engineer makes it happen. You exchange a few words that could lead to mentorship...',
   'Focus on your own session',
   '{"cash": 0, "fame": 0}'::jsonb,
   'You concentrate on your work. There will be other opportunities to meet legends.',
   true),
   
  (gen_random_uuid(), 'The Venue Owner''s Secret',
   'After your gig, the venue owner pulls you aside: "I''ve seen the greats come through here. One of them asked about you."',
   'opportunity', false, 0, 100,
   'Ask who it was',
   '{"cash": 0, "fame": 25}'::jsonb,
   'The owner shares a name that makes your heart race. A legendary master has noticed your work...',
   'Thank them and move on',
   '{"cash": 0, "fame": 8}'::jsonb,
   'You appreciate the kind words but stay humble. Fame can wait.',
   true);

-- Part 5: Link venues to mentors for venue_gig discovery
-- ======================================================

UPDATE education_mentors 
SET discovery_venue_id = (
  SELECT id FROM venues WHERE city_id = (SELECT id FROM cities WHERE name = 'Ibiza' LIMIT 1) 
  ORDER BY capacity DESC LIMIT 1
)
WHERE name = 'DJ Phantom';

UPDATE education_mentors 
SET discovery_venue_id = (
  SELECT id FROM venues WHERE city_id = (SELECT id FROM cities WHERE name = 'Berlin' LIMIT 1) 
  ORDER BY capacity DESC LIMIT 1
)
WHERE name = 'Synth Lord';

UPDATE education_mentors 
SET discovery_venue_id = (
  SELECT id FROM venues WHERE city_id = (SELECT id FROM cities WHERE name = 'Las Vegas' LIMIT 1) 
  ORDER BY capacity DESC LIMIT 1
)
WHERE name = 'The Hypnotist';

UPDATE education_mentors 
SET discovery_venue_id = (
  SELECT id FROM venues WHERE city_id = (SELECT id FROM cities WHERE name = 'Vienna' LIMIT 1) 
  ORDER BY capacity DESC LIMIT 1
)
WHERE name = 'Ivory Empress';

UPDATE education_mentors 
SET discovery_venue_id = (
  SELECT id FROM venues WHERE name = 'Ryman Auditorium' LIMIT 1
)
WHERE name = 'Steel Fingers';