-- Applied directly to production on 18 October 2026; do not replay blindly.
-- Fix the gap where legacy skills ending "_mastery" can bypass tier prerequisites.
-- Preserve the function's existing parent-link and tier_caps precedence, owner, and grants.
BEGIN;
DO $patch$
DECLARE
  v_original text;
  v_needle text := E'  ELSE\n    RETURN true;\n  END IF;\n\n  IF NOT EXISTS (';
  v_replacement text := E'  ELSIF right(p_slug, 8) = ''_mastery'' THEN\n    -- Grandfather characters who already learned this legacy skill.\n    IF public.skill_progress_level_for_slug(p_profile_id, p_slug) > 0 THEN\n      RETURN true;\n    END IF;\n    v_prereq := left(p_slug, length(p_slug) - 8);\n    IF EXISTS (SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text = ''professional_'' || v_prereq) THEN\n      v_prereq := ''professional_'' || v_prereq;\n    ELSIF NOT EXISTS (SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text = v_prereq) THEN\n      RETURN false;\n    END IF;\n  ELSE\n    RETURN true;\n  END IF;\n\n  IF NOT EXISTS (';
BEGIN
  SELECT pg_get_functiondef('public.skill_tier_unlocked(uuid,text)'::regprocedure) INTO v_original;
  IF v_original IS NULL OR position(v_needle in v_original) = 0 THEN
    RAISE EXCEPTION 'Cannot safely patch skill_tier_unlocked: expected fallback source not found';
  END IF;
  EXECUTE replace(v_original, v_needle, v_replacement);
END
$patch$;
DO $verify$
DECLARE
  v_new_profile constant uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF public.skill_tier_unlocked(v_new_profile, 'guitar_mastery') THEN
    RAISE EXCEPTION 'Legacy mastery must remain locked for a new profile';
  END IF;
  IF public.skill_tier_unlocked(v_new_profile, 'dj_mastery') THEN
    RAISE EXCEPTION 'Explicit mentor prerequisite must remain enforced';
  END IF;
  IF NOT public.skill_tier_unlocked(v_new_profile, 'guitar') THEN
    RAISE EXCEPTION 'Normal foundation skill must remain available';
  END IF;
END
$verify$;
COMMIT;
