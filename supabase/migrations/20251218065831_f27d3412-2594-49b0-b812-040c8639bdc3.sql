
-- =============================================
-- SEED UNIVERSITY COURSES
-- =============================================

WITH skill_list AS (
  SELECT slug, display_name, ROW_NUMBER() OVER (ORDER BY slug) as rn
  FROM skill_definitions
  WHERE slug LIKE 'basic_%' OR slug LIKE 'instruments_basic_%' OR slug LIKE 'genres_basic_%' OR slug LIKE 'songwriting_basic_%' OR slug LIKE 'stage_basic_%'
  LIMIT 50
),
universities_numbered AS (
  SELECT u.id, u.name, u.city, u.prestige, u.quality_of_learning, c.region,
    ROW_NUMBER() OVER (PARTITION BY c.region ORDER BY u.name) as uni_rn,
    COUNT(*) OVER (PARTITION BY c.region) as unis_in_region
  FROM universities u
  JOIN cities c ON c.name = u.city
),
course_data AS (
  SELECT 
    un.id as university_id,
    sl.slug as skill_slug,
    CASE 
      WHEN sl.display_name IS NOT NULL THEN sl.display_name || ' Fundamentals'
      ELSE INITCAP(REPLACE(REPLACE(sl.slug, 'basic_', ''), '_', ' ')) || ' Fundamentals'
    END as course_name,
    'Comprehensive course covering the fundamentals and techniques.' as description,
    CASE un.region
      WHEN 'North America' THEN 800
      WHEN 'Europe' THEN 600
      WHEN 'Asia' THEN 400
      WHEN 'Oceania' THEN 700
      WHEN 'South America' THEN 350
      WHEN 'Africa' THEN 250
      WHEN 'Middle East' THEN 500
      ELSE 500
    END * (1 + (un.prestige::numeric / 200)) as base_price,
    30 as base_duration_days,
    0 as required_skill_level,
    (un.quality_of_learning / 5)::int as xp_per_day_min,
    (un.quality_of_learning / 3)::int as xp_per_day_max,
    25 as max_enrollments,
    true as is_active,
    10 as class_start_hour,
    14 as class_end_hour
  FROM universities_numbered un
  CROSS JOIN skill_list sl
  WHERE (sl.rn % un.unis_in_region) + 1 = un.uni_rn
)
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, max_enrollments, is_active, class_start_hour, class_end_hour)
SELECT university_id, skill_slug, course_name, description, base_price::int, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, max_enrollments, is_active, class_start_hour, class_end_hour
FROM course_data
ON CONFLICT DO NOTHING;

-- Add advanced courses for high prestige universities
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, max_enrollments, is_active, class_start_hour, class_end_hour)
SELECT 
  u.id,
  sd.slug,
  COALESCE(sd.display_name, INITCAP(REPLACE(sd.slug, '_', ' '))) || ' Advanced',
  'Advanced techniques and professional development.',
  CASE c.region
    WHEN 'North America' THEN 1500
    WHEN 'Europe' THEN 1200
    WHEN 'Asia' THEN 800
    WHEN 'Oceania' THEN 1400
    WHEN 'South America' THEN 700
    WHEN 'Africa' THEN 500
    WHEN 'Middle East' THEN 1000
    ELSE 1000
  END,
  45, 25,
  (u.quality_of_learning / 4)::int,
  (u.quality_of_learning / 2)::int,
  15, true, 14, 18
FROM universities u
JOIN cities c ON c.name = u.city
CROSS JOIN (
  SELECT slug, display_name FROM skill_definitions 
  WHERE slug LIKE 'professional_%' LIMIT 20
) sd
WHERE u.prestige >= 80
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED MENTORS
-- =============================================

INSERT INTO education_mentors (name, focus_skill, description, specialty, cost, cooldown_hours, base_xp, difficulty, attribute_keys, required_skill_value, skill_gain_ratio, bonus_description, is_active)
VALUES
('Marcus Stone', 'guitar', 'Legendary rock guitarist with 30 years touring.', 'Rock guitar techniques', 500, 24, 150, 'beginner', '["charisma", "creativity"]', 0, 0.15, 'Unlock rock riffs library', true),
('Elena Rodriguez', 'guitar', 'Classical guitar virtuoso.', 'Classical and fingerstyle', 800, 24, 200, 'intermediate', '["discipline", "creativity"]', 25, 0.20, 'Classical repertoire access', true),
('Jake Thunder', 'guitar', 'Metal shredder and educator.', 'Speed picking and arpeggios', 1200, 48, 300, 'advanced', '["discipline", "stamina"]', 50, 0.25, 'Advanced metal techniques', true),
('Groove Master D', 'bass', 'Funk and R&B session bassist.', 'Groove and pocket playing', 450, 24, 140, 'beginner', '["rhythm", "creativity"]', 0, 0.15, 'Funk bass patterns', true),
('Sarah Lowend', 'bass', 'Jazz fusion bassist.', 'Jazz walking bass', 900, 24, 220, 'intermediate', '["creativity", "discipline"]', 25, 0.20, 'Jazz bass vocabulary', true),
('Victor Thunderfingers', 'bass', 'Technical bass pioneer.', 'Slap technique and harmonics', 1400, 48, 350, 'advanced', '["discipline", "stamina"]', 50, 0.25, 'Advanced slap mastery', true),
('Tommy Beats', 'drums', 'Rock drummer with solid fundamentals.', 'Basic rock beats', 400, 24, 130, 'beginner', '["stamina", "rhythm"]', 0, 0.15, 'Essential drum patterns', true),
('Crystal Rhythm', 'drums', 'Jazz and fusion drummer.', 'Jazz independence', 850, 24, 210, 'intermediate', '["creativity", "discipline"]', 25, 0.20, 'Jazz drumming vocabulary', true),
('Mike Blastbeat', 'drums', 'Extreme metal drummer.', 'Double bass and blast beats', 1300, 48, 320, 'advanced', '["stamina", "discipline"]', 50, 0.25, 'Extreme drumming mastery', true),
('Diana Voice', 'vocals', 'Pop vocal coach.', 'Pop vocal technique', 500, 24, 150, 'beginner', '["charisma", "health"]', 0, 0.15, 'Pop vocal exercises', true),
('Professor Aria', 'vocals', 'Opera singer and specialist.', 'Classical technique', 950, 24, 240, 'intermediate', '["discipline", "health"]', 25, 0.20, 'Classical vocal training', true),
('Screaming Steve', 'vocals', 'Metal vocalist.', 'Screaming techniques', 1100, 48, 280, 'advanced', '["stamina", "health"]', 50, 0.25, 'Safe extreme vocals', true),
('Stage Commander', 'performance', 'Stage presence coach.', 'Stage presence mastery', 600, 24, 160, 'beginner', '["charisma", "stamina"]', 0, 0.15, 'Stage movement basics', true),
('Charisma King', 'performance', 'Arena rock frontman.', 'Crowd engagement', 1000, 24, 250, 'intermediate', '["charisma", "creativity"]', 25, 0.20, 'Arena performance tips', true),
('The Showstopper', 'performance', 'Broadway performer.', 'Complete show production', 1500, 48, 380, 'advanced', '["charisma", "creativity"]', 50, 0.25, 'Theatrical performance', true),
('Melody Maker', 'songwriting', 'Hit songwriter.', 'Hook writing', 700, 24, 180, 'beginner', '["creativity", "intelligence"]', 0, 0.15, 'Hit songwriting formulas', true),
('Lyrical Genius', 'songwriting', 'Award-winning lyricist.', 'Lyric writing', 1100, 24, 270, 'intermediate', '["creativity", "intelligence"]', 25, 0.20, 'Advanced lyric techniques', true),
('The Producer', 'songwriting', 'Multi-platinum producer.', 'Production and arrangement', 1600, 48, 400, 'advanced', '["creativity", "intelligence"]', 50, 0.25, 'Professional production', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED SKILL BOOKS (respecting constraints: base_reading_days 2-4, skill_percentage_gain 0-1)
-- =============================================

INSERT INTO skill_books (skill_slug, title, author, description, price, base_reading_days, skill_percentage_gain, required_skill_level, daily_reading_time, reading_hour, is_active, category)
VALUES
-- Instruments
('basic_strings', 'Guitar Fundamentals', 'John Smith', 'Complete beginner guide to guitar.', 25, 3, 0.05, 0, 30, 8, true, 'Instruments'),
('basic_strings', 'Chord Encyclopedia', 'Mary Johnson', 'Essential chord shapes.', 35, 4, 0.08, 10, 30, 8, true, 'Instruments'),
('basic_strings', 'Scale Mastery', 'Robert Brown', 'All scales with exercises.', 45, 4, 0.10, 20, 45, 8, true, 'Instruments'),
('basic_strings', 'Bass Beginnings', 'Steve Lowman', 'Bass guitar fundamentals.', 25, 3, 0.05, 0, 30, 9, true, 'Instruments'),
('basic_strings', 'Groove Bible', 'Funk Master T', 'Essential grooves.', 40, 4, 0.08, 15, 30, 9, true, 'Instruments'),
('basic_percussions', 'Drum Basics', 'Tim Stick', 'Starting your drumming journey.', 20, 2, 0.04, 0, 30, 10, true, 'Instruments'),
('basic_percussions', 'Rhythm Patterns', 'Lisa Beat', 'Patterns for all genres.', 35, 3, 0.07, 10, 30, 10, true, 'Instruments'),
('basic_percussions', 'Advanced Drumming', 'Pro Drummer X', 'Complex patterns.', 55, 4, 0.12, 30, 45, 10, true, 'Instruments'),
('basic_keyboard', 'Piano Primer', 'Clara Keys', 'Beginner piano method.', 30, 3, 0.06, 0, 30, 8, true, 'Instruments'),
('basic_keyboard', 'Jazz Piano Voicings', 'Bill Evans Jr', 'Jazz voicings.', 50, 4, 0.09, 20, 45, 8, true, 'Instruments'),
('basic_brass', 'Brass Fundamentals', 'Trumpet Pro', 'Master brass basics.', 35, 3, 0.06, 0, 30, 9, true, 'Instruments'),
('basic_woodwinds', 'Woodwind Essentials', 'Sax Master', 'Woodwind techniques.', 35, 3, 0.06, 0, 30, 9, true, 'Instruments'),

-- Vocals
('basic_singing', 'Vocal Foundations', 'Sarah Singer', 'Build your voice.', 25, 2, 0.05, 0, 20, 7, true, 'Vocals'),
('basic_singing', 'Breath Control', 'Opera Star', 'Master breathing.', 35, 3, 0.07, 10, 20, 7, true, 'Vocals'),
('basic_singing', 'Range Extension', 'High Note Pro', 'Extend your range.', 45, 4, 0.10, 25, 30, 7, true, 'Vocals'),
('basic_rapping', 'Flow Fundamentals', 'MC Scholar', 'Develop rap flow.', 30, 3, 0.06, 0, 20, 18, true, 'Vocals'),
('basic_rapping', 'Lyrical Warfare', 'Battle MC', 'Battle rap techniques.', 40, 4, 0.08, 15, 25, 19, true, 'Vocals'),

-- Songwriting
('basic_composing', 'Songwriting 101', 'Hit Maker', 'Write your first hit.', 30, 2, 0.05, 0, 30, 9, true, 'Songwriting'),
('basic_composing', 'Melody Construction', 'Tune Smith', 'Create melodies.', 40, 3, 0.08, 15, 30, 9, true, 'Songwriting'),
('basic_lyrics', 'Lyric Writing Guide', 'Word Master', 'Craft compelling lyrics.', 35, 3, 0.07, 0, 30, 10, true, 'Songwriting'),
('basic_lyrics', 'Advanced Lyrics', 'Poetry Pro', 'Next level lyrics.', 50, 4, 0.10, 20, 45, 10, true, 'Songwriting'),

-- Production
('basic_record_production', 'Home Recording', 'Studio Pro', 'Set up home studio.', 40, 3, 0.07, 0, 45, 14, true, 'Production'),
('basic_daw_use', 'DAW Mastery', 'Digital Dave', 'Master your DAW.', 45, 4, 0.08, 0, 45, 14, true, 'Production'),
('basic_mixing_mastering', 'Mixing Fundamentals', 'Mix Master', 'Professional mixing.', 55, 4, 0.10, 15, 60, 14, true, 'Production'),
('basic_sound_design_synthesis', 'Sound Design Basics', 'Synth Wizard', 'Create your sounds.', 50, 4, 0.09, 10, 45, 15, true, 'Production'),
('basic_beatmaking', 'Beat Making 101', 'Beat Scientist', 'Create beats.', 40, 3, 0.08, 0, 45, 14, true, 'Production'),
('basic_sampling_remixing', 'Sampling Guide', 'Remix King', 'Legal sampling.', 45, 4, 0.09, 15, 45, 15, true, 'Production'),

-- Performance
('basic_showmanship', 'Stage Presence', 'Rock Star', 'Command the stage.', 30, 2, 0.06, 0, 20, 16, true, 'Performance'),
('basic_crowd_interaction', 'Crowd Connection', 'Audience Master', 'Build rapport.', 35, 3, 0.07, 10, 20, 16, true, 'Performance'),
('basic_visual_performance_integration', 'Visual Performance', 'Show Director', 'Integrate visuals.', 45, 4, 0.09, 20, 30, 17, true, 'Performance'),
('basic_stage_tech', 'Stage Tech Guide', 'Tech Pro', 'Technical stage setup.', 40, 3, 0.07, 5, 30, 15, true, 'Performance'),
('basic_live_looping', 'Live Looping', 'Loop Artist', 'Live loop performances.', 40, 3, 0.08, 10, 30, 17, true, 'Performance'),

-- Genres
('basic_rock', 'Rock History', 'Rock Historian', 'Deep dive into rock.', 35, 3, 0.07, 0, 30, 11, true, 'Genres'),
('basic_pop', 'Pop Production', 'Pop Producer', 'Craft pop hits.', 40, 3, 0.08, 0, 30, 11, true, 'Genres'),
('basic_hip_hop', 'Hip Hop Essentials', 'Beat Maker Pro', 'Master hip hop.', 40, 3, 0.08, 0, 30, 12, true, 'Genres'),
('basic_jazz', 'Jazz Theory', 'Jazz Professor', 'Jazz harmony.', 50, 4, 0.10, 10, 45, 11, true, 'Genres'),
('basic_blues', 'Blues Guitar Bible', 'Blues Legend', 'Authentic blues.', 35, 3, 0.07, 0, 30, 11, true, 'Genres'),
('basic_country', 'Country Music Guide', 'Nashville Pro', 'Country songwriting.', 35, 3, 0.07, 0, 30, 11, true, 'Genres'),
('basic_edm', 'EDM Production', 'DJ Producer', 'Electronic dance music.', 45, 4, 0.09, 5, 45, 20, true, 'Genres'),
('basic_heavy_metal', 'Metal Techniques', 'Metal Master', 'Heavy metal guide.', 40, 4, 0.08, 10, 30, 19, true, 'Genres'),
('basic_classical', 'Classical Theory', 'Conservatory Prof', 'Music theory.', 55, 4, 0.12, 0, 60, 9, true, 'Genres'),
('basic_reggae', 'Reggae Rhythm', 'Island Musician', 'Reggae grooves.', 30, 2, 0.06, 0, 30, 13, true, 'Genres'),
('basic_latin', 'Latin Essentials', 'Latin Master', 'Latin rhythms.', 35, 3, 0.07, 0, 30, 13, true, 'Genres'),
('basic_rnb', 'R&B Soul', 'Soul Producer', 'R&B tracks.', 40, 4, 0.08, 5, 30, 12, true, 'Genres'),
('basic_electronica', 'Electronica Guide', 'Synth Master', 'Electronic music.', 45, 4, 0.09, 5, 40, 20, true, 'Genres'),
('basic_punk_rock', 'Punk Rock 101', 'Punk Legend', 'Punk attitude.', 25, 2, 0.05, 0, 20, 18, true, 'Genres'),
('basic_flamenco', 'Flamenco Guitar', 'Spanish Master', 'Flamenco techniques.', 50, 4, 0.10, 15, 45, 11, true, 'Genres'),
('basic_world_music', 'World Music Survey', 'Global Sound', 'World traditions.', 45, 4, 0.09, 0, 40, 12, true, 'Genres'),

-- Electronic/DJ
('basic_dj_controller', 'DJ Fundamentals', 'Club DJ', 'Start DJ journey.', 35, 2, 0.06, 0, 30, 20, true, 'Electronic'),
('basic_electronic_instruments', 'Synth Programming', 'Synth Expert', 'Program synths.', 50, 4, 0.10, 10, 45, 15, true, 'Electronic'),
('basic_midi_controller', 'MIDI Mastery', 'MIDI Pro', 'MIDI techniques.', 40, 3, 0.07, 5, 35, 14, true, 'Electronic'),

-- Business
('basic_social_media_performance', 'Music Marketing', 'Industry Pro', 'Promote music.', 45, 4, 0.10, 0, 30, 10, true, 'Business'),
('basic_streaming_concerts', 'Live Streaming', 'Stream Expert', 'Online performances.', 35, 2, 0.07, 0, 30, 19, true, 'Business')
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED YOUTUBE VIDEOS
-- =============================================

INSERT INTO education_youtube_resources (title, description, video_url, category, difficulty_level, duration_minutes, tags)
VALUES
('Guitar Basics for Beginners', 'Learn first chords and strumming.', 'https://youtube.com/watch?v=guitar101', 'Guitar', 1, 15, ARRAY['guitar', 'beginner']),
('Intermediate Guitar Techniques', 'Barre chords and fingerpicking.', 'https://youtube.com/watch?v=guitar201', 'Guitar', 2, 25, ARRAY['guitar', 'intermediate']),
('Advanced Guitar Solos', 'Master shredding.', 'https://youtube.com/watch?v=guitar301', 'Guitar', 3, 35, ARRAY['guitar', 'advanced']),
('Blues Guitar Licks', 'Essential blues vocabulary.', 'https://youtube.com/watch?v=bluesguitar', 'Guitar', 2, 20, ARRAY['guitar', 'blues']),
('Bass Fundamentals', 'Get started on bass.', 'https://youtube.com/watch?v=bass101', 'Bass', 1, 12, ARRAY['bass', 'beginner']),
('Slap Bass Techniques', 'Learn slap and pop.', 'https://youtube.com/watch?v=slapbass', 'Bass', 3, 30, ARRAY['bass', 'advanced']),
('Walking Bass Lines', 'Jazz bass fundamentals.', 'https://youtube.com/watch?v=walkingbass', 'Bass', 2, 22, ARRAY['bass', 'jazz']),
('Drum Kit Setup', 'Set up drums properly.', 'https://youtube.com/watch?v=drumsetup', 'Drums', 1, 10, ARRAY['drums', 'setup']),
('Basic Rock Beats', 'Essential rock patterns.', 'https://youtube.com/watch?v=rockbeats', 'Drums', 1, 18, ARRAY['drums', 'rock']),
('Jazz Drumming Fundamentals', 'Swing and brushes.', 'https://youtube.com/watch?v=jazzdrums', 'Drums', 2, 28, ARRAY['drums', 'jazz']),
('Double Bass Pedal Mastery', 'Speed techniques.', 'https://youtube.com/watch?v=doublebass', 'Drums', 3, 40, ARRAY['drums', 'metal']),
('Singing for Beginners', 'Find your voice.', 'https://youtube.com/watch?v=sing101', 'Vocals', 1, 15, ARRAY['vocals', 'beginner']),
('Breath Control Exercises', 'Improve stamina.', 'https://youtube.com/watch?v=breathcontrol', 'Vocals', 2, 20, ARRAY['vocals', 'technique']),
('Rap Flow Development', 'Unique flow patterns.', 'https://youtube.com/watch?v=rapflow', 'Vocals', 2, 25, ARRAY['rap', 'flow']),
('Extreme Vocals Safely', 'Screaming without damage.', 'https://youtube.com/watch?v=extremevocals', 'Vocals', 3, 30, ARRAY['vocals', 'metal']),
('Piano for Beginners', 'First piano lessons.', 'https://youtube.com/watch?v=piano101', 'Keyboard', 1, 20, ARRAY['piano', 'beginner']),
('Chord Inversions', 'Make chords interesting.', 'https://youtube.com/watch?v=inversions', 'Keyboard', 2, 18, ARRAY['piano', 'theory']),
('Synthesizer Programming', 'Create your sounds.', 'https://youtube.com/watch?v=synthprog', 'Keyboard', 2, 35, ARRAY['synth', 'sound-design']),
('Home Studio Setup', 'Build your space.', 'https://youtube.com/watch?v=homestudio', 'Production', 1, 25, ARRAY['studio', 'setup']),
('DAW Basics', 'Navigate your DAW.', 'https://youtube.com/watch?v=daw101', 'Production', 1, 30, ARRAY['daw', 'beginner']),
('Mixing Fundamentals', 'Balance your mix.', 'https://youtube.com/watch?v=mixing101', 'Production', 2, 45, ARRAY['mixing', 'production']),
('Mastering Your Tracks', 'Professional mastering.', 'https://youtube.com/watch?v=mastering', 'Production', 3, 40, ARRAY['mastering', 'professional']),
('Beat Making Tutorial', 'Create beats.', 'https://youtube.com/watch?v=beatmaking', 'Production', 2, 35, ARRAY['beats', 'hip-hop']),
('Sampling Techniques', 'Chop and flip samples.', 'https://youtube.com/watch?v=sampling', 'Production', 2, 30, ARRAY['sampling', 'creative']),
('Stage Presence Basics', 'Command attention.', 'https://youtube.com/watch?v=stagepresence', 'Performance', 1, 15, ARRAY['performance', 'stage']),
('Crowd Interaction Tips', 'Engage your audience.', 'https://youtube.com/watch?v=crowdtips', 'Performance', 2, 20, ARRAY['crowd', 'engagement']),
('Live Sound for Musicians', 'Understand live audio.', 'https://youtube.com/watch?v=livesound', 'Performance', 2, 28, ARRAY['live', 'sound']),
('Live Streaming Your Music', 'Online performances.', 'https://youtube.com/watch?v=livestream', 'Performance', 1, 22, ARRAY['streaming', 'online']),
('Writing Your First Song', 'Song structure basics.', 'https://youtube.com/watch?v=songwriting101', 'Songwriting', 1, 18, ARRAY['songwriting', 'beginner']),
('Crafting Memorable Melodies', 'Melodic hooks.', 'https://youtube.com/watch?v=melodies', 'Songwriting', 2, 25, ARRAY['melody', 'hooks']),
('Lyric Writing Masterclass', 'Tell stories.', 'https://youtube.com/watch?v=lyrics', 'Songwriting', 2, 30, ARRAY['lyrics', 'storytelling']),
('Chord Progressions That Work', 'Popular progressions.', 'https://youtube.com/watch?v=chordprog', 'Songwriting', 1, 22, ARRAY['chords', 'progressions']),
('Rock Music Production', 'Produce rock tracks.', 'https://youtube.com/watch?v=rockprod', 'Genres', 2, 35, ARRAY['rock', 'production']),
('Pop Production Secrets', 'Modern pop.', 'https://youtube.com/watch?v=popprod', 'Genres', 2, 40, ARRAY['pop', 'production']),
('Hip Hop Beat Making', 'Hard-hitting beats.', 'https://youtube.com/watch?v=hiphopbeats', 'Genres', 2, 35, ARRAY['hip-hop', 'beats']),
('EDM Production Guide', 'Electronic dance basics.', 'https://youtube.com/watch?v=edmprod', 'Genres', 2, 45, ARRAY['edm', 'electronic']),
('Jazz Improvisation', 'Improvise over changes.', 'https://youtube.com/watch?v=jazzimprov', 'Genres', 3, 40, ARRAY['jazz', 'improvisation']),
('Country Songwriting', 'Write country songs.', 'https://youtube.com/watch?v=countrywriting', 'Genres', 2, 25, ARRAY['country', 'songwriting']),
('Metal Guitar Techniques', 'Heavy riffs and solos.', 'https://youtube.com/watch?v=metalguitar', 'Genres', 3, 35, ARRAY['metal', 'guitar']),
('R&B Vocal Runs', 'Master soulful runs.', 'https://youtube.com/watch?v=rnbvocals', 'Genres', 2, 25, ARRAY['rnb', 'vocals']),
('Music Theory Basics', 'Notes, scales, keys.', 'https://youtube.com/watch?v=theory101', 'Theory', 1, 30, ARRAY['theory', 'fundamentals']),
('Understanding Intervals', 'Building blocks.', 'https://youtube.com/watch?v=intervals', 'Theory', 1, 20, ARRAY['theory', 'intervals']),
('Advanced Harmony', 'Extended chords.', 'https://youtube.com/watch?v=advancedharmony', 'Theory', 3, 45, ARRAY['theory', 'harmony']),
('DJ Basics', 'Your first DJ set.', 'https://youtube.com/watch?v=dj101', 'DJ', 1, 20, ARRAY['dj', 'beginner']),
('Beatmatching Tutorial', 'Mix seamlessly.', 'https://youtube.com/watch?v=beatmatch', 'DJ', 2, 25, ARRAY['dj', 'beatmatching']),
('Scratching Techniques', 'Learn scratching.', 'https://youtube.com/watch?v=scratching', 'DJ', 3, 35, ARRAY['dj', 'turntablism'])
ON CONFLICT DO NOTHING;
