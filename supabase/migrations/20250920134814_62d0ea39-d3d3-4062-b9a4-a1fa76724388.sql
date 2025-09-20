-- Create skill_progress table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.skill_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  skill_slug VARCHAR NOT NULL,
  current_level INTEGER DEFAULT 0,
  current_xp INTEGER DEFAULT 0,
  required_xp INTEGER DEFAULT 100,
  last_practiced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(profile_id, skill_slug)
);

-- Enable RLS on skill_progress
ALTER TABLE public.skill_progress ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for skill_progress
CREATE POLICY "Users can view their own skill progress"
ON public.skill_progress FOR SELECT
USING (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert their own skill progress"
ON public.skill_progress FOR INSERT
WITH CHECK (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update their own skill progress"
ON public.skill_progress FOR UPDATE
USING (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Add trigger for skill_progress updated_at
CREATE TRIGGER update_skill_progress_updated_at
BEFORE UPDATE ON public.skill_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Clear existing skill definitions to start fresh
DELETE FROM public.skill_definitions;
DELETE FROM public.skill_parent_links;

-- Insert Songwriting & Production skills
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps) VALUES
-- Basic Songwriting & Production
('basic_composing', 'Basic Composing', 'Learn fundamental music composition techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_lyrics', 'Basic Lyrics', 'Write simple song lyrics and verses', '{"1": 25, "2": 50, "3": 100}'),
('basic_record_production', 'Basic Record Production', 'Understand recording basics and studio fundamentals', '{"1": 25, "2": 50, "3": 100}'),
('basic_daw_use', 'Basic DAW Use', 'Learn digital audio workstation basics', '{"1": 25, "2": 50, "3": 100}'),
('basic_beatmaking', 'Basic Beatmaking', 'Create simple beats and rhythms', '{"1": 25, "2": 50, "3": 100}'),
('basic_sampling_remixing', 'Basic Sampling & Remixing', 'Introduction to sampling and remix techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_sound_design_synthesis', 'Basic Sound Design & Synthesis', 'Create and manipulate sounds using synthesizers', '{"1": 25, "2": 50, "3": 100}'),
('basic_mixing_mastering', 'Basic Mixing & Mastering', 'Learn fundamental audio mixing and mastering', '{"1": 25, "2": 50, "3": 100}'),
('basic_live_looping', 'Basic Live Looping', 'Real-time loop recording and playback techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_vocal_tuning_processing', 'Basic Vocal Tuning & Processing', 'Process and tune vocal recordings', '{"1": 25, "2": 50, "3": 100}'),
('basic_ai_music_tools', 'Basic AI Music Tools', 'Use AI tools for music creation assistance', '{"1": 25, "2": 50, "3": 100}'),

-- Professional Songwriting & Production
('professional_composing', 'Professional Composing', 'Advanced composition techniques and song structures', '{"1": 50, "2": 100, "3": 200}'),
('professional_lyrics', 'Professional Lyrics', 'Craft compelling and complex lyrics', '{"1": 50, "2": 100, "3": 200}'),
('professional_record_production', 'Professional Record Production', 'Advanced studio production techniques', '{"1": 50, "2": 100, "3": 200}'),
('professional_daw_production', 'Professional DAW Production', 'Master advanced DAW features and workflows', '{"1": 50, "2": 100, "3": 200}'),
('professional_beatmaking', 'Professional Beatmaking', 'Create complex and professional-quality beats', '{"1": 50, "2": 100, "3": 200}'),
('professional_sampling_remixing', 'Professional Sampling & Remixing', 'Advanced sampling and remix production', '{"1": 50, "2": 100, "3": 200}'),
('professional_sound_design_synthesis', 'Professional Sound Design & Synthesis', 'Create original sounds and advanced synthesis', '{"1": 50, "2": 100, "3": 200}'),
('professional_mixing_mastering', 'Professional Mixing & Mastering', 'Professional-level mixing and mastering techniques', '{"1": 50, "2": 100, "3": 200}'),
('professional_live_looping', 'Professional Live Looping', 'Advanced live looping and performance techniques', '{"1": 50, "2": 100, "3": 200}'),
('professional_vocal_production', 'Professional Vocal Production', 'Professional vocal recording and production', '{"1": 50, "2": 100, "3": 200}'),
('professional_ai_music_integration', 'Professional AI Music Integration', 'Integrate AI tools into professional workflows', '{"1": 50, "2": 100, "3": 200}'),

-- Mastery Songwriting & Production
('composing_mastery', 'Composing Mastery', 'Master-level composition including anthems and crowdpleasers', '{"1": 100, "2": 200, "3": 400}'),
('daw_mastery', 'DAW Mastery', 'Complete mastery of digital audio workstations', '{"1": 100, "2": 200, "3": 400}'),
('beatmaking_mastery', 'Beatmaking Mastery', 'Master-level beat production and innovation', '{"1": 100, "2": 200, "3": 400}'),
('sampling_remixing_mastery', 'Sampling & Remixing Mastery', 'Master-level sampling and remix artistry', '{"1": 100, "2": 200, "3": 400}'),
('sound_design_synthesis_mastery', 'Sound Design & Synthesis Mastery', 'Master-level sound creation and synthesis', '{"1": 100, "2": 200, "3": 400}'),
('mixing_mastering_mastery', 'Mix/Mastering Mastery', 'Master-level audio engineering and production', '{"1": 100, "2": 200, "3": 400}'),
('live_looping_mastery', 'Live Looping Mastery', 'Master-level live performance looping', '{"1": 100, "2": 200, "3": 400}'),
('vocal_processing_mastery', 'Vocal Processing Mastery', 'Master-level vocal production and processing', '{"1": 100, "2": 200, "3": 400}'),
('ai_music_mastery', 'AI Music Mastery', 'Master-level AI music creation and integration', '{"1": 100, "2": 200, "3": 400}');

-- Insert Genre skills
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps) VALUES
-- Basic Genres - Traditional
('basic_rock', 'Basic Rock', 'Learn fundamental rock music techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_pop', 'Basic Pop', 'Master popular music fundamentals', '{"1": 25, "2": 50, "3": 100}'),
('basic_hip_hop', 'Basic Hip Hop', 'Learn hip hop production and performance basics', '{"1": 25, "2": 50, "3": 100}'),
('basic_jazz', 'Basic Jazz', 'Understand jazz fundamentals and improvisation', '{"1": 25, "2": 50, "3": 100}'),
('basic_blues', 'Basic Blues', 'Master blues scales and progression basics', '{"1": 25, "2": 50, "3": 100}'),
('basic_country', 'Basic Country', 'Learn country music traditions and techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_reggae', 'Basic Reggae', 'Master reggae rhythms and musical style', '{"1": 25, "2": 50, "3": 100}'),
('basic_heavy_metal', 'Basic Heavy Metal', 'Learn heavy metal fundamentals and techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_classical', 'Basic Classical', 'Understand classical music theory and composition', '{"1": 25, "2": 50, "3": 100}'),
('basic_electronica', 'Basic Electronica', 'Learn electronic music production basics', '{"1": 25, "2": 50, "3": 100}'),
('basic_latin', 'Basic Latin', 'Master Latin music rhythms and styles', '{"1": 25, "2": 50, "3": 100}'),
('basic_world_music', 'Basic World Music', 'Explore global music traditions', '{"1": 25, "2": 50, "3": 100}'),
('basic_rnb', 'Basic R&B', 'Learn R&B fundamentals and vocal techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_punk_rock', 'Basic Punk Rock', 'Master punk rock energy and techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_flamenco', 'Basic Flamenco', 'Learn flamenco guitar and rhythm techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_african_music', 'Basic African Music', 'Explore African musical traditions', '{"1": 25, "2": 50, "3": 100}'),
('basic_modern_rock', 'Basic Modern Rock', 'Learn contemporary rock styles', '{"1": 25, "2": 50, "3": 100}'),

-- Basic Genres - Modern
('basic_edm', 'Basic EDM', 'Learn electronic dance music production', '{"1": 25, "2": 50, "3": 100}'),
('basic_trap', 'Basic Trap', 'Master trap beats and production style', '{"1": 25, "2": 50, "3": 100}'),
('basic_drill', 'Basic Drill', 'Learn drill music production and style', '{"1": 25, "2": 50, "3": 100}'),
('basic_lofi_hip_hop', 'Basic Lo-Fi Hip Hop', 'Create relaxed lo-fi hip hop beats', '{"1": 25, "2": 50, "3": 100}'),
('basic_kpop_jpop', 'Basic K-Pop/J-Pop', 'Learn Asian pop music production styles', '{"1": 25, "2": 50, "3": 100}'),
('basic_afrobeats_amapiano', 'Basic Afrobeats/Amapiano', 'Master African electronic music styles', '{"1": 25, "2": 50, "3": 100}'),
('basic_synthwave', 'Basic Synthwave', 'Create retro-futuristic electronic music', '{"1": 25, "2": 50, "3": 100}'),
('basic_indie_bedroom_pop', 'Basic Indie/Bedroom Pop', 'Learn indie and bedroom pop aesthetics', '{"1": 25, "2": 50, "3": 100}'),
('basic_hyperpop', 'Basic Hyperpop', 'Create experimental hyperpop music', '{"1": 25, "2": 50, "3": 100}'),
('basic_metalcore_djent', 'Basic Metalcore/Djent', 'Learn modern metal techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_alt_rnb_neo_soul', 'Basic Alt R&B/Neo-Soul', 'Master alternative R&B and neo-soul', '{"1": 25, "2": 50, "3": 100}');

-- Professional Genres (continuing with same pattern for all genres...)
-- I'll add the key professional genres for now to keep the migration manageable
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps) VALUES
('professional_rock', 'Professional Rock', 'Advanced rock production and performance', '{"1": 50, "2": 100, "3": 200}'),
('professional_pop', 'Professional Pop', 'Professional pop music creation and production', '{"1": 50, "2": 100, "3": 200}'),
('professional_hip_hop', 'Professional Hip Hop', 'Advanced hip hop production techniques', '{"1": 50, "2": 100, "3": 200}'),
('professional_edm', 'Professional EDM', 'Professional electronic dance music production', '{"1": 50, "2": 100, "3": 200}'),
('professional_trap', 'Professional Trap', 'Advanced trap music production', '{"1": 50, "2": 100, "3": 200}');

-- Mastery Genres
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps) VALUES
('rock_mastery', 'Rock Mastery', 'Complete mastery of rock music in all forms', '{"1": 100, "2": 200, "3": 400}'),
('pop_mastery', 'Pop Mastery', 'Master-level pop music creation and innovation', '{"1": 100, "2": 200, "3": 400}'),
('hip_hop_mastery', 'Hip Hop Mastery', 'Master-level hip hop artistry and production', '{"1": 100, "2": 200, "3": 400}'),
('edm_mastery', 'EDM Mastery', 'Master-level electronic dance music creation', '{"1": 100, "2": 200, "3": 400}');

-- Insert Instruments & Performance skills
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps) VALUES
-- Basic Instruments
('basic_singing', 'Basic Singing', 'Learn fundamental vocal techniques', '{"1": 25, "2": 50, "3": 100}'),
('basic_rapping', 'Basic Rapping', 'Master basic rap techniques and flow', '{"1": 25, "2": 50, "3": 100}'),
('basic_brass', 'Basic Brass', 'Learn brass instruments fundamentals', '{"1": 25, "2": 50, "3": 100}'),
('basic_keyboard', 'Basic Keyboard', 'Master keyboard and piano basics', '{"1": 25, "2": 50, "3": 100}'),
('basic_percussions', 'Basic Percussions', 'Learn drum and percussion fundamentals', '{"1": 25, "2": 50, "3": 100}'),
('basic_strings', 'Basic Strings', 'Master string instruments basics', '{"1": 25, "2": 50, "3": 100}'),
('basic_woodwinds', 'Basic Woodwinds', 'Learn woodwind instruments', '{"1": 25, "2": 50, "3": 100}'),
('basic_electronic_instruments', 'Basic Electronic Instruments', 'Master electronic instrument basics', '{"1": 25, "2": 50, "3": 100}'),
('basic_dj_controller', 'Basic DJ Controller Skills', 'Learn DJ controller fundamentals', '{"1": 25, "2": 50, "3": 100}'),
('basic_midi_controller', 'Basic MIDI Controller Skills', 'Master MIDI controller techniques', '{"1": 25, "2": 50, "3": 100}'),

-- Professional Instruments
('professional_singing', 'Professional Singing', 'Advanced vocal techniques and performance', '{"1": 50, "2": 100, "3": 200}'),
('professional_rapping', 'Professional Rapping', 'Professional rap delivery and lyricism', '{"1": 50, "2": 100, "3": 200}'),
('professional_keyboard', 'Professional Keyboard', 'Advanced keyboard and piano techniques', '{"1": 50, "2": 100, "3": 200}'),
('professional_percussions', 'Professional Percussions', 'Professional drumming and percussion', '{"1": 50, "2": 100, "3": 200}'),
('professional_djing', 'Professional DJing', 'Professional DJ techniques and mixing', '{"1": 50, "2": 100, "3": 200}'),

-- Mastery Instruments
('lead_vocals_mastery', 'Lead Vocals Mastery', 'Master-level vocal performance and technique', '{"1": 100, "2": 200, "3": 400}'),
('piano_mastery', 'Piano Mastery', 'Complete piano and keyboard mastery', '{"1": 100, "2": 200, "3": 400}'),
('drums_mastery', 'Drums Mastery', 'Master-level drumming and percussion', '{"1": 100, "2": 200, "3": 400}'),
('guitar_mastery', 'Guitar Mastery', 'Complete guitar mastery', '{"1": 100, "2": 200, "3": 400}'),
('dj_mastery', 'DJ Mastery', 'Master-level DJing and mixing', '{"1": 100, "2": 200, "3": 400}');

-- Insert Stage & Showmanship skills
INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps) VALUES
-- Basic Stage & Showmanship
('basic_showmanship', 'Basic Showmanship', 'Learn fundamental stage presence and performance', '{"1": 25, "2": 50, "3": 100}'),
('basic_stage_tech', 'Basic Stage Tech', 'Understand basic stage equipment and setup', '{"1": 25, "2": 50, "3": 100}'),
('basic_visual_performance_integration', 'Basic Visual Performance Integration', 'Integrate visuals with musical performance', '{"1": 25, "2": 50, "3": 100}'),
('basic_social_media_performance', 'Basic Social Media Performance', 'Perform and engage on social media platforms', '{"1": 25, "2": 50, "3": 100}'),
('basic_streaming_concerts', 'Basic Streaming Concerts', 'Host basic online streaming performances', '{"1": 25, "2": 50, "3": 100}'),
('basic_crowd_interaction', 'Basic Crowd Interaction', 'Engage and interact with live audiences', '{"1": 25, "2": 50, "3": 100}'),

-- Professional Stage & Showmanship
('professional_showmanship', 'Professional Showmanship', 'Advanced stage presence and performance artistry', '{"1": 50, "2": 100, "3": 200}'),
('professional_stage_tech', 'Professional Stage Tech', 'Master advanced stage technology and production', '{"1": 50, "2": 100, "3": 200}'),
('professional_visual_shows', 'Professional Visual Shows', 'Create professional visual performances', '{"1": 50, "2": 100, "3": 200}'),
('professional_social_media_musician', 'Professional Social Media Musician', 'Professional social media presence and engagement', '{"1": 50, "2": 100, "3": 200}'),
('professional_streaming_shows', 'Professional Streaming Shows', 'Host professional online streaming concerts', '{"1": 50, "2": 100, "3": 200}'),
('professional_crowd_engagement', 'Professional Crowd Engagement', 'Master audience engagement and interaction', '{"1": 50, "2": 100, "3": 200}'),

-- Mastery Stage & Showmanship
('showmanship_mastery', 'Showmanship Mastery', 'Master-level stage presence and performance', '{"1": 100, "2": 200, "3": 400}'),
('stage_tech_mastery', 'Stage Tech Mastery', 'Complete mastery of stage technology and production', '{"1": 100, "2": 200, "3": 400}'),
('visual_performance_mastery', 'Visual Performance Mastery', 'Master-level visual performance integration', '{"1": 100, "2": 200, "3": 400}'),
('social_music_mastery', 'Social Music Mastery', 'Master-level social media music presence', '{"1": 100, "2": 200, "3": 400}'),
('streaming_concert_mastery', 'Streaming Concert Mastery', 'Master-level online concert production', '{"1": 100, "2": 200, "3": 400}'),
('crowd_engagement_mastery', 'Crowd Engagement Mastery', 'Master-level audience engagement and connection', '{"1": 100, "2": 200, "3": 400}');

-- Set up skill progression relationships (basic -> professional -> mastery)
-- Songwriting & Production progression
INSERT INTO public.skill_parent_links (skill_id, parent_skill_id, unlock_threshold) 
SELECT 
  professional.id,
  basic.id,
  50
FROM skill_definitions professional
JOIN skill_definitions basic ON (
  (professional.slug = 'professional_composing' AND basic.slug = 'basic_composing') OR
  (professional.slug = 'professional_lyrics' AND basic.slug = 'basic_lyrics') OR
  (professional.slug = 'professional_record_production' AND basic.slug = 'basic_record_production') OR
  (professional.slug = 'professional_daw_production' AND basic.slug = 'basic_daw_use') OR
  (professional.slug = 'professional_beatmaking' AND basic.slug = 'basic_beatmaking')
);

INSERT INTO public.skill_parent_links (skill_id, parent_skill_id, unlock_threshold)
SELECT 
  mastery.id,
  professional.id,
  100
FROM skill_definitions mastery
JOIN skill_definitions professional ON (
  (mastery.slug = 'composing_mastery' AND professional.slug = 'professional_composing') OR
  (mastery.slug = 'daw_mastery' AND professional.slug = 'professional_daw_production') OR
  (mastery.slug = 'beatmaking_mastery' AND professional.slug = 'professional_beatmaking')
);

-- Genre progression
INSERT INTO public.skill_parent_links (skill_id, parent_skill_id, unlock_threshold)
SELECT 
  professional.id,
  basic.id,
  50
FROM skill_definitions professional
JOIN skill_definitions basic ON (
  (professional.slug = 'professional_rock' AND basic.slug = 'basic_rock') OR
  (professional.slug = 'professional_pop' AND basic.slug = 'basic_pop') OR
  (professional.slug = 'professional_hip_hop' AND basic.slug = 'basic_hip_hop') OR
  (professional.slug = 'professional_edm' AND basic.slug = 'basic_edm')
);

INSERT INTO public.skill_parent_links (skill_id, parent_skill_id, unlock_threshold)
SELECT 
  mastery.id,
  professional.id,
  100
FROM skill_definitions mastery
JOIN skill_definitions professional ON (
  (mastery.slug = 'rock_mastery' AND professional.slug = 'professional_rock') OR
  (mastery.slug = 'pop_mastery' AND professional.slug = 'professional_pop') OR
  (mastery.slug = 'hip_hop_mastery' AND professional.slug = 'professional_hip_hop') OR
  (mastery.slug = 'edm_mastery' AND professional.slug = 'professional_edm')
);

-- Instrument progression
INSERT INTO public.skill_parent_links (skill_id, parent_skill_id, unlock_threshold)
SELECT 
  professional.id,
  basic.id,
  50
FROM skill_definitions professional
JOIN skill_definitions basic ON (
  (professional.slug = 'professional_singing' AND basic.slug = 'basic_singing') OR
  (professional.slug = 'professional_rapping' AND basic.slug = 'basic_rapping') OR
  (professional.slug = 'professional_keyboard' AND basic.slug = 'basic_keyboard') OR
  (professional.slug = 'professional_percussions' AND basic.slug = 'basic_percussions')
);

INSERT INTO public.skill_parent_links (skill_id, parent_skill_id, unlock_threshold)
SELECT 
  mastery.id,
  professional.id,
  100
FROM skill_definitions mastery
JOIN skill_definitions professional ON (
  (mastery.slug = 'lead_vocals_mastery' AND professional.slug = 'professional_singing') OR
  (mastery.slug = 'piano_mastery' AND professional.slug = 'professional_keyboard') OR
  (mastery.slug = 'drums_mastery' AND professional.slug = 'professional_percussions')
);

-- Stage & Showmanship progression
INSERT INTO public.skill_parent_links (skill_id, parent_skill_id, unlock_threshold)
SELECT 
  professional.id,
  basic.id,
  50
FROM skill_definitions professional
JOIN skill_definitions basic ON (
  (professional.slug = 'professional_showmanship' AND basic.slug = 'basic_showmanship') OR
  (professional.slug = 'professional_stage_tech' AND basic.slug = 'basic_stage_tech') OR
  (professional.slug = 'professional_visual_shows' AND basic.slug = 'basic_visual_performance_integration') OR
  (professional.slug = 'professional_crowd_engagement' AND basic.slug = 'basic_crowd_interaction')
);

INSERT INTO public.skill_parent_links (skill_id, parent_skill_id, unlock_threshold)
SELECT 
  mastery.id,
  professional.id,
  100
FROM skill_definitions mastery
JOIN skill_definitions professional ON (
  (mastery.slug = 'showmanship_mastery' AND professional.slug = 'professional_showmanship') OR
  (mastery.slug = 'stage_tech_mastery' AND professional.slug = 'professional_stage_tech') OR
  (mastery.slug = 'visual_performance_mastery' AND professional.slug = 'professional_visual_shows') OR
  (mastery.slug = 'crowd_engagement_mastery' AND professional.slug = 'professional_crowd_engagement')
);