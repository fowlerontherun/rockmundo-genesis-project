-- Fix mentor focus_skill to use valid skill_definitions slugs
UPDATE education_mentors SET focus_skill = 'songwriting_basic_composing' WHERE focus_skill = 'vocals';
UPDATE education_mentors SET focus_skill = 'instruments_basic_acoustic_guitar' WHERE focus_skill = 'guitar';
UPDATE education_mentors SET focus_skill = 'instruments_basic_bass_guitar' WHERE focus_skill = 'bass';
UPDATE education_mentors SET focus_skill = 'instruments_basic_drum_kit' WHERE focus_skill = 'drums';
UPDATE education_mentors SET focus_skill = 'songwriting_basic_composing' WHERE focus_skill = 'songwriting';
UPDATE education_mentors SET focus_skill = 'showmanship_basic_stage_presence' WHERE focus_skill = 'performance';

-- Add missing skill definitions for commonly used orphan slugs (for backwards compatibility with existing progress)
INSERT INTO skill_definitions (slug, display_name, description)
VALUES 
  ('vocals', 'Vocals', 'General vocal training from mentors and videos'),
  ('guitar', 'Guitar', 'General guitar training from mentors and videos'),
  ('bass', 'Bass', 'General bass guitar training from mentors and videos'),
  ('drums', 'Drums', 'General drums training from mentors and videos'),
  ('songwriting', 'Songwriting', 'General songwriting training from mentors and videos'),
  ('performance', 'Performance', 'General performance training from mentors and videos')
ON CONFLICT (slug) DO NOTHING;