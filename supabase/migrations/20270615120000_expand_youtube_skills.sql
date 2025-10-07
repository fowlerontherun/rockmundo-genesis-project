-- Expand YouTube lesson skill tags to cover the extended instrument catalog
ALTER TABLE public.education_youtube_lessons
  DROP CONSTRAINT IF EXISTS education_youtube_lessons_skill_check;

ALTER TABLE public.education_youtube_lessons
  ADD CONSTRAINT education_youtube_lessons_skill_check
  CHECK (
    skill IN (
      'guitar',
      'bass',
      'drums',
      'vocals',
      'performance',
      'songwriting',
      'string_instruments',
      'advanced_strings',
      'modern_bass',
      'keyboard_piano',
      'synths_keys',
      'percussion_drums',
      'electronic_percussion',
      'wind_instruments',
      'brass_instruments',
      'world_folk',
      'dj_live',
      'electronic_sampling',
      'vocal_performance',
      'vocal_fx',
      'hybrid_experimental',
      'orchestral_cinematic',
      'digital_music_tools',
      'sound_engineering',
      'songwriting_arrangement'
    )
  );
