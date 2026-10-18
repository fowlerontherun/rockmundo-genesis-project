-- Progression balance v2 metadata and catalogue curve assignment.
CREATE TABLE IF NOT EXISTS public.progression_balance_versions (
  version text PRIMARY KEY,
  config jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.progression_balance_versions (version, config, is_active)
VALUES (
  'progression_v2.0.0',
  jsonb_build_object(
    'skill_curves', ARRAY['foundation_fast','standard_role','specialist','mastery','genre','business','social'],
    'practice_base_xp_per_hour', 85,
    'daily_practice_session_limit', 5,
    'learning_attribute_bonus_cap', 0.25,
    'attribute_increment', 10,
    'beginner_bonus', jsonb_build_array(jsonb_build_object('below_level',3,'bonus',0.75), jsonb_build_object('below_level',5,'bonus',0.35)),
    'catch_up', jsonb_build_object('max_bonus',0.20,'max_eligible_level',20)
  ),
  true
)
ON CONFLICT (version) DO UPDATE SET config = EXCLUDED.config, is_active = EXCLUDED.is_active;

UPDATE public.progression_balance_versions
SET is_active = (version = 'progression_v2.0.0');

UPDATE public.skill_definitions
SET progression_curve_key = CASE
  WHEN is_foundational THEN 'foundation_fast'
  WHEN skill_type IN ('genre') THEN 'genre'
  WHEN skill_type IN ('business') THEN 'business'
  WHEN skill_type IN ('social', 'teaching') THEN 'social'
  WHEN tier = 'mastery' OR skill_type = 'mastery' THEN 'mastery'
  WHEN skill_type IN ('production', 'songwriting', 'specialist', 'craft') THEN 'specialist'
  ELSE 'standard_role'
END
WHERE progression_curve_key IS NULL OR progression_curve_key = 'standard_skill';

-- Preserve displayed level if a later lifetime-XP migration is applied.
COMMENT ON TABLE public.progression_balance_versions IS 'Versioned progression economy configuration. progression_v2.0.0 preserves existing skill levels by converting legacy rows to at least the new cumulative XP for the displayed level.';
