-- Remove all existing YouTube video resources and create new skill-linked ones
DELETE FROM public.education_youtube_resources;

-- Insert new videos directly linked to valid skills
INSERT INTO public.education_youtube_resources (title, description, video_url, category, difficulty_level, duration_minutes, tags) VALUES
-- Guitar skill videos
('Guitar Basics: First Chords', 'Learn the essential open chords every guitarist needs to know', 'https://youtube.com/watch?v=guitarbasics1', 'guitar', 1, 15, ARRAY['guitar', 'beginner', 'chords']),
('Fingerpicking Patterns', 'Master fingerpicking techniques for acoustic guitar', 'https://youtube.com/watch?v=fingerpicking', 'guitar', 2, 20, ARRAY['guitar', 'intermediate', 'fingerpicking']),
('Electric Guitar Tone Secrets', 'How to dial in great tone on your electric guitar', 'https://youtube.com/watch?v=guitartone', 'guitar', 2, 18, ARRAY['guitar', 'intermediate', 'tone']),
('Advanced Solo Techniques', 'Take your guitar solos to the next level', 'https://youtube.com/watch?v=guitarsolos', 'guitar', 3, 25, ARRAY['guitar', 'advanced', 'solos']),

-- Bass skill videos
('Bass Fundamentals', 'Essential bass techniques for beginners', 'https://youtube.com/watch?v=bassbasics', 'bass', 1, 15, ARRAY['bass', 'beginner', 'fundamentals']),
('Groove and Pocket Playing', 'Learn to lock in with the drums and create solid grooves', 'https://youtube.com/watch?v=bassgroove', 'bass', 2, 20, ARRAY['bass', 'intermediate', 'groove']),
('Slap Bass Essentials', 'Master the slap and pop technique', 'https://youtube.com/watch?v=slapbass', 'bass', 3, 22, ARRAY['bass', 'advanced', 'slap']),

-- Drums skill videos
('Drum Kit Setup & Basics', 'How to set up your kit and basic stick technique', 'https://youtube.com/watch?v=drumbasics', 'drums', 1, 12, ARRAY['drums', 'beginner', 'setup']),
('Essential Rock Beats', 'Learn the most common rock drum patterns', 'https://youtube.com/watch?v=rockbeats', 'drums', 1, 18, ARRAY['drums', 'beginner', 'rock']),
('Fills and Transitions', 'Creative drum fills to connect your grooves', 'https://youtube.com/watch?v=drumfills', 'drums', 2, 20, ARRAY['drums', 'intermediate', 'fills']),
('Double Bass Drumming', 'Develop your double bass pedal technique', 'https://youtube.com/watch?v=doublebass', 'drums', 3, 25, ARRAY['drums', 'advanced', 'double-bass']),

-- Vocals skill videos
('Vocal Warm-Ups', 'Essential warm-up exercises for singers', 'https://youtube.com/watch?v=vocalwarmups', 'vocals', 1, 10, ARRAY['vocals', 'beginner', 'warmups']),
('Breath Control Techniques', 'Master your breathing for better vocal performance', 'https://youtube.com/watch?v=breathcontrol', 'vocals', 2, 15, ARRAY['vocals', 'intermediate', 'breathing']),
('Harmony and Backing Vocals', 'Learn to sing harmonies and backing parts', 'https://youtube.com/watch?v=harmonyvocals', 'vocals', 2, 20, ARRAY['vocals', 'intermediate', 'harmony']),
('Advanced Vocal Techniques', 'Belting, runs, and advanced vocal styles', 'https://youtube.com/watch?v=advancedvocals', 'vocals', 3, 25, ARRAY['vocals', 'advanced', 'techniques']),

-- Performance skill videos
('Stage Presence Basics', 'How to command the stage and engage your audience', 'https://youtube.com/watch?v=stagepresence', 'performance', 1, 15, ARRAY['performance', 'beginner', 'stage']),
('Crowd Interaction', 'Tips for connecting with your audience during shows', 'https://youtube.com/watch?v=crowdinteraction', 'performance', 2, 18, ARRAY['performance', 'intermediate', 'crowd']),
('Managing Stage Fright', 'Overcome nerves and perform with confidence', 'https://youtube.com/watch?v=stagefright', 'performance', 1, 12, ARRAY['performance', 'beginner', 'confidence']),
('Live Sound for Musicians', 'Understanding monitors, FOH, and live audio', 'https://youtube.com/watch?v=livesound', 'performance', 2, 22, ARRAY['performance', 'intermediate', 'sound']),

-- Songwriting skill videos
('Songwriting Fundamentals', 'Structure, melody, and lyric basics', 'https://youtube.com/watch?v=songwritingbasics', 'songwriting', 1, 20, ARRAY['songwriting', 'beginner', 'fundamentals']),
('Chord Progressions That Work', 'Common progressions and how to use them', 'https://youtube.com/watch?v=chordprogressions', 'songwriting', 1, 18, ARRAY['songwriting', 'beginner', 'chords']),
('Writing Memorable Hooks', 'Craft hooks that stick in people''s heads', 'https://youtube.com/watch?v=writinghooks', 'songwriting', 2, 20, ARRAY['songwriting', 'intermediate', 'hooks']),
('Lyric Writing Workshop', 'Deep dive into writing meaningful lyrics', 'https://youtube.com/watch?v=lyricwriting', 'songwriting', 2, 25, ARRAY['songwriting', 'intermediate', 'lyrics']),
('Advanced Song Arrangement', 'Take your songs to the next level with pro arrangements', 'https://youtube.com/watch?v=songarrangement', 'songwriting', 3, 30, ARRAY['songwriting', 'advanced', 'arrangement']);