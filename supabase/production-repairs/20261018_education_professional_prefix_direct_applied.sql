-- LIVE REPAIR APPLIED DIRECTLY TO SUPABASE ON 2026-10-18.
-- Historical record only. DO NOT replay blindly: guard deliberately fails if
-- prefix tier logic is already present.
-- The function preserves its existing ownership/grants/SECURITY DEFINER and
-- its authoritative explicit tier_caps / parent link behavior.
BEGIN;
DO $repair$
DECLARE
  definition text;
  anchor text := E'  ELSIF right(p_slug, 8) = ''_mastery'' THEN\n';
  insertion text := E'  ELSIF left(p_slug, 13) = ''professional_'' THEN\n'
    || E'    -- Legacy prefix-style Professional tiers need a maxed Basic prerequisite.\n'
    || E'    -- Preserve skill XP earned before the rule was corrected.\n'
    || E'    IF public.skill_progress_level_for_slug(p_profile_id, p_slug) > 0 THEN\n'
    || E'      RETURN true;\n'
    || E'    END IF;\n'
    || E'    v_prereq := ''basic_'' || substr(p_slug, 14);\n'
    || E'    IF NOT EXISTS (SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text = v_prereq) THEN\n'
    || E'      RETURN false;\n'
    || E'    END IF;\n';
BEGIN
  SELECT pg_get_functiondef('public.skill_tier_unlocked(uuid,text)'::regprocedure) INTO definition;
  IF definition IS NULL OR position(anchor IN definition) = 0
    OR position('left(p_slug, 13)' IN definition) > 0 THEN
    RAISE EXCEPTION 'Unexpected skill_tier_unlocked source; aborting safe repair';
  END IF;
  EXECUTE replace(definition, anchor, insertion || anchor);
END $repair$;
DO $verify$
DECLARE fake_profile uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF public.skill_tier_unlocked(fake_profile, 'professional_mixing_mastering')
     OR public.skill_tier_unlocked(fake_profile, 'professional_live_looping')
     OR public.skill_tier_unlocked(fake_profile, 'professional_ai_music_integration')
     OR public.skill_tier_unlocked(fake_profile, 'professional_campaign_strategy') THEN
    RAISE EXCEPTION 'Professional skill unexpectedly unlocked without prerequisite';
  END IF;
  IF NOT public.skill_tier_unlocked(fake_profile, 'basic_mixing_mastering')
     OR NOT public.skill_tier_unlocked(fake_profile, 'guitar')
     OR public.skill_tier_unlocked(fake_profile, 'guitar_mastery') THEN
    RAISE EXCEPTION 'Basic/Mastery regression in eligibility repair';
  END IF;
END $verify$;
COMMIT;

-- Separate live transaction completed after function patch:
-- Existing mappings match src/pages/UniversityDetail.tsx and the
-- 20260916171000_fix_university_higher_tier_prerequisites.sql plan.
-- (Safely rerun only after reviewing the expected row count.)
BEGIN;
DO $sync$
DECLARE updated integer;
BEGIN
  WITH mappings(professional, basic) AS (
    VALUES
      ('professional_ai_music_integration', 'basic_ai_music_tools'),
      ('professional_social_media_musician', 'basic_social_media_performance'),
      ('professional_streaming_shows', 'basic_streaming_concerts'),
      ('professional_vocal_production', 'basic_vocal_tuning_processing')
  )
  UPDATE public.skill_definitions sd
  SET tier_caps = coalesce(sd.tier_caps, '{}'::jsonb) || jsonb_build_object(
    'requires', mappings.basic,
    'required_level', public.progression_skill_max_level(mappings.basic)
  )
  FROM mappings
  WHERE sd.slug::text = mappings.professional
    AND coalesce(sd.tier_caps->>'requires', '') = ''
    AND EXISTS (
      SELECT 1 FROM public.skill_definitions prereq
      WHERE prereq.slug::text = mappings.basic
    );
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 4 THEN
    RAISE EXCEPTION 'Expected exactly 4 prerequisite updates, got %', updated;
  END IF;
END $sync$;
DO $verify$
DECLARE p uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF public.skill_tier_unlocked(p,'professional_ai_music_integration')
     OR public.skill_tier_unlocked(p,'professional_social_media_musician')
     OR public.skill_tier_unlocked(p,'professional_streaming_shows')
     OR public.skill_tier_unlocked(p,'professional_vocal_production') THEN
    RAISE EXCEPTION 'Mapped Professional tier cannot unlock with zero progress';
  END IF;
  IF NOT public.skill_tier_unlocked(p,'basic_ai_music_tools') THEN
    RAISE EXCEPTION 'Basic prerequisite unexpectedly unavailable';
  END IF;
END $verify$;
COMMIT;
