
-- First insert new skill definitions for rap skills and new genres
INSERT INTO public.skill_definitions (slug, display_name, description)
VALUES
  -- Rap instrument skills
  ('instruments_basic_rapping', 'Basic Rapping', 'Develop flow, cadence, and lyrical delivery on the mic.'),
  ('instruments_professional_rapping', 'Professional Rapping', 'Master breath control, double-time flows, and live crowd energy.'),
  ('instruments_mastery_rapping', 'Rapping Mastery', 'Deliver legendary freestyle performances with innovative cadences and wordplay.'),
  ('instruments_basic_freestyle_rap', 'Basic Freestyle', 'Improvise simple bars over beats with basic rhyme schemes.'),
  ('instruments_professional_freestyle_rap', 'Professional Freestyle', 'Deliver multi-syllable rhymes and audience call-and-response off the dome.'),
  ('instruments_mastery_freestyle_rap', 'Freestyle Mastery', 'Command any cypher or battle with razor-sharp wit and flawless improvisation.'),
  ('instruments_basic_battle_rap', 'Basic Battle Rap', 'Learn punchlines, rebuttals, and competitive rap fundamentals.'),
  ('instruments_professional_battle_rap', 'Professional Battle Rap', 'Craft devastating angles, flip opponents bars, and control crowd reactions.'),
  ('instruments_mastery_battle_rap', 'Battle Rap Mastery', 'Dominate any rap battle with legendary punchlines and performance presence.'),
  ('instruments_basic_flow_and_cadence', 'Basic Flow & Cadence', 'Develop rhythmic awareness, pocket riding, and basic flow patterns.'),
  ('instruments_professional_flow_and_cadence', 'Professional Flow & Cadence', 'Switch between triplet flows, syncopation, and complex rhythmic patterns.'),
  ('instruments_mastery_flow_and_cadence', 'Flow & Cadence Mastery', 'Innovate entirely new flow styles that influence the next generation of rappers.'),
  ('instruments_basic_rap_songwriting', 'Basic Rap Songwriting', 'Structure verses, hooks, and bridges for complete rap songs.'),
  ('instruments_professional_rap_songwriting', 'Professional Rap Songwriting', 'Craft concept tracks, storytelling narratives, and radio-ready rap songs.'),
  ('instruments_mastery_rap_songwriting', 'Rap Songwriting Mastery', 'Write genre-defining rap albums with cohesive themes and cultural impact.'),
  ('instruments_basic_ad_libs_and_vocal_fx', 'Basic Ad-Libs & Vocal FX', 'Add energy with ad-libs, vocal stacks, and signature catchphrases.'),
  ('instruments_professional_ad_libs_and_vocal_fx', 'Professional Ad-Libs & Vocal FX', 'Layer ad-libs with precision, use vocal effects creatively, and build signature sounds.'),
  ('instruments_mastery_ad_libs_and_vocal_fx', 'Ad-Libs & Vocal FX Mastery', 'Create iconic vocal signatures that become part of hip hop culture.'),
  -- New rap genre skills
  ('genres_basic_conscious_rap', 'Basic Conscious Rap', 'Study the roots, rhythms, and instrumentation that define Conscious Rap.'),
  ('genres_professional_conscious_rap', 'Professional Conscious Rap', 'Produce polished Conscious Rap songs ready for release and touring.'),
  ('genres_mastery_conscious_rap', 'Conscious Rap Mastery', 'Innovate within Conscious Rap and shape the future sound of the genre.'),
  ('genres_basic_gangsta_rap', 'Basic Gangsta Rap', 'Study the roots, rhythms, and instrumentation that define Gangsta Rap.'),
  ('genres_professional_gangsta_rap', 'Professional Gangsta Rap', 'Produce polished Gangsta Rap songs ready for release and touring.'),
  ('genres_mastery_gangsta_rap', 'Gangsta Rap Mastery', 'Innovate within Gangsta Rap and shape the future sound of the genre.'),
  ('genres_basic_boom_bap', 'Basic Boom Bap', 'Study the roots, rhythms, and instrumentation that define Boom Bap.'),
  ('genres_professional_boom_bap', 'Professional Boom Bap', 'Produce polished Boom Bap songs ready for release and touring.'),
  ('genres_mastery_boom_bap', 'Boom Bap Mastery', 'Innovate within Boom Bap and shape the future sound of the genre.'),
  ('genres_basic_cloud_rap', 'Basic Cloud Rap', 'Study the roots, rhythms, and instrumentation that define Cloud Rap.'),
  ('genres_professional_cloud_rap', 'Professional Cloud Rap', 'Produce polished Cloud Rap songs ready for release and touring.'),
  ('genres_mastery_cloud_rap', 'Cloud Rap Mastery', 'Innovate within Cloud Rap and shape the future sound of the genre.'),
  ('genres_basic_mumble_rap', 'Basic Mumble Rap', 'Study the roots, rhythms, and instrumentation that define Mumble Rap.'),
  ('genres_professional_mumble_rap', 'Professional Mumble Rap', 'Produce polished Mumble Rap songs ready for release and touring.'),
  ('genres_mastery_mumble_rap', 'Mumble Rap Mastery', 'Innovate within Mumble Rap and shape the future sound of the genre.'),
  ('genres_basic_grime', 'Basic Grime', 'Study the roots, rhythms, and instrumentation that define Grime.'),
  ('genres_professional_grime', 'Professional Grime', 'Produce polished Grime songs ready for release and touring.'),
  ('genres_mastery_grime', 'Grime Mastery', 'Innovate within Grime and shape the future sound of the genre.'),
  ('genres_basic_crunk', 'Basic Crunk', 'Study the roots, rhythms, and instrumentation that define Crunk.'),
  ('genres_professional_crunk', 'Professional Crunk', 'Produce polished Crunk songs ready for release and touring.'),
  ('genres_mastery_crunk', 'Crunk Mastery', 'Innovate within Crunk and shape the future sound of the genre.'),
  ('genres_basic_phonk', 'Basic Phonk', 'Study the roots, rhythms, and instrumentation that define Phonk.'),
  ('genres_professional_phonk', 'Professional Phonk', 'Produce polished Phonk songs ready for release and touring.'),
  ('genres_mastery_phonk', 'Phonk Mastery', 'Innovate within Phonk and shape the future sound of the genre.'),
  ('genres_basic_emo_rap', 'Basic Emo Rap', 'Study the roots, rhythms, and instrumentation that define Emo Rap.'),
  ('genres_professional_emo_rap', 'Professional Emo Rap', 'Produce polished Emo Rap songs ready for release and touring.'),
  ('genres_mastery_emo_rap', 'Emo Rap Mastery', 'Innovate within Emo Rap and shape the future sound of the genre.'),
  ('genres_basic_jazz_rap', 'Basic Jazz Rap', 'Study the roots, rhythms, and instrumentation that define Jazz Rap.'),
  ('genres_professional_jazz_rap', 'Professional Jazz Rap', 'Produce polished Jazz Rap songs ready for release and touring.'),
  ('genres_mastery_jazz_rap', 'Jazz Rap Mastery', 'Innovate within Jazz Rap and shape the future sound of the genre.')
ON CONFLICT (slug) DO NOTHING;

-- Seed rap-related university courses
DO $$
DECLARE
  uni_id UUID;
BEGIN
  SELECT id INTO uni_id FROM public.universities LIMIT 1;
  
  IF uni_id IS NOT NULL THEN
    INSERT INTO public.university_courses (name, description, skill_slug, university_id, base_price, base_duration_days, xp_per_day_min, xp_per_day_max, required_skill_level)
    VALUES
      ('Introduction to Rapping', 'Learn flow fundamentals, breath control, and rhythmic delivery.', 'instruments_basic_rapping', uni_id, 800, 14, 4, 8, 0),
      ('Advanced Rap Performance', 'Master double-time flows, stage presence, and crowd engagement.', 'instruments_professional_rapping', uni_id, 2200, 28, 6, 12, 250),
      ('Freestyle Fundamentals', 'Develop off-the-dome improvisation and cypher skills.', 'instruments_basic_freestyle_rap', uni_id, 900, 14, 4, 8, 0),
      ('Professional Freestyle Workshop', 'Multi-syllable rhyming, audience interaction, and battle prep.', 'instruments_professional_freestyle_rap', uni_id, 2400, 21, 6, 12, 250),
      ('Battle Rap Bootcamp', 'Learn punchlines, rebuttals, and competitive format strategies.', 'instruments_basic_battle_rap', uni_id, 850, 14, 4, 8, 0),
      ('Flow & Cadence Masterclass', 'Study triplet flows, syncopation, and rhythmic innovation.', 'instruments_basic_flow_and_cadence', uni_id, 900, 14, 4, 8, 0),
      ('Professional Flow Engineering', 'Switch between flow patterns and develop signature cadences.', 'instruments_professional_flow_and_cadence', uni_id, 2500, 21, 6, 12, 250),
      ('Rap Songwriting Workshop', 'Structure verses, hooks, and complete rap tracks.', 'instruments_basic_rap_songwriting', uni_id, 950, 14, 4, 8, 0),
      ('Professional Rap Composition', 'Craft concept albums, storytelling narratives, and radio-ready rap.', 'instruments_professional_rap_songwriting', uni_id, 2600, 28, 6, 12, 250),
      ('Ad-Libs & Vocal FX Techniques', 'Add energy with vocal stacks, catchphrases, and signature sounds.', 'instruments_basic_ad_libs_and_vocal_fx', uni_id, 750, 10, 4, 8, 0),
      ('Trap Production Intensive', 'Master 808s, hi-hat rolls, and modern trap production.', 'genres_basic_trap', uni_id, 1100, 14, 4, 8, 0),
      ('Boom Bap Production', 'Study classic sample-based hip hop production techniques.', 'genres_basic_boom_bap', uni_id, 1100, 14, 4, 8, 0),
      ('Drill Music Workshop', 'Learn the dark melodies and sliding 808s of drill production.', 'genres_basic_drill', uni_id, 1100, 14, 4, 8, 0),
      ('Conscious Rap Studies', 'Explore socially conscious lyricism and message-driven rap.', 'genres_basic_conscious_rap', uni_id, 1000, 14, 4, 8, 0)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed rap-related skill books (base_reading_days 2-4, skill_percentage_gain 0-1)
INSERT INTO public.skill_books (title, author, description, skill_slug, price, base_reading_days, skill_percentage_gain, required_skill_level)
VALUES
  ('The Art of MCing', 'DJ Premier', 'A comprehensive guide to rapping fundamentals, flow, and mic presence.', 'instruments_basic_rapping', 120, 3, 0.08, 0),
  ('Flow State: Advanced Rap Techniques', 'Rakim Allah', 'Deep dive into complex rhyme schemes, multisyllabics, and breath control.', 'instruments_professional_rapping', 280, 4, 0.06, 250),
  ('Freestyle Bible', 'Supernatural', 'The definitive guide to off-the-dome improvisation and cypher domination.', 'instruments_basic_freestyle_rap', 140, 3, 0.08, 0),
  ('Battle Bars: The Competitive MC Handbook', 'Loaded Lux', 'Strategies for crafting devastating punchlines and winning rap battles.', 'instruments_basic_battle_rap', 150, 3, 0.08, 0),
  ('The Science of Flow', 'Eminem', 'Technical breakdown of cadence patterns, triplet flows, and rhythmic innovation.', 'instruments_basic_flow_and_cadence', 160, 3, 0.08, 0),
  ('Writing Rhymes: Rap Songcraft', 'Nas', 'From verse structure to concept albums — complete rap songwriting guide.', 'instruments_basic_rap_songwriting', 130, 3, 0.08, 0),
  ('Ad-Lib Mastery', 'Lil Jon', 'How to create iconic vocal signatures, ad-libs, and hype techniques.', 'instruments_basic_ad_libs_and_vocal_fx', 100, 2, 0.07, 0),
  ('Trap Music Production Bible', 'Metro Boomin', 'Master 808 patterns, hi-hat programming, and modern trap aesthetics.', 'genres_basic_trap', 180, 3, 0.06, 0),
  ('Boom Bap Forever', 'Pete Rock', 'Classic hip hop production: sampling, chopping, and golden-era beats.', 'genres_basic_boom_bap', 170, 3, 0.06, 0),
  ('Drill: From Chicago to the World', 'Chief Keef', 'The history and production techniques behind drill music.', 'genres_basic_drill', 160, 3, 0.06, 0),
  ('Conscious Lyricism', 'Kendrick Lamar', 'Crafting socially aware rap with storytelling depth and cultural impact.', 'genres_basic_conscious_rap', 150, 3, 0.06, 0),
  ('Grime: UK Underground Sound', 'Wiley', 'The 140bpm sound of London — MC techniques and production for grime.', 'genres_basic_grime', 160, 3, 0.06, 0),
  ('Phonk & Memphis Rap Production', 'DJ Spanish Fly', 'Lo-fi aesthetics, cowbell patterns, and dark Memphis-influenced beats.', 'genres_basic_phonk', 140, 3, 0.06, 0)
ON CONFLICT DO NOTHING;

-- Seed rap-related YouTube education resources
INSERT INTO public.education_youtube_resources (title, description, video_url, category, difficulty_level, duration_minutes, tags)
VALUES
  ('How to Rap: Flow & Cadence Basics', 'Learn the fundamentals of rap flow, timing, and rhythmic delivery.', 'https://youtube.com/watch?v=rap-flow-101', 'rapping', 1, 15, ARRAY['rap', 'flow', 'beginner']),
  ('Freestyle Rap Tutorial for Beginners', 'Step-by-step guide to improvising lyrics over any beat.', 'https://youtube.com/watch?v=freestyle-basics', 'rapping', 1, 20, ARRAY['freestyle', 'rap', 'beginner']),
  ('Advanced Multi-Syllable Rhyming', 'Master complex rhyme schemes used by top MCs.', 'https://youtube.com/watch?v=multisyllable-rhymes', 'rapping', 2, 18, ARRAY['rap', 'rhyming', 'advanced']),
  ('Battle Rap: Writing Punchlines That Hit', 'Craft devastating bars for competitive rap battles.', 'https://youtube.com/watch?v=battle-punchlines', 'rapping', 2, 22, ARRAY['battle rap', 'punchlines', 'intermediate']),
  ('Trap Beat Making: Complete Guide', 'Build a trap beat from scratch — 808s, hi-hats, and melodies.', 'https://youtube.com/watch?v=trap-beats-101', 'production', 1, 25, ARRAY['trap', 'beatmaking', 'production']),
  ('Boom Bap Production: Sampling Masterclass', 'Chop and flip vinyl samples into golden-era hip hop beats.', 'https://youtube.com/watch?v=boom-bap-sampling', 'production', 2, 30, ARRAY['boom bap', 'sampling', 'production']),
  ('Drill Music Production Tutorial', 'Create dark drill beats with sliding 808s and eerie melodies.', 'https://youtube.com/watch?v=drill-production', 'production', 2, 28, ARRAY['drill', 'production', 'beatmaking']),
  ('How to Write a Rap Verse', 'Structure your bars, build rhyme patterns, and tell stories.', 'https://youtube.com/watch?v=write-rap-verse', 'songwriting', 1, 16, ARRAY['rap', 'songwriting', 'beginner']),
  ('Grime MC Techniques', 'Master the 140bpm delivery style of UK grime MCs.', 'https://youtube.com/watch?v=grime-mc-guide', 'rapping', 2, 20, ARRAY['grime', 'mc', 'uk']),
  ('Phonk Production: Lo-Fi Hip Hop Beats', 'Create dark, Memphis-inspired phonk beats with cowbells and vocal chops.', 'https://youtube.com/watch?v=phonk-production', 'production', 2, 24, ARRAY['phonk', 'production', 'lo-fi']),
  ('Conscious Rap: Writing With Purpose', 'Craft socially aware lyrics that inspire and provoke thought.', 'https://youtube.com/watch?v=conscious-rap-writing', 'songwriting', 2, 18, ARRAY['conscious rap', 'lyrics', 'songwriting']),
  ('Cloud Rap Aesthetics & Production', 'Atmospheric beats, reverb-heavy vocals, and dreamy rap production.', 'https://youtube.com/watch?v=cloud-rap-guide', 'production', 2, 22, ARRAY['cloud rap', 'production', 'atmospheric'])
ON CONFLICT DO NOTHING;
