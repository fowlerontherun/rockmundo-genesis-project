-- Tattoo artist gameplay: persist tracing performance and register tattooing skills.
-- This migration intentionally targets the currently deployed skill_definitions schema.

ALTER TABLE public.player_tattoos
  ADD COLUMN IF NOT EXISTS minigame_score integer,
  ADD COLUMN IF NOT EXISTS minigame_accuracy integer,
  ADD COLUMN IF NOT EXISTS minigame_coverage integer,
  ADD COLUMN IF NOT EXISTS minigame_mistakes integer,
  ADD COLUMN IF NOT EXISTS minigame_difficulty integer;

ALTER TABLE public.player_tattoos
  DROP CONSTRAINT IF EXISTS player_tattoos_minigame_score_check,
  ADD CONSTRAINT player_tattoos_minigame_score_check CHECK (minigame_score IS NULL OR minigame_score BETWEEN 0 AND 100),
  DROP CONSTRAINT IF EXISTS player_tattoos_minigame_accuracy_check,
  ADD CONSTRAINT player_tattoos_minigame_accuracy_check CHECK (minigame_accuracy IS NULL OR minigame_accuracy BETWEEN 0 AND 100),
  DROP CONSTRAINT IF EXISTS player_tattoos_minigame_coverage_check,
  ADD CONSTRAINT player_tattoos_minigame_coverage_check CHECK (minigame_coverage IS NULL OR minigame_coverage BETWEEN 0 AND 100),
  DROP CONSTRAINT IF EXISTS player_tattoos_minigame_mistakes_check,
  ADD CONSTRAINT player_tattoos_minigame_mistakes_check CHECK (minigame_mistakes IS NULL OR minigame_mistakes >= 0),
  DROP CONSTRAINT IF EXISTS player_tattoos_minigame_difficulty_check,
  ADD CONSTRAINT player_tattoos_minigame_difficulty_check CHECK (minigame_difficulty IS NULL OR minigame_difficulty BETWEEN 1 AND 5);

INSERT INTO public.skill_definitions (slug, display_name, description, tier_caps)
VALUES
  ('tattooing_basic_fundamentals','Tattooing Fundamentals','Machine control, hygiene, stencil placement and safe basic linework.','{"max_level":10,"tier":"basic"}'::jsonb),
  ('tattooing_basic_design','Tattoo Design','Create balanced stencils and fit artwork naturally to the body.','{"max_level":10,"tier":"basic"}'::jsonb),
  ('tattooing_professional_linework','Professional Linework','Steadier needle control, cleaner curves and tighter corners.','{"max_level":20,"tier":"professional","requires":"tattooing_basic_fundamentals","required_level":10}'::jsonb),
  ('tattooing_professional_shading','Shading','Build smooth gradients and depth without overworking skin.','{"max_level":20,"tier":"professional","requires":"tattooing_professional_linework","required_level":10}'::jsonb),
  ('tattooing_professional_colour','Colour Packing','Pack saturated colour consistently and understand colour theory.','{"max_level":20,"tier":"professional","requires":"tattooing_professional_linework","required_level":10}'::jsonb),
  ('tattooing_professional_fine_line','Fine Line Tattooing','Execute small, delicate and intricate line tattoos.','{"max_level":20,"tier":"professional","requires":"tattooing_professional_linework","required_level":12}'::jsonb),
  ('tattooing_professional_traditional','Traditional Tattooing','Bold outlines, classic motifs and durable traditional work.','{"max_level":20,"tier":"professional","requires":"tattooing_basic_design","required_level":8}'::jsonb),
  ('tattooing_professional_blackwork','Blackwork','Control dense black fills, negative space and large graphic pieces.','{"max_level":20,"tier":"professional","requires":"tattooing_professional_shading","required_level":12}'::jsonb),
  ('tattooing_mastery_realism','Realism Tattooing','Produce highly detailed realistic tattoos with subtle values.','{"max_level":30,"tier":"mastery","requires":"tattooing_professional_shading","required_level":18}'::jsonb),
  ('tattooing_mastery_portrait','Portrait Tattooing','Capture likeness, expression and skin tone in difficult portrait work.','{"max_level":30,"tier":"mastery","requires":"tattooing_mastery_realism","required_level":20}'::jsonb),
  ('tattooing_mastery','Tattoo Mastery','Elite machine control with maximum steadiness and recovery.','{"max_level":30,"tier":"mastery","requires":"tattooing_professional_linework","required_level":20}'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  tier_caps = EXCLUDED.tier_caps,
  updated_at = now();
