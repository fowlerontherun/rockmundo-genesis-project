-- Higher-tier university courses must not require levels in the target skill itself.
-- Their eligibility is controlled by skill_tier_unlocked() against the previous tier.
WITH higher_tier_skills AS (
  SELECT sd.slug::text AS slug
  FROM public.skill_definitions sd
  WHERE sd.slug::text ILIKE '%professional%'
     OR sd.slug::text ILIKE '%mastery%'
     OR coalesce(sd.display_name, '') ILIKE '%professional%'
     OR coalesce(sd.display_name, '') ILIKE '%mastery%'
)
UPDATE public.university_courses uc
SET required_skill_level = 0
FROM higher_tier_skills ht
WHERE uc.skill_slug = ht.slug
  AND coalesce(uc.required_skill_level, 0) <> 0;

-- Extend the authoritative tier check to legacy Professional slugs that use
-- professional_<topic> rather than <category>_professional_<topic>.
CREATE OR REPLACE FUNCTION public.skill_tier_unlocked(p_profile_id uuid, p_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caps jsonb;
  v_prereq text;
  v_required_level integer;
  v_level integer;
  v_candidate text;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN true;
  END IF;

  SELECT sd.tier_caps
    INTO v_caps
  FROM public.skill_definitions sd
  WHERE sd.slug::text = p_slug
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF coalesce(v_caps->>'requires', '') <> '' THEN
    v_prereq := v_caps->>'requires';
    v_required_level := CASE
      WHEN (v_caps->>'required_level') ~ '^[0-9]+$'
        THEN greatest(1, (v_caps->>'required_level')::integer)
      ELSE public.progression_skill_max_level(v_prereq)
    END;
  ELSIF position('_basic_' in p_slug) > 0 THEN
    RETURN true;
  ELSIF position('_professional_' in p_slug) > 0 THEN
    v_prereq := replace(p_slug, '_professional_', '_basic_');
    v_required_level := public.progression_skill_max_level(v_prereq);
  ELSIF position('_mastery_' in p_slug) > 0 THEN
    v_prereq := replace(p_slug, '_mastery_', '_professional_');
    v_required_level := public.progression_skill_max_level(v_prereq);
  ELSIF p_slug LIKE 'professional\_%' ESCAPE '\' THEN
    v_candidate := 'basic_' || substring(p_slug from char_length('professional_') + 1);

    IF EXISTS (SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text = v_candidate) THEN
      v_prereq := v_candidate;
    ELSE
      v_prereq := CASE p_slug
        WHEN 'professional_ai_music_integration' THEN 'basic_ai_music_tools'
        WHEN 'professional_crowd_engagement' THEN 'basic_crowd_interaction'
        WHEN 'professional_daw_production' THEN 'basic_daw_use'
        WHEN 'professional_social_media_musician' THEN 'basic_social_media_performance'
        WHEN 'professional_streaming_shows' THEN 'basic_streaming_concerts'
        WHEN 'professional_visual_shows' THEN 'basic_visual_performance_integration'
        WHEN 'professional_vocal_production' THEN 'basic_vocal_tuning_processing'
        ELSE NULL
      END;
    END IF;

    -- Specialist Professional skills with no one-to-one Basic predecessor are
    -- left to their explicit specialist rules rather than inventing a parent.
    IF v_prereq IS NULL THEN
      RETURN true;
    END IF;

    v_required_level := public.progression_skill_max_level(v_prereq);
  ELSE
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text = v_prereq
  ) THEN
    RETURN false;
  END IF;

  IF v_required_level IS NULL THEN
    v_required_level := public.progression_skill_max_level(v_prereq);
  END IF;

  SELECT sp.current_level
    INTO v_level
  FROM public.skill_progress sp
  WHERE sp.profile_id = p_profile_id
    AND sp.skill_slug = v_prereq;

  RETURN coalesce(v_level, 0) >= v_required_level;
END;
$function$;

COMMENT ON FUNCTION public.skill_tier_unlocked(uuid, text) IS
  'Authoritative skill tier eligibility, including canonical and legacy Professional naming conventions.';
