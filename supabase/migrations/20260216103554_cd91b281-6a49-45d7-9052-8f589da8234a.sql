
-- ===========================================
-- PART 1: SEED MENTORS FOR ALL UNCOVERED SKILLS
-- ===========================================
-- Each mentor: unique name, city, focus_skill, discovery_type, available_day, cost, base_xp, lore

-- CORE SKILLS (basic_* not yet covered)
INSERT INTO education_mentors (name, focus_skill, description, specialty, cost, cooldown_hours, base_xp, difficulty, skill_gain_ratio, city_id, available_day, discovery_type, is_discoverable, lore_biography, discovery_hint)
VALUES
-- Singing & Vocals
('Vocal Queen Amara', 'basic_singing', 'West African vocal powerhouse', 'Vocal technique & breath control', 20000, 168, 180, 'intermediate', 2.0, '3d6ec59a-ba47-40ed-8eaa-81af1d592997', 1, 'exploration', true, 'Born in Accra, Amara''s voice carries the spirit of West African highlife. She has trained Grammy winners in vocal dynamics.', 'Listen for her singing at dawn near the markets of Accra'),
('Dame Cecilia Bright', 'basic_singing', 'Classical-trained vocal coach', 'Opera and projection', 35000, 168, 220, 'advanced', 2.5, '3a32d826-cead-4d80-a829-87abda80d991', 3, 'exploration', true, 'A retired Vienna State Opera soprano who now trains the next generation.', 'She holds court at a famous Viennese café every Wednesday'),

-- Lyrics
('Wordsmith Williams', 'basic_lyrics', 'Hip-hop lyricist turned poetry professor', 'Wordplay, metaphor, and narrative', 18000, 168, 150, 'intermediate', 2.0, 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 2, 'exploration', true, 'From Harlem battle rap circles to NYU poetry chair, Williams bridges street lyricism and literary craft.', 'Found scribbling verses in a New York bookshop on Tuesdays'),
('Poetess Luna', 'basic_lyrics', 'Indie songwriter and lyricist', 'Emotional storytelling', 16000, 168, 140, 'beginner', 1.8, '13d450a9-eab3-430c-b5d1-377e5d3f2539', 5, 'exploration', true, 'Paris-based songwriter whose lyrics have been covered in 30 languages.', 'She writes in the gardens of Montmartre on Fridays'),

-- Keyboard
('Professor Keys', 'basic_keyboard', 'Jazz pianist and educator', 'Piano technique and improvisation', 22000, 168, 170, 'intermediate', 2.0, '1af689bb-b396-4e60-9c71-2b788ba8e54f', 4, 'exploration', true, 'A New Orleans jazz institution, Professor Keys has played every club on Bourbon Street.', 'Follow the piano melodies drifting from a New Orleans jazz bar on Thursdays'),

-- Strings
('Maestro Vivaldi Jr', 'basic_strings', 'Classical string virtuoso', 'Violin and orchestral strings', 28000, 168, 200, 'advanced', 2.2, '3a32d826-cead-4d80-a829-87abda80d991', 5, 'exploration', true, 'Descendant of Italian luthiers, trained at the Vienna Conservatory.', 'His violin echoes through Vienna''s concert halls on Fridays'),

-- Brass
('Brass Master Coleman', 'basic_brass', 'Trumpet and horn specialist', 'Brass technique and jazz horns', 20000, 168, 160, 'intermediate', 2.0, '29809134-e947-408b-9786-6d7b51181548', 6, 'exploration', true, 'Chicago brass legend who played with every major jazz ensemble in the city.', 'Hear his trumpet ringing through Chicago''s South Side on Saturdays'),

-- Woodwinds
('Flute Sage Tanaka', 'basic_woodwinds', 'Traditional and modern woodwinds', 'Flute, clarinet, and shakuhachi', 25000, 168, 180, 'intermediate', 2.0, '89b8b930-4fce-4776-a470-8943364ea120', 3, 'exploration', true, 'A Tokyo master bridging traditional Japanese shakuhachi and modern jazz flute.', 'Find him meditating in a Tokyo temple garden on Wednesdays'),

-- Percussions
('Rhythm King Osei', 'basic_percussions', 'Master of world percussion', 'Djembe, congas, and hand drums', 18000, 168, 160, 'intermediate', 2.0, '528545d3-d1cc-45e7-8f2c-4b8b9d44e8a7', 2, 'exploration', true, 'Born in Nairobi, Osei has toured with Afrobeat legends and taught percussion across three continents.', 'His drumming echoes through Nairobi markets on Tuesdays'),

-- Electronic Instruments
('Synth Wizard Karlsson', 'basic_electronic_instruments', 'Synthesizer and electronic instrument expert', 'Analog synths and modular rigs', 30000, 168, 200, 'advanced', 2.2, '2e670249-4f15-4089-b3cf-a1c2545bb5fa', 1, 'exploration', true, 'Stockholm''s premier synth guru, responsible for the Swedish electronic sound that dominated pop.', 'He tinkers with vintage synths in a Stockholm studio on Mondays'),

-- Composing
('Composer Chen Wei', 'basic_composing', 'Film and classical composer', 'Orchestral arrangement and film scoring', 35000, 168, 220, 'advanced', 2.5, '2c926bb9-f825-4ee3-bbeb-2a1c18d3bead', 4, 'exploration', true, 'Award-winning Shanghai film composer who blends Eastern and Western orchestral traditions.', 'Visit Shanghai''s film district on Thursdays to find his studio'),

-- DAW Use
('Producer Nexus', 'basic_daw_use', 'Digital audio workstation expert', 'Ableton, Logic, and FL Studio mastery', 20000, 168, 160, 'intermediate', 2.0, 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 3, 'exploration', true, 'LA-based producer who has crafted beats for platinum artists using nothing but a laptop.', 'His home studio in LA is open to visitors on Wednesdays'),

-- Beatmaking
('Beat Architect Dre-X', 'basic_beatmaking', 'Legendary beatmaker', 'Sampling, chopping, and drum programming', 25000, 168, 180, 'intermediate', 2.0, '872150e0-6fa6-4150-b622-b0f8e60ea6fb', 5, 'exploration', true, 'Atlanta''s most sought-after producer, Dre-X built the modern trap sound from scratch.', 'His beats shake the walls of an Atlanta studio every Friday'),

-- Record Production
('Sir George Harmon', 'basic_record_production', 'Legendary record producer', 'Full production from tracking to final mix', 40000, 168, 250, 'advanced', 2.5, '9f26ad86-51ed-4477-856d-610f14979310', 1, 'exploration', true, 'Knighted for his contributions to British music, Sir George has produced over 200 albums at Abbey Road.', 'He still works at a famous London studio on Mondays'),

-- Mixing & Mastering
('Mixmaster Sato', 'basic_mixing_mastering', 'Audio engineering perfectionist', 'EQ, compression, and spatial mixing', 30000, 168, 200, 'advanced', 2.2, '89b8b930-4fce-4776-a470-8943364ea120', 6, 'exploration', true, 'Tokyo''s most precise audio engineer, responsible for the crystalline Japanese pop sound.', 'His mixing suite is active on Saturday evenings in Tokyo'),

-- Sampling & Remixing
('Remix Queen Fatima', 'basic_sampling_remixing', 'Pioneer of remix culture', 'Creative sampling and remix techniques', 22000, 168, 170, 'intermediate', 2.0, 'cc1fd801-c4b3-448f-ad55-f307e10e14a0', 2, 'exploration', true, 'Berlin DJ and remixer who turned underground sampling into an art form.', 'Find her digging through vinyl in a Berlin record shop on Tuesdays'),

-- Sound Design & Synthesis
('Sound Architect Reyes', 'basic_sound_design_synthesis', 'Sound design visionary', 'Synthesis, foley, and sound sculpting', 28000, 168, 190, 'advanced', 2.2, 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 4, 'exploration', true, 'Hollywood sound designer who created iconic sounds for blockbuster films.', 'His LA sound lab opens to apprentices on Thursdays'),

-- Vocal Tuning & Processing
('Auto-Tune Master Zephyr', 'basic_vocal_tuning_processing', 'Vocal processing innovator', 'Pitch correction and vocal effects', 20000, 168, 160, 'intermediate', 2.0, '872150e0-6fa6-4150-b622-b0f8e60ea6fb', 6, 'exploration', true, 'Atlanta engineer who perfected the modern vocal processing chain used across hip-hop and pop.', 'He''s mixing vocals in an Atlanta studio on Saturdays'),

-- Rapping
('MC Grandmaster Flex', 'basic_rapping', 'Old-school rap legend', 'Flow, delivery, and mic presence', 25000, 168, 180, 'intermediate', 2.0, 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 0, 'exploration', true, 'New York hip-hop pioneer who helped define East Coast rap in the golden era.', 'He holds open cyphers in New York on Sundays'),

-- DJ Controller
('DJ Controller King Nova', 'basic_dj_controller', 'Digital DJ expert', 'CDJ, controller, and software DJing', 20000, 168, 160, 'intermediate', 2.0, 'de4787a9-f69a-44d8-8747-1cb02cae0c1c', 5, 'exploration', true, 'Amsterdam''s top DJ instructor who trained half the Ibiza resident DJs.', 'He spins at an Amsterdam warehouse on Fridays'),

-- MIDI Controller
('MIDI Maestro Park', 'basic_midi_controller', 'MIDI performance specialist', 'Finger drumming and MIDI expression', 18000, 168, 150, 'intermediate', 2.0, '65b3346d-0fc9-4319-b711-84a3d553d22b', 3, 'exploration', true, 'Seoul''s K-pop production genius who revolutionized MIDI-based live performance.', 'His Seoul studio opens for sessions on Wednesdays'),

-- Live Looping
('Loop Artist Echo', 'basic_live_looping', 'Live looping pioneer', 'Real-time layering and loop performance', 22000, 168, 170, 'intermediate', 2.0, 'f3606ebd-278a-4bfc-8023-d9f9ebfedbf5', 4, 'exploration', true, 'Bristol''s one-person-band phenomenon who builds entire orchestras from loops on stage.', 'Watch her busking with loop pedals in Bristol on Thursdays'),

-- Streaming Concerts
('Stream King Digital', 'basic_streaming_concerts', 'Virtual concert pioneer', 'Online performance and audience engagement', 16000, 168, 140, 'beginner', 1.8, '73fae343-9a12-4ecb-867f-ad6ec3699364', 1, 'exploration', true, 'San Francisco tech entrepreneur who pioneered the virtual concert format during the pandemic.', 'He broadcasts from a San Francisco loft on Mondays'),

-- Social Media Performance
('Viral Vee', 'basic_social_media_performance', 'Social media music star', 'TikTok, Reels, and viral content creation', 15000, 168, 130, 'beginner', 1.5, 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 2, 'exploration', true, 'LA influencer who turned 15-second clips into a music career spanning millions of followers.', 'She shoots content at an LA rooftop on Tuesdays'),

-- Visual Performance Integration
('VJ Lumina', 'basic_visual_performance_integration', 'Visual performance artist', 'Projection mapping and stage visuals', 25000, 168, 180, 'intermediate', 2.0, 'cc1fd801-c4b3-448f-ad55-f307e10e14a0', 6, 'exploration', true, 'Berlin''s underground VJ scene queen who creates immersive audiovisual experiences.', 'Her projection shows light up Berlin warehouses on Saturdays'),

-- Showmanship
('Showman Blaze', 'basic_showmanship', 'Stage presence master', 'Audience connection and stagecraft', 22000, 168, 170, 'intermediate', 2.0, 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 0, 'exploration', true, 'Former Vegas headliner who teaches the art of commanding a stage.', 'He rehearses at an LA theater on Sundays'),

-- Crowd Interaction
('Hype Master Jackson', 'basic_crowd_interaction', 'Crowd engagement expert', 'Call and response, crowd surfing, mosh management', 20000, 168, 160, 'intermediate', 2.0, '8bb73a75-bd57-49b3-9a03-a68f37a19f56', 4, 'exploration', true, 'Manchester''s legendary concert MC who can turn any crowd electric.', 'He appears at Manchester gig venues on Thursdays'),

-- Stage Tech
('Tech Guru Watts', 'basic_stage_tech', 'Live sound and stage technology', 'PA systems, monitors, and stage setup', 18000, 168, 150, 'intermediate', 2.0, '2a518758-067c-4d34-8ff6-666a31169fe7', 5, 'exploration', true, 'Nashville''s most trusted sound engineer who has wired every major stage in Tennessee.', 'He''s setting up rigs at Nashville venues on Fridays'),

-- AI Music Tools
('Dr. Neural Beat', 'basic_ai_music_tools', 'AI music technology researcher', 'Machine learning for music creation', 30000, 168, 200, 'advanced', 2.2, '73fae343-9a12-4ecb-867f-ad6ec3699364', 3, 'exploration', true, 'Stanford AI lab researcher who bridges artificial intelligence and musical creativity.', 'Find him at a San Francisco tech campus on Wednesdays'),

-- GENRE SKILLS (basic genres not yet covered)
-- Rock
('Rock Sensei Tanaka', 'basic_rock', 'Japanese rock pioneer', 'Power chords and rock songwriting', 20000, 168, 160, 'intermediate', 2.0, '89b8b930-4fce-4776-a470-8943364ea120', 1, 'exploration', true, 'Pioneered J-Rock in the 80s and influenced a generation of Asian rock musicians.', 'He jams at a Tokyo rock bar on Mondays'),
-- Pop
('Pop Princess Sakura', 'basic_pop', 'Pop songwriting sensation', 'Hooks, structure, and pop production', 22000, 168, 170, 'intermediate', 2.0, '65b3346d-0fc9-4319-b711-84a3d553d22b', 2, 'exploration', true, 'K-pop choreographer turned pop songwriting mentor in Seoul.', 'She coaches at a Seoul studio on Tuesdays'),
-- R&B
('Smooth Operator Davis', 'basic_rnb', 'Neo-soul and R&B master', 'Groove, harmony, and vocal runs', 25000, 168, 180, 'intermediate', 2.0, '0f6c3eea-29c4-443b-b505-171a6d97c3f5', 3, 'exploration', true, 'Detroit Motown heir who carries the torch of classic R&B.', 'He holds vocal sessions in a Detroit studio on Wednesdays'),
-- Country
('Nashville Legend Conway', 'basic_country', 'Country music institution', 'Storytelling, twang, and country guitar', 20000, 168, 160, 'intermediate', 2.0, '2a518758-067c-4d34-8ff6-666a31169fe7', 1, 'exploration', true, 'Third-generation Nashville songwriter with 50 years in the business.', 'He''s always at a Nashville honky-tonk on Mondays'),
-- Reggae
('Reggae Elder Marley Jr', 'basic_reggae', 'Roots reggae guardian', 'Skank rhythms and conscious lyrics', 18000, 168, 150, 'intermediate', 2.0, 'eac6911c-26a5-40b5-8775-6c777c0426ad', 4, 'exploration', true, 'Kingston''s reggae ambassador carrying on the legacy of roots music.', 'Find him by the waterfront in Kingston on Thursdays'),
-- Classical
('Professor Von Strauss', 'basic_classical', 'Classical composition and theory', 'Counterpoint, harmony, and orchestration', 40000, 168, 250, 'advanced', 2.5, '3a32d826-cead-4d80-a829-87abda80d991', 2, 'exploration', true, 'Vienna Philharmonic conductor turned private tutor.', 'He lectures at a Vienna conservatory on Tuesdays'),
-- Heavy Metal
('Iron Lord Magnusson', 'basic_heavy_metal', 'Scandinavian metal master', 'Shredding, blast beats, and metal composition', 25000, 168, 180, 'intermediate', 2.0, '2e670249-4f15-4089-b3cf-a1c2545bb5fa', 6, 'exploration', true, 'Swedish death metal pioneer who defined the Gothenburg sound.', 'His rehearsal space in Stockholm thunders on Saturdays'),
-- Modern Rock
('Alt-Rock Oracle Quinn', 'basic_modern_rock', 'Modern rock innovator', 'Alt-rock songwriting and production', 20000, 168, 160, 'intermediate', 2.0, 'ee3d48a3-02a6-495e-95c3-3016a0529302', 3, 'exploration', true, 'Seattle grunge-era survivor who shaped the modern rock sound.', 'He plays at a Seattle dive bar on Wednesdays'),
-- Punk Rock (already has mentor, add one more for coverage)
-- Hip Hop (already has mentor)
-- Jazz (already has mentor)
-- EDM (already has mentor)
-- Flamenco
('Flamenco Master Rodrigo', 'basic_flamenco', 'Flamenco guitar and dance', 'Rasgueado, palmas, and compás', 30000, 168, 200, 'advanced', 2.2, '6c2386aa-a874-4c36-b153-8e10376f4a6e', 5, 'exploration', true, 'Barcelona-born flamenco virtuoso who has performed at every major tablao in Spain.', 'His guitar rings through Barcelona''s Gothic Quarter on Fridays'),
-- Trap
('Trap Lord 808', 'basic_trap', 'Trap music innovator', '808s, hi-hats, and trap production', 20000, 168, 160, 'intermediate', 2.0, '872150e0-6fa6-4150-b622-b0f8e60ea6fb', 4, 'exploration', true, 'Atlanta producer who helped define the modern trap sound.', 'His bass shakes Atlanta studios on Thursdays'),
-- Drill
('Drill Sergeant Sparks', 'basic_drill', 'UK and Chicago drill expert', 'Sliding 808s and drill patterns', 18000, 168, 150, 'intermediate', 2.0, '9f26ad86-51ed-4477-856d-610f14979310', 2, 'exploration', true, 'London drill pioneer bridging Chicago and UK sounds.', 'He produces in a South London studio on Tuesdays'),
-- Synthwave
('Neon Driver', 'basic_synthwave', 'Retrowave and synthwave producer', '80s synths and retro production', 20000, 168, 160, 'intermediate', 2.0, 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 0, 'exploration', true, 'LA nightlife DJ who brought 80s synths back to the mainstream.', 'He spins retro sets at an LA club on Sundays'),
-- Hyperpop
('Glitch Pop Nova', 'basic_hyperpop', 'Hyperpop and experimental pop', 'Distortion, pitch-shifting, and chaos', 16000, 168, 140, 'beginner', 1.8, 'cc1fd801-c4b3-448f-ad55-f307e10e14a0', 1, 'exploration', true, 'Berlin-based hyperpop artist pushing the boundaries of pop music.', 'She hosts noisy sessions in a Berlin basement on Mondays'),
-- Indie/Bedroom Pop
('Bedroom Pop Sage Ivy', 'basic_indie_bedroom_pop', 'Lo-fi bedroom pop artist', 'DIY recording and intimate songwriting', 15000, 168, 130, 'beginner', 1.5, '2d1cf4cd-8767-41c4-9499-44a45adcd078', 3, 'exploration', true, 'Montreal bedroom pop artist who built a fanbase from her apartment.', 'She records in her Montreal apartment on Wednesdays'),
-- Metalcore/Djent
('Djent King Mesmer', 'basic_metalcore_djent', 'Progressive metalcore expert', '8-string technique and polyrhythms', 25000, 168, 180, 'advanced', 2.2, 'cb597106-05c3-40ad-be42-13d936509764', 4, 'exploration', true, 'Melbourne metalcore guitarist who pioneered the Australian djent scene.', 'His guitar clinic runs in Melbourne on Thursdays'),
-- Lo-Fi Hip Hop
('Chill Master Kaze', 'basic_lofi_hip_hop', 'Lo-fi hip hop beatmaker', 'Vinyl crackle, jazzy samples, and chill vibes', 16000, 168, 140, 'beginner', 1.8, '89b8b930-4fce-4776-a470-8943364ea120', 5, 'exploration', true, 'Tokyo lo-fi producer whose beats soundtrack millions of study sessions.', 'He makes beats in a quiet Tokyo café on Fridays'),
-- World Music
('Global Sound Shaman', 'basic_world_music', 'World music fusion specialist', 'Cross-cultural rhythms and instruments', 22000, 168, 170, 'intermediate', 2.0, 'e61cf950-1934-4c6c-833a-1d3b0d85af85', 6, 'exploration', true, 'Mumbai musician who fuses Indian classical with global sounds.', 'He performs at Mumbai''s music festivals on Saturdays'),
-- African Music
('Afro Master Kwame', 'basic_african_music', 'Pan-African music specialist', 'Highlife, jùjú, and Afro-fusion', 20000, 168, 160, 'intermediate', 2.0, 'bdb69b1e-8449-4116-afa3-ffa38549b057', 1, 'exploration', true, 'Lagos music legend who has defined multiple African genres.', 'He jams at a Lagos nightclub on Mondays'),
-- Afrobeats/Amapiano
('Amapiano Queen Zola', 'basic_afrobeats_amapiano', 'Afrobeats and Amapiano producer', 'Log drums, shakers, and Amapiano grooves', 20000, 168, 160, 'intermediate', 2.0, '2d9e6eca-87f9-45c4-8d19-b431032ea46b', 2, 'exploration', true, 'Cape Town producer who brought Amapiano to the world stage.', 'She hosts sessions in Cape Town on Tuesdays'),
-- Alt R&B/Neo-Soul
('Neo-Soul Priestess Jade', 'basic_alt_rnb_neo_soul', 'Alternative R&B and neo-soul', 'Atmospheric R&B and vocal layering', 22000, 168, 170, 'intermediate', 2.0, '2a673b2f-ccb3-4040-a0e3-9184ee535ef4', 5, 'exploration', true, 'Toronto artist blending R&B with experimental electronics.', 'She performs at a Toronto lounge on Fridays'),
-- K-Pop/J-Pop (already has mentor)
-- Latin
-- (already has mentor)
-- Electronica (already has mentor)
-- Blues (already has mentor)

-- MASTERY SKILLS (cover all mastery categories)
('Guitar God Henderson', 'guitar_mastery', 'Ultimate guitar mastery', 'Advanced technique across all styles', 50000, 168, 350, 'advanced', 3.0, 'b4d3f32e-d174-4b55-85e3-e37e4f29fe11', 6, 'venue_gig', true, 'Memphis blues-rock legend whose fingers have been insured for $10 million.', 'Play a gig at a legendary Memphis venue to earn his attention'),
('Drum Deity Bonham III', 'drums_mastery', 'Transcendent drumming mastery', 'Polyrhythmic independence and power', 50000, 168, 350, 'advanced', 3.0, '9f26ad86-51ed-4477-856d-610f14979310', 0, 'venue_gig', true, 'Third-generation rock drummer carrying on a legendary family name in London.', 'He only teaches those who prove themselves at a London venue'),
('Piano Empress Ming', 'piano_mastery', 'Concert pianist mastery', 'Classical and jazz piano at the highest level', 55000, 168, 380, 'advanced', 3.0, 'e371b37f-852b-470a-875a-b8087ea3d723', 2, 'exploration', true, 'Beijing concert pianist who has performed at every major concert hall in the world.', 'She practices in Beijing''s National Center on Tuesdays'),
('Bass Oracle Jaco Jr', 'professional_bass', 'Professional bass techniques', 'Slap, harmonics, and fretless mastery', 35000, 168, 280, 'advanced', 2.5, '96c964de-4dbd-4bbe-80b7-6c9f68d4ba32', 3, 'exploration', true, 'Miami bassist carrying on the legacy of jazz-fusion bass.', 'His bass echoes from a Miami jazz club on Wednesdays'),
('Lead Vocal Oracle Adisa', 'lead_vocals_mastery', 'Ultimate vocal mastery', 'Multi-octave range and vocal athletics', 55000, 168, 380, 'advanced', 3.0, 'bdb69b1e-8449-4116-afa3-ffa38549b057', 4, 'venue_gig', true, 'Lagos-born vocal phenomenon with a five-octave range.', 'Perform at a Lagos venue to catch her ear'),
('Composing Oracle Morricone Jr', 'composing_mastery', 'Composition at the highest level', 'Orchestral, film, and experimental composition', 60000, 168, 400, 'advanced', 3.0, '13d450a9-eab3-430c-b5d1-377e5d3f2539', 1, 'exploration', true, 'Parisian film composer descended from Italian cinema music royalty.', 'He composes at a Paris conservatory on Mondays'),
('DAW Overlord Circuit', 'daw_mastery', 'DAW production mastery', 'Advanced production workflow and automation', 40000, 168, 300, 'advanced', 2.8, 'cc1fd801-c4b3-448f-ad55-f307e10e14a0', 5, 'exploration', true, 'Berlin electronic producer who pushes DAWs beyond their limits.', 'His Berlin studio is open for masterclasses on Fridays'),
('DJ Deity Tiësto Jr', 'dj_mastery', 'DJ mastery and turntablism', 'Advanced mixing and live performance DJing', 45000, 168, 320, 'advanced', 2.8, 'de4787a9-f69a-44d8-8747-1cb02cae0c1c', 6, 'exploration', true, 'Amsterdam''s next-generation DJ prodigy.', 'He headline spins at an Amsterdam club on Saturdays'),
('Beat God Pharrell Jr', 'beatmaking_mastery', 'Beatmaking mastery', 'Cross-genre production and sound innovation', 50000, 168, 350, 'advanced', 3.0, '96c964de-4dbd-4bbe-80b7-6c9f68d4ba32', 4, 'exploration', true, 'Miami producer whose beats have defined multiple decades.', 'His Miami studio opens for masters on Thursdays'),
('Mix Engineer Legend Spike', 'mixing_mastering_mastery', 'Mixing and mastering mastery', 'Reference-quality mixing and mastering', 55000, 168, 380, 'advanced', 3.0, 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 2, 'exploration', true, 'New York mixing legend with 1,000+ album credits.', 'He works at a legendary New York studio on Tuesdays'),
('EDM Titan Aoki Jr', 'edm_mastery', 'EDM production mastery', 'Festival-ready drops and sound design', 45000, 168, 320, 'advanced', 2.8, 'cb7bdfa8-5558-4ffd-9d0f-235920ac269a', 0, 'exploration', true, 'LA EDM producer who headlines the world''s biggest festivals.', 'He''s in his LA studio on Sundays'),
('Hip Hop Sage Rakim Jr', 'hip_hop_mastery', 'Hip hop mastery', 'Advanced lyricism, flow, and production', 50000, 168, 350, 'advanced', 3.0, 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 5, 'venue_gig', true, 'New York rap legend whose technical skill is unmatched.', 'Perform at a legendary New York venue to gain his respect'),
('Pop Architect Max', 'pop_mastery', 'Pop songwriting mastery', 'Hit-making formula and pop arrangement', 45000, 168, 320, 'advanced', 2.8, '2e670249-4f15-4089-b3cf-a1c2545bb5fa', 3, 'exploration', true, 'Stockholm''s hit factory mastermind behind countless chart-toppers.', 'He works from a Stockholm pop studio on Wednesdays'),
('Loop Virtuoso Ouroboros', 'live_looping_mastery', 'Live looping mastery', 'Complex multi-layer live performance', 40000, 168, 300, 'advanced', 2.8, '31f54d08-a832-417a-8db1-3f0900e11b6a', 1, 'exploration', true, 'Dublin busker turned world-touring loop artist.', 'He performs on Dublin''s Grafton Street on Mondays'),
('Crowd Commander Rex', 'crowd_engagement_mastery', 'Ultimate crowd engagement', 'Stadium-level audience control', 45000, 168, 320, 'advanced', 2.8, '88e56016-9e1d-45df-9196-f0700c50d017', 6, 'exploration', true, 'São Paulo carnival MC who can move 100,000 people at once.', 'He appears at São Paulo events on Saturdays'),
('AI Music Visionary Turing', 'ai_music_mastery', 'AI-assisted music mastery', 'Cutting-edge AI composition and generation', 50000, 168, 350, 'advanced', 3.0, '73fae343-9a12-4ecb-867f-ad6ec3699364', 4, 'exploration', true, 'Silicon Valley researcher pioneering the future of AI-generated music.', 'He lectures at a San Francisco lab on Thursdays'),

-- PROFESSIONAL TIER SKILLS
('Pro Keyboard Master Lee', 'professional_keyboard', 'Professional keyboard technique', 'Advanced piano and synth performance', 35000, 168, 280, 'advanced', 2.5, '65b3346d-0fc9-4319-b711-84a3d553d22b', 1, 'exploration', true, 'Seoul session keyboardist who plays on every K-pop album.', 'He teaches at a Seoul music academy on Mondays'),
('Pro Strings Maestro Paganini', 'professional_strings', 'Professional string performance', 'Advanced bowing and orchestral technique', 40000, 168, 300, 'advanced', 2.5, '3a32d826-cead-4d80-a829-87abda80d991', 4, 'exploration', true, 'Vienna Philharmonic first violin.', 'He rehearses at Vienna concert halls on Thursdays'),
('Pro Vocal Coach Whitney Jr', 'professional_singing', 'Professional vocal training', 'Advanced belting, runs, and vocal control', 38000, 168, 290, 'advanced', 2.5, '872150e0-6fa6-4150-b622-b0f8e60ea6fb', 3, 'exploration', true, 'Atlanta vocal coach to the stars.', 'She coaches at an Atlanta studio on Wednesdays'),
('Pro Composing Master Bach Jr', 'professional_composing', 'Professional composition techniques', 'Advanced harmony and arrangement', 42000, 168, 310, 'advanced', 2.5, 'cc1fd801-c4b3-448f-ad55-f307e10e14a0', 2, 'exploration', true, 'Berlin''s most respected composition teacher.', 'He lectures at a Berlin conservatory on Tuesdays'),
('Pro Hip Hop Sage Nas Jr', 'professional_hip_hop', 'Professional hip hop production', 'Advanced sampling and hip hop arrangement', 35000, 168, 280, 'advanced', 2.5, 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 4, 'exploration', true, 'New York hip hop producer with roots in the golden era.', 'His New York studio is open on Thursdays'),
('Pro EDM Producer Deadmau5 Jr', 'professional_edm', 'Professional EDM production', 'Advanced synthesis and arrangement', 35000, 168, 280, 'advanced', 2.5, '2a673b2f-ccb3-4040-a0e3-9184ee535ef4', 5, 'exploration', true, 'Toronto electronic music producer.', 'He teaches at a Toronto studio on Fridays'),
('Pro Rock Guru Cobain Jr', 'professional_rock', 'Professional rock performance', 'Advanced rock songwriting and guitar work', 35000, 168, 280, 'advanced', 2.5, 'ee3d48a3-02a6-495e-95c3-3016a0529302', 6, 'exploration', true, 'Seattle rock musician keeping the grunge spirit alive.', 'He plays at a Seattle venue on Saturdays'),
('Pro Mixing Engineer Clearmountain', 'professional_mixing_mastering', 'Professional mixing techniques', 'Advanced EQ, dynamics, and spatial processing', 38000, 168, 290, 'advanced', 2.5, 'a6d76b84-df38-4efb-9fc1-4bd882e31d1a', 1, 'exploration', true, 'New York mixing engineer with hundreds of platinum credits.', 'He works at a legendary New York studio on Mondays'),
('Pro DAW Guru Ableton', 'professional_daw_production', 'Professional DAW production', 'Advanced workflow and creative techniques', 32000, 168, 260, 'advanced', 2.5, 'cc1fd801-c4b3-448f-ad55-f307e10e14a0', 3, 'exploration', true, 'Berlin-based production instructor.', 'He teaches in a Berlin studio on Wednesdays'),
('Pro DJ Spinner Oakenfold', 'professional_djing', 'Professional DJ techniques', 'Advanced mixing and crowd reading', 35000, 168, 280, 'advanced', 2.5, 'de4787a9-f69a-44d8-8747-1cb02cae0c1c', 4, 'exploration', true, 'Amsterdam trance DJ legend.', 'He spins at an Amsterdam club on Thursdays'),
('Pro Crowd Master Festival', 'professional_crowd_engagement', 'Professional crowd engagement', 'Festival-level crowd management', 30000, 168, 250, 'advanced', 2.5, '9f26ad86-51ed-4477-856d-610f14979310', 5, 'exploration', true, 'London festival MC and crowd engagement expert.', 'He appears at London festivals on Fridays'),
('Pro Beatmaker J Dilla Jr', 'professional_beatmaking', 'Professional beatmaking', 'Advanced sampling and rhythm programming', 35000, 168, 280, 'advanced', 2.5, '0f6c3eea-29c4-443b-b505-171a6d97c3f5', 6, 'exploration', true, 'Detroit beat scientist carrying on the legacy of Motor City production.', 'His Detroit studio vibrates on Saturdays'),
('Pro AI Music Researcher', 'professional_ai_music_integration', 'Professional AI music tools', 'Advanced AI-assisted composition', 40000, 168, 300, 'advanced', 2.5, '73fae343-9a12-4ecb-867f-ad6ec3699364', 2, 'exploration', true, 'San Francisco AI music startup founder.', 'He presents at a San Francisco tech hub on Tuesdays');

-- ===========================================
-- PART 2: ADD MORE INSTRUMENT UNIVERSITY COURSES
-- ===========================================
-- Add 3 extra courses per instrument skill at various universities

-- Guitar courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'guitar', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Advanced Fingerstyle Guitar', 'Master fingerpicking patterns, Travis picking, and percussive guitar techniques', 800, 21, 30, 40, 70),
  ('Blues Guitar Immersion', 'Deep dive into blues scales, bending, vibrato, and 12-bar blues soloing', 600, 14, 10, 30, 55),
  ('Rock Guitar Masterclass', 'Power chords, palm muting, distortion techniques, and rock soloing', 700, 18, 20, 35, 65),
  ('Jazz Guitar Harmony', 'Chord voicings, comping, walking bass lines on guitar, and jazz improvisation', 900, 24, 40, 45, 80),
  ('Classical Guitar Foundation', 'Proper technique, sight reading, and classical repertoire', 750, 21, 0, 35, 60),
  ('Slide Guitar Workshop', 'Open tunings, bottleneck technique, and Delta blues slide guitar', 550, 14, 15, 30, 55),
  ('Guitar Effects & Tone Shaping', 'Pedal chains, amp settings, and creative effects usage', 500, 14, 10, 25, 50),
  ('Metal Guitar Shredding', 'Sweep picking, tapping, and high-speed alternate picking', 850, 21, 35, 40, 75)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 8) u;

-- Bass courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'bass', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Slap Bass Fundamentals', 'Thumb slap, pop technique, and funk bass grooves', 700, 18, 20, 35, 65),
  ('Walking Bass Lines', 'Jazz walking bass, chord tones, and approach notes', 800, 21, 30, 40, 70),
  ('Fretless Bass Expression', 'Intonation, vibrato, and expressive fretless playing', 850, 21, 35, 40, 75),
  ('Bass Groove Workshop', 'Pocket playing, ghost notes, and rhythmic feel', 600, 14, 10, 30, 55),
  ('Progressive Bass Techniques', 'Tapping, chords, and extended range bass', 900, 24, 40, 45, 80),
  ('Reggae & Dub Bass', 'Deep bass tones, one-drop rhythms, and dub effects', 550, 14, 10, 25, 50),
  ('Metal Bass Mastery', 'Pick technique, distorted bass, and metal grooves', 750, 18, 25, 35, 65),
  ('Session Bass Skills', 'Reading charts, versatility, and professional session work', 800, 21, 30, 40, 70)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 8) u;

-- Drums courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'drums', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Jazz Drumming Essentials', 'Swing, brushwork, and jazz independence', 800, 21, 25, 40, 70),
  ('Double Bass Drum Technique', 'Speed, endurance, and double bass patterns for metal and prog', 750, 18, 30, 35, 65),
  ('Latin Percussion & Drumset', 'Samba, bossa nova, and Afro-Cuban patterns on drumset', 700, 18, 20, 35, 65),
  ('Drum Recording & Studio Skills', 'Mic placement, tuning for recording, and click track performance', 650, 14, 15, 30, 55),
  ('Funk Drumming Masterclass', 'Ghost notes, linear patterns, and deep pocket groove', 700, 18, 20, 35, 65),
  ('Progressive Drumming', 'Odd time signatures, polyrhythms, and metric modulation', 900, 24, 40, 45, 80),
  ('Rock Drumming Power', 'Hard-hitting technique, fills, and stadium rock drumming', 600, 14, 10, 30, 55),
  ('Electronic Drum Programming', 'Drum machines, sequencing, and hybrid acoustic-electronic kits', 650, 14, 15, 30, 55)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 8) u;

-- Keyboard courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'basic_keyboard', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Jazz Piano Voicings', 'Two-hand voicings, rootless chords, and comping patterns', 800, 21, 25, 40, 70),
  ('Synth Programming for Keys', 'Sound design on hardware and software synthesizers', 700, 18, 15, 35, 65),
  ('Gospel Piano & Organ', 'Gospel chords, Hammond organ technique, and praise music', 650, 14, 10, 30, 55),
  ('Classical Piano Repertoire', 'Bach, Chopin, and Debussy — building a classical repertoire', 850, 24, 30, 40, 75),
  ('Pop Piano Accompaniment', 'Chord patterns, arpeggios, and supporting vocalists', 550, 14, 5, 25, 50),
  ('Blues Piano & Boogie Woogie', 'Left-hand patterns, blues scales, and improvisation', 600, 14, 10, 30, 55)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 6) u;

-- Singing courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'basic_singing', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Vocal Health & Warm-ups', 'Protect your voice with proper warm-up routines and vocal hygiene', 400, 14, 0, 20, 40),
  ('Harmony Singing', 'Sing in thirds, fifths, and create vocal harmonies', 600, 14, 15, 30, 55),
  ('Stage Vocal Performance', 'Microphone technique, monitors, and singing live', 700, 18, 20, 35, 65),
  ('Vocal Range Extension', 'Expand your range through mixed voice and head voice training', 750, 21, 25, 35, 65),
  ('R&B Vocal Runs & Riffs', 'Melisma, pentatonic runs, and R&B vocal styling', 800, 21, 30, 40, 70),
  ('Rock Vocal Power', 'Belting, grit, and high-energy rock singing technique', 650, 14, 15, 30, 55)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 6) u;

-- Strings courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'basic_strings', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Violin for Rock & Pop', 'Electric violin technique, effects, and contemporary styles', 700, 18, 15, 35, 65),
  ('Cello Fundamentals', 'Bowing technique, posture, and cello repertoire', 750, 21, 0, 30, 60),
  ('String Ensemble Playing', 'Quartet and ensemble technique, intonation, and blend', 650, 14, 20, 30, 55),
  ('Fiddle & Folk Strings', 'Irish, bluegrass, and folk fiddle techniques', 600, 14, 10, 25, 50)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 4) u;

-- Brass courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'basic_brass', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Jazz Trumpet Improvisation', 'Bebop lines, chord tone soloing, and jazz trumpet technique', 800, 21, 25, 40, 70),
  ('Trombone Fundamentals', 'Slide positions, tone production, and trombone basics', 600, 14, 0, 25, 50),
  ('Horn Section Arranging', 'Writing and playing horn arrangements for bands', 700, 18, 15, 35, 65),
  ('Brass Band Ensemble', 'Marching band and concert band brass performance', 550, 14, 5, 25, 45)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 4) u;

-- Woodwinds courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'basic_woodwinds', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Saxophone Jazz Improvisation', 'Jazz saxophone technique, scales, and improvisation', 800, 21, 25, 40, 70),
  ('Flute for Contemporary Music', 'Modern flute techniques for pop, rock, and world music', 650, 14, 10, 30, 55),
  ('Clarinet Classical & Jazz', 'Clarinet technique spanning classical and jazz repertoire', 700, 18, 15, 35, 65),
  ('Harmonica Blues & Folk', 'Blues harp, cross-harp technique, and folk harmonica', 500, 14, 0, 20, 45)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 4) u;

-- Percussions courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'basic_percussions', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Hand Drum Circle', 'Djembe, doumbek, and frame drum in group settings', 500, 14, 0, 20, 45),
  ('Afro-Cuban Percussion', 'Congas, timbales, and Cuban rhythmic patterns', 700, 18, 15, 35, 65),
  ('Orchestral Percussion', 'Timpani, marimba, and concert percussion technique', 800, 21, 25, 40, 70),
  ('Cajon & Unplugged Percussion', 'Acoustic percussion for singer-songwriters and small venues', 450, 14, 0, 20, 40)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 4) u;

-- Electronic Instruments courses
INSERT INTO university_courses (university_id, skill_slug, name, description, base_price, base_duration_days, required_skill_level, xp_per_day_min, xp_per_day_max, is_active)
SELECT u.id, 'basic_electronic_instruments', 
  course.name, course.description, course.price, course.duration, course.req_level, course.xp_min, course.xp_max, true
FROM (VALUES
  ('Modular Synthesis Deep Dive', 'Eurorack, patching, and generative music', 900, 24, 30, 45, 80),
  ('Vintage Synth Masterclass', 'Moog, Prophet, and Juno — programming classic analog synths', 800, 21, 20, 40, 70),
  ('Drum Machine Programming', 'TR-808, TR-909, and modern drum machine workflows', 650, 14, 10, 30, 55),
  ('Sampler & MPC Workflow', 'Sampling, chopping, and live MPC performance', 700, 18, 15, 35, 65)
) AS course(name, description, price, duration, req_level, xp_min, xp_max)
CROSS JOIN (SELECT id FROM universities ORDER BY RANDOM() LIMIT 4) u;
