-- Tattoo artist gameplay: persist tracing performance and register tattooing skills.

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

WITH seed(slug, display_name, description, category, subcategory, tier, skill_type, display_order) AS (VALUES
  ('tattooing_basic_fundamentals','Tattooing Fundamentals','Machine control, hygiene, stencil placement and safe basic linework.','Creative Professions','Tattooing','basic','craft',810),
  ('tattooing_basic_design','Tattoo Design','Create balanced stencils and fit artwork naturally to the body.','Creative Professions','Tattooing','basic','craft',811),
  ('tattooing_professional_linework','Professional Linework','Steadier needle control, cleaner curves and tighter corners.','Creative Professions','Tattooing','professional','specialist',820),
  ('tattooing_professional_shading','Shading','Build smooth gradients and depth without overworking skin.','Creative Professions','Tattooing','professional','specialist',821),
  ('tattooing_professional_colour','Colour Packing','Pack saturated colour consistently and understand colour theory.','Creative Professions','Tattooing','professional','specialist',822),
  ('tattooing_professional_fine_line','Fine Line Tattooing','Execute small, delicate and intricate line tattoos.','Creative Professions','Tattooing','professional','specialist',823),
  ('tattooing_professional_traditional','Traditional Tattooing','Bold outlines, classic motifs and durable traditional work.','Creative Professions','Tattooing','professional','specialist',824),
  ('tattooing_professional_blackwork','Blackwork','Control dense black fills, negative space and large graphic pieces.','Creative Professions','Tattooing','professional','specialist',825),
  ('tattooing_mastery_realism','Realism Tattooing','Produce highly detailed realistic tattoos with subtle values.','Creative Professions','Tattooing','mastery','mastery',830),
  ('tattooing_mastery_portrait','Portrait Tattooing','Capture likeness, expression and skin tone in difficult portrait work.','Creative Professions','Tattooing','mastery','mastery',831),
  ('tattooing_mastery','Tattoo Mastery','Elite machine control with maximum steadiness and recovery.','Creative Professions','Tattooing','mastery','mastery',832)
)
INSERT INTO public.skill_definitions (
  slug, display_name, description, tier_caps, default_unlock_level,
  category, subcategory, tier, skill_type, is_foundational, is_practiceable,
  max_level, progression_curve_key, display_order, icon_key
)
SELECT
  slug, display_name, description,
  '{"tiers":[{"tier":1,"cap":20},{"tier":2,"cap":40},{"tier":3,"cap":60},{"tier":4,"cap":80},{"tier":5,"cap":100}]}'::jsonb,
  CASE WHEN slug = 'tattooing_basic_fundamentals' THEN 0 ELSE 1 END,
  category, subcategory, tier, skill_type,
  slug = 'tattooing_basic_fundamentals', true, 100, 'standard_skill', display_order, 'palette'
FROM seed
ON CONFLICT (slug) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  tier = EXCLUDED.tier,
  skill_type = EXCLUDED.skill_type,
  display_order = EXCLUDED.display_order,
  icon_key = EXCLUDED.icon_key,
  is_active = true,
  updated_at = now();

WITH prereqs(skill_slug, req_slug, required_level) AS (VALUES
  ('tattooing_basic_design','tattooing_basic_fundamentals',10),
  ('tattooing_professional_linework','tattooing_basic_fundamentals',20),
  ('tattooing_professional_shading','tattooing_professional_linework',25),
  ('tattooing_professional_colour','tattooing_professional_linework',25),
  ('tattooing_professional_fine_line','tattooing_professional_linework',30),
  ('tattooing_professional_traditional','tattooing_basic_design',25),
  ('tattooing_professional_blackwork','tattooing_professional_shading',30),
  ('tattooing_mastery_realism','tattooing_professional_shading',60),
  ('tattooing_mastery_portrait','tattooing_mastery_realism',75),
  ('tattooing_mastery','tattooing_professional_linework',65)
)
INSERT INTO public.skill_prerequisites (skill_id, prerequisite_skill_id, required_level, prerequisite_type)
SELECT skill.id, req.id, p.required_level, 'required'
FROM prereqs p
JOIN public.skill_definitions skill ON skill.slug = p.skill_slug
JOIN public.skill_definitions req ON req.slug = p.req_slug
ON CONFLICT (skill_id, prerequisite_skill_id, prerequisite_type)
DO UPDATE SET required_level = EXCLUDED.required_level;

INSERT INTO public.skill_unlock_routes (skill_id, route_type, source_key, minimum_source_level, unlock_level, is_active)
SELECT id, 'starter', 'tattoo_parlour', 0, 0, true
FROM public.skill_definitions
WHERE slug = 'tattooing_basic_fundamentals'
ON CONFLICT (skill_id, route_type, source_key) DO NOTHING;
