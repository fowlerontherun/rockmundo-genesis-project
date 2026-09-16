-- Canonical DJ and sampling/remixing tier prerequisites.
UPDATE public.skill_definitions
SET tier_caps = coalesce(tier_caps, '{}'::jsonb) || jsonb_build_object(
      'requires', 'basic_dj_controller',
      'required_level', public.progression_skill_max_level('basic_dj_controller'),
      'max_level', 20
    ),
    updated_at = timezone('utc', now())
WHERE slug::text = 'professional_djing';

UPDATE public.skill_definitions
SET tier_caps = coalesce(tier_caps, '{}'::jsonb) || jsonb_build_object(
      'requires', 'professional_djing',
      'required_level', public.progression_skill_max_level('professional_djing'),
      'max_level', 20
    ),
    updated_at = timezone('utc', now())
WHERE slug::text = 'dj_mastery';

UPDATE public.skill_definitions
SET tier_caps = coalesce(tier_caps, '{}'::jsonb) || jsonb_build_object(
      'requires', 'basic_sampling_remixing',
      'required_level', public.progression_skill_max_level('basic_sampling_remixing'),
      'max_level', 20
    ),
    updated_at = timezone('utc', now())
WHERE slug::text = 'professional_sampling_remixing';

UPDATE public.skill_definitions
SET tier_caps = coalesce(tier_caps, '{}'::jsonb) || jsonb_build_object(
      'requires', 'professional_sampling_remixing',
      'required_level', public.progression_skill_max_level('professional_sampling_remixing'),
      'max_level', 20
    ),
    updated_at = timezone('utc', now())
WHERE slug::text = 'sampling_remixing_mastery';
