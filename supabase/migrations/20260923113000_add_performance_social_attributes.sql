BEGIN;

INSERT INTO public.attribute_catalog (key, name, description, base_value, max_value, category)
VALUES
  (
    'stage_presence',
    'Stage Presence',
    'Measures how commanding and charismatic performances feel to a live audience.',
    1.0,
    3.0,
    'performance'
  ),
  (
    'crowd_engagement',
    'Crowd Engagement',
    'Tracks how effectively a performer hypes audiences and keeps energy high.',
    1.0,
    3.0,
    'performance'
  ),
  (
    'social_reach',
    'Social Reach',
    'Represents online influence and the ability to convert content into new fans.',
    1.0,
    3.0,
    'social'
  )
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_value = EXCLUDED.base_value,
  max_value = EXCLUDED.max_value,
  category = EXCLUDED.category,
  updated_at = now();

ALTER TABLE public.player_attributes
  ADD COLUMN IF NOT EXISTS stage_presence numeric(6,3) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS crowd_engagement numeric(6,3) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS social_reach numeric(6,3) NOT NULL DEFAULT 1.0;

UPDATE public.player_attributes
SET
  stage_presence = COALESCE(stage_presence, 1.0),
  crowd_engagement = COALESCE(crowd_engagement, 1.0),
  social_reach = COALESCE(social_reach, 1.0);

COMMIT;
