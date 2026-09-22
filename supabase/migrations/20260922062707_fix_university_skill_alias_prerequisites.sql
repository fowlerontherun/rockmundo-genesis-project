-- Fix university prerequisite checks when players have progress on legacy genre
-- slugs (for example basic_punk_rock) while the canonical skill tree uses
-- genres_basic_punk_rock. Also make the skill relationship threshold the
-- authoritative prerequisite level instead of assuming every prior tier is 20.

CREATE OR REPLACE FUNCTION public.skill_progress_level_for_slug(
  p_profile_id uuid,
  p_slug text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_level integer := 0;
  v_aliases text[] := ARRAY[p_slug];
  v_tail text;
  v_legacy text;
BEGIN
  IF p_profile_id IS NULL OR p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN 0;
  END IF;

  IF p_slug LIKE 'genres_basic_%' THEN
    v_tail := substring(p_slug from char_length('genres_basic_') + 1);
    v_aliases := array_append(v_aliases, 'basic_' || v_tail);
    v_legacy := CASE p_slug
      WHEN 'genres_basic_r_and_b' THEN 'basic_rnb'
      WHEN 'genres_basic_lo_fi_hip_hop' THEN 'basic_lofi_hip_hop'
      WHEN 'genres_basic_k_pop_j_pop' THEN 'basic_kpop_jpop'
      WHEN 'genres_basic_alt_r_and_b_neo_soul' THEN 'basic_alt_rnb_neo_soul'
      ELSE NULL
    END;
  ELSIF p_slug LIKE 'genres_professional_%' THEN
    v_tail := substring(p_slug from char_length('genres_professional_') + 1);
    v_aliases := array_append(v_aliases, 'professional_' || v_tail);
    v_legacy := CASE p_slug
      WHEN 'genres_professional_r_and_b' THEN 'professional_rnb'
      WHEN 'genres_professional_lo_fi_hip_hop' THEN 'professional_lofi_hip_hop'
      WHEN 'genres_professional_k_pop_j_pop' THEN 'professional_kpop_jpop'
      WHEN 'genres_professional_alt_r_and_b_neo_soul' THEN 'professional_alt_rnb_neo_soul'
      ELSE NULL
    END;
  ELSIF p_slug LIKE 'genres_mastery_%' THEN
    v_tail := substring(p_slug from char_length('genres_mastery_') + 1);
    v_aliases := array_append(v_aliases, v_tail || '_mastery');
    v_legacy := CASE p_slug
      WHEN 'genres_mastery_r_and_b' THEN 'rnb_mastery'
      WHEN 'genres_mastery_lo_fi_hip_hop' THEN 'lofi_hip_hop_mastery'
      WHEN 'genres_mastery_k_pop_j_pop' THEN 'kpop_jpop_mastery'
      WHEN 'genres_mastery_alt_r_and_b_neo_soul' THEN 'alt_rnb_neo_soul_mastery'
      ELSE NULL
    END;
  END IF;

  IF v_legacy IS NOT NULL THEN
    v_aliases := array_append(v_aliases, v_legacy);
  END IF;

  SELECT coalesce(max(coalesce(sp.current_level, 0)), 0)
    INTO v_level
  FROM public.skill_progress sp
  WHERE sp.profile_id = p_profile_id
    AND sp.skill_slug = ANY(v_aliases);

  RETURN coalesce(v_level, 0);
END;
$function$;

COMMENT ON FUNCTION public.skill_progress_level_for_slug(uuid, text) IS
  'Returns the highest current level across a canonical skill slug and its known legacy genre aliases.';

CREATE OR REPLACE FUNCTION public.skill_tier_unlocked(p_profile_id uuid, p_slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_skill_id uuid;
  v_caps jsonb;
  v_prereq text;
  v_required_level integer;
  v_level integer;
  v_parent record;
  v_has_parent_link boolean := false;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN true;
  END IF;

  SELECT sd.id, sd.tier_caps
    INTO v_skill_id, v_caps
  FROM public.skill_definitions sd
  WHERE sd.slug::text = p_slug
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Parent links are the authoritative relationship model. Their
  -- unlock_threshold is a level threshold, not the target skill's max level.
  FOR v_parent IN
    SELECT parent.slug::text AS parent_slug,
           coalesce(spl.unlock_threshold, public.progression_skill_max_level(parent.slug::text)) AS required_level
    FROM public.skill_parent_links spl
    JOIN public.skill_definitions parent ON parent.id = spl.parent_skill_id
    WHERE spl.skill_id = v_skill_id
    ORDER BY parent.slug::text
  LOOP
    v_has_parent_link := true;
    v_required_level := greatest(1, coalesce(v_parent.required_level, 1));
    v_level := public.skill_progress_level_for_slug(p_profile_id, v_parent.parent_slug);

    IF v_level < v_required_level THEN
      RETURN false;
    END IF;
  END LOOP;

  IF v_has_parent_link THEN
    RETURN true;
  END IF;

  -- Legacy definitions that encode a prerequisite in tier_caps still work.
  IF coalesce(v_caps->>'requires', '') <> '' THEN
    v_prereq := v_caps->>'requires';
    v_required_level := CASE
      WHEN (v_caps->>'required_level') ~ '^[0-9]+$'
        THEN greatest(1, (v_caps->>'required_level')::integer)
      ELSE public.progression_skill_max_level(v_prereq)
    END;

    RETURN public.skill_progress_level_for_slug(p_profile_id, v_prereq) >= v_required_level;
  END IF;

  -- Last-resort convention fallback for tiered definitions without links.
  IF position('_basic_' in p_slug) > 0 THEN
    RETURN true;
  ELSIF position('_professional_' in p_slug) > 0 THEN
    v_prereq := replace(p_slug, '_professional_', '_basic_');
  ELSIF position('_mastery_' in p_slug) > 0 THEN
    v_prereq := replace(p_slug, '_mastery_', '_professional_');
  ELSE
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.skill_definitions sd
    WHERE sd.slug::text = v_prereq
  ) THEN
    RETURN false;
  END IF;

  v_required_level := public.progression_skill_max_level(v_prereq);
  RETURN public.skill_progress_level_for_slug(p_profile_id, v_prereq) >= v_required_level;
END;
$function$;

-- Copy legacy genre progress into canonical genre rows so currently deployed
-- clients immediately see the same earned level.
WITH aliases(legacy_slug, canonical_slug) AS (
  VALUES
    ('basic_rock','genres_basic_rock'),
    ('basic_pop','genres_basic_pop'),
    ('basic_hip_hop','genres_basic_hip_hop'),
    ('basic_jazz','genres_basic_jazz'),
    ('basic_blues','genres_basic_blues'),
    ('basic_country','genres_basic_country'),
    ('basic_reggae','genres_basic_reggae'),
    ('basic_heavy_metal','genres_basic_heavy_metal'),
    ('basic_classical','genres_basic_classical'),
    ('basic_electronica','genres_basic_electronica'),
    ('basic_latin','genres_basic_latin'),
    ('basic_world_music','genres_basic_world_music'),
    ('basic_rnb','genres_basic_r_and_b'),
    ('basic_punk_rock','genres_basic_punk_rock'),
    ('basic_flamenco','genres_basic_flamenco'),
    ('basic_african_music','genres_basic_african_music'),
    ('basic_modern_rock','genres_basic_modern_rock'),
    ('basic_edm','genres_basic_edm'),
    ('basic_trap','genres_basic_trap'),
    ('basic_drill','genres_basic_drill'),
    ('basic_lofi_hip_hop','genres_basic_lo_fi_hip_hop'),
    ('basic_kpop_jpop','genres_basic_k_pop_j_pop'),
    ('basic_afrobeats_amapiano','genres_basic_afrobeats_amapiano'),
    ('basic_synthwave','genres_basic_synthwave'),
    ('basic_indie_bedroom_pop','genres_basic_indie_bedroom_pop'),
    ('basic_hyperpop','genres_basic_hyperpop'),
    ('basic_metalcore_djent','genres_basic_metalcore_djent'),
    ('basic_alt_rnb_neo_soul','genres_basic_alt_r_and_b_neo_soul')
),
legacy_progress AS (
  SELECT
    sp.profile_id,
    a.canonical_slug,
    sp.current_level,
    sp.current_xp,
    sp.required_xp,
    sp.last_practiced_at,
    coalesce(sp.metadata, '{}'::jsonb) ||
      jsonb_build_object('legacy_alias_source', sp.skill_slug) AS metadata
  FROM public.skill_progress sp
  JOIN aliases a ON a.legacy_slug = sp.skill_slug
)
INSERT INTO public.skill_progress (
  profile_id,
  skill_slug,
  current_level,
  current_xp,
  required_xp,
  last_practiced_at,
  metadata
)
SELECT
  lp.profile_id,
  lp.canonical_slug,
  lp.current_level,
  lp.current_xp,
  lp.required_xp,
  lp.last_practiced_at,
  lp.metadata
FROM legacy_progress lp
ON CONFLICT (profile_id, skill_slug) DO UPDATE
SET
  current_level = greatest(coalesce(public.skill_progress.current_level, 0), coalesce(EXCLUDED.current_level, 0)),
  current_xp = CASE
    WHEN coalesce(EXCLUDED.current_level, 0) > coalesce(public.skill_progress.current_level, 0)
      THEN coalesce(EXCLUDED.current_xp, 0)
    WHEN coalesce(EXCLUDED.current_level, 0) = coalesce(public.skill_progress.current_level, 0)
      THEN greatest(coalesce(public.skill_progress.current_xp, 0), coalesce(EXCLUDED.current_xp, 0))
    ELSE coalesce(public.skill_progress.current_xp, 0)
  END,
  required_xp = CASE
    WHEN coalesce(EXCLUDED.current_level, 0) >= coalesce(public.skill_progress.current_level, 0)
      THEN EXCLUDED.required_xp
    ELSE public.skill_progress.required_xp
  END,
  last_practiced_at = greatest(public.skill_progress.last_practiced_at, EXCLUDED.last_practiced_at),
  metadata = coalesce(public.skill_progress.metadata, '{}'::jsonb) || coalesce(EXCLUDED.metadata, '{}'::jsonb),
  updated_at = timezone('utc', now());

-- Persist the real relationship threshold in canonical genre definitions too,
-- so stale clients that only read tier_caps stop inventing level 20.
UPDATE public.skill_definitions child
SET tier_caps = coalesce(child.tier_caps, '{}'::jsonb) ||
  jsonb_build_object(
    'requires', parent.slug::text,
    'required_level', spl.unlock_threshold
  )
FROM public.skill_parent_links spl
JOIN public.skill_definitions parent ON parent.id = spl.parent_skill_id
WHERE child.id = spl.skill_id
  AND (child.slug::text LIKE 'genres_professional_%'
       OR child.slug::text LIKE 'genres_mastery_%')
  AND spl.unlock_threshold IS NOT NULL;

-- Hide legacy duplicate university courses when a canonical equivalent already
-- exists at the same university, then convert remaining legacy-only rows.
WITH aliases(legacy_slug, canonical_slug) AS (
  VALUES
    ('basic_rock','genres_basic_rock'),
    ('basic_pop','genres_basic_pop'),
    ('basic_hip_hop','genres_basic_hip_hop'),
    ('basic_jazz','genres_basic_jazz'),
    ('basic_blues','genres_basic_blues'),
    ('basic_country','genres_basic_country'),
    ('basic_reggae','genres_basic_reggae'),
    ('basic_heavy_metal','genres_basic_heavy_metal'),
    ('basic_classical','genres_basic_classical'),
    ('basic_electronica','genres_basic_electronica'),
    ('basic_latin','genres_basic_latin'),
    ('basic_world_music','genres_basic_world_music'),
    ('basic_rnb','genres_basic_r_and_b'),
    ('basic_punk_rock','genres_basic_punk_rock'),
    ('basic_flamenco','genres_basic_flamenco'),
    ('basic_african_music','genres_basic_african_music'),
    ('basic_modern_rock','genres_basic_modern_rock'),
    ('basic_edm','genres_basic_edm'),
    ('basic_trap','genres_basic_trap'),
    ('basic_drill','genres_basic_drill'),
    ('basic_lofi_hip_hop','genres_basic_lo_fi_hip_hop'),
    ('basic_kpop_jpop','genres_basic_k_pop_j_pop'),
    ('basic_afrobeats_amapiano','genres_basic_afrobeats_amapiano'),
    ('basic_synthwave','genres_basic_synthwave'),
    ('basic_indie_bedroom_pop','genres_basic_indie_bedroom_pop'),
    ('basic_hyperpop','genres_basic_hyperpop'),
    ('basic_metalcore_djent','genres_basic_metalcore_djent'),
    ('basic_alt_rnb_neo_soul','genres_basic_alt_r_and_b_neo_soul'),
    ('professional_rock','genres_professional_rock'),
    ('professional_pop','genres_professional_pop'),
    ('professional_hip_hop','genres_professional_hip_hop'),
    ('professional_edm','genres_professional_edm'),
    ('professional_trap','genres_professional_trap'),
    ('rock_mastery','genres_mastery_rock'),
    ('pop_mastery','genres_mastery_pop'),
    ('hip_hop_mastery','genres_mastery_hip_hop'),
    ('edm_mastery','genres_mastery_edm')
)
UPDATE public.university_courses legacy
SET is_active = false
FROM aliases a
WHERE legacy.skill_slug = a.legacy_slug
  AND legacy.is_active
  AND EXISTS (
    SELECT 1
    FROM public.university_courses canonical
    WHERE canonical.university_id = legacy.university_id
      AND canonical.skill_slug = a.canonical_slug
      AND canonical.is_active
  );

WITH aliases(legacy_slug, canonical_slug) AS (
  VALUES
    ('basic_rock','genres_basic_rock'),
    ('basic_pop','genres_basic_pop'),
    ('basic_hip_hop','genres_basic_hip_hop'),
    ('basic_jazz','genres_basic_jazz'),
    ('basic_blues','genres_basic_blues'),
    ('basic_country','genres_basic_country'),
    ('basic_reggae','genres_basic_reggae'),
    ('basic_heavy_metal','genres_basic_heavy_metal'),
    ('basic_classical','genres_basic_classical'),
    ('basic_electronica','genres_basic_electronica'),
    ('basic_latin','genres_basic_latin'),
    ('basic_world_music','genres_basic_world_music'),
    ('basic_rnb','genres_basic_r_and_b'),
    ('basic_punk_rock','genres_basic_punk_rock'),
    ('basic_flamenco','genres_basic_flamenco'),
    ('basic_african_music','genres_basic_african_music'),
    ('basic_modern_rock','genres_basic_modern_rock'),
    ('basic_edm','genres_basic_edm'),
    ('basic_trap','genres_basic_trap'),
    ('basic_drill','genres_basic_drill'),
    ('basic_lofi_hip_hop','genres_basic_lo_fi_hip_hop'),
    ('basic_kpop_jpop','genres_basic_k_pop_j_pop'),
    ('basic_afrobeats_amapiano','genres_basic_afrobeats_amapiano'),
    ('basic_synthwave','genres_basic_synthwave'),
    ('basic_indie_bedroom_pop','genres_basic_indie_bedroom_pop'),
    ('basic_hyperpop','genres_basic_hyperpop'),
    ('basic_metalcore_djent','genres_basic_metalcore_djent'),
    ('basic_alt_rnb_neo_soul','genres_basic_alt_r_and_b_neo_soul'),
    ('professional_rock','genres_professional_rock'),
    ('professional_pop','genres_professional_pop'),
    ('professional_hip_hop','genres_professional_hip_hop'),
    ('professional_edm','genres_professional_edm'),
    ('professional_trap','genres_professional_trap'),
    ('rock_mastery','genres_mastery_rock'),
    ('pop_mastery','genres_mastery_pop'),
    ('hip_hop_mastery','genres_mastery_hip_hop'),
    ('edm_mastery','genres_mastery_edm')
)
UPDATE public.university_courses legacy
SET skill_slug = a.canonical_slug
FROM aliases a
WHERE legacy.skill_slug = a.legacy_slug
  AND legacy.is_active
  AND NOT EXISTS (
    SELECT 1
    FROM public.university_courses canonical
    WHERE canonical.university_id = legacy.university_id
      AND canonical.skill_slug = a.canonical_slug
      AND canonical.is_active
  );

CREATE OR REPLACE FUNCTION public.validate_university_course_tier_enrollment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE
  v_slug text;
  v_target_name text;
  v_skill_id uuid;
  v_caps jsonb;
  v_prereq text;
  v_prereq_name text;
  v_required_level integer;
  v_current_level integer := 0;
  v_candidate text;
BEGIN
  SELECT uc.skill_slug,
         coalesce(sd.display_name, uc.name, uc.skill_slug),
         sd.id,
         sd.tier_caps
    INTO v_slug, v_target_name, v_skill_id, v_caps
  FROM public.university_courses uc
  LEFT JOIN public.skill_definitions sd ON sd.slug::text = uc.skill_slug
  WHERE uc.id = NEW.course_id;

  IF v_slug IS NULL OR public.skill_tier_unlocked(NEW.profile_id, v_slug) THEN
    RETURN NEW;
  END IF;

  -- Report the same prerequisite relationship and threshold that the unlock
  -- function actually enforces.
  SELECT
      parent.slug::text,
      coalesce(parent.display_name, initcap(replace(parent.slug::text, '_', ' '))),
      greatest(1, coalesce(spl.unlock_threshold, public.progression_skill_max_level(parent.slug::text))),
      public.skill_progress_level_for_slug(NEW.profile_id, parent.slug::text)
    INTO v_prereq, v_prereq_name, v_required_level, v_current_level
  FROM public.skill_parent_links spl
  JOIN public.skill_definitions parent ON parent.id = spl.parent_skill_id
  WHERE spl.skill_id = v_skill_id
    AND public.skill_progress_level_for_slug(NEW.profile_id, parent.slug::text)
      < greatest(1, coalesce(spl.unlock_threshold, public.progression_skill_max_level(parent.slug::text)))
  ORDER BY parent.slug::text
  LIMIT 1;

  IF v_prereq IS NULL AND coalesce(v_caps->>'requires', '') <> '' THEN
    v_prereq := v_caps->>'requires';
    v_required_level := CASE
      WHEN (v_caps->>'required_level') ~ '^[0-9]+$'
        THEN greatest(1, (v_caps->>'required_level')::integer)
      ELSE public.progression_skill_max_level(v_prereq)
    END;
  ELSIF v_prereq IS NULL AND position('_professional_' in v_slug) > 0 THEN
    v_prereq := replace(v_slug, '_professional_', '_basic_');
  ELSIF v_prereq IS NULL AND position('_mastery_' in v_slug) > 0 THEN
    v_prereq := replace(v_slug, '_mastery_', '_professional_');
  ELSIF v_prereq IS NULL AND v_slug LIKE 'professional\_%' ESCAPE '\' THEN
    v_candidate := 'basic_' || substring(v_slug from char_length('professional_') + 1);
    IF EXISTS (
      SELECT 1 FROM public.skill_definitions sd WHERE sd.slug::text = v_candidate
    ) THEN
      v_prereq := v_candidate;
    END IF;
  END IF;

  IF v_prereq IS NOT NULL THEN
    IF v_required_level IS NULL THEN
      v_required_level := public.progression_skill_max_level(v_prereq);
    END IF;

    IF v_prereq_name IS NULL THEN
      SELECT coalesce(sd.display_name, initcap(replace(v_prereq, '_', ' ')))
        INTO v_prereq_name
      FROM public.skill_definitions sd
      WHERE sd.slug::text = v_prereq
      LIMIT 1;
    END IF;

    v_prereq_name := coalesce(v_prereq_name, initcap(replace(v_prereq, '_', ' ')));
    v_current_level := public.skill_progress_level_for_slug(NEW.profile_id, v_prereq);

    RAISE EXCEPTION '% requires % level % (you have %).',
      v_target_name, v_prereq_name, v_required_level, v_current_level
      USING
        ERRCODE = 'P0001',
        DETAIL = 'university_course_prerequisite_not_met:' || v_slug,
        HINT = 'Complete the required previous-tier skill before enrolling.';
  END IF;

  RAISE EXCEPTION 'The prerequisite for % has not been met.', v_target_name
    USING
      ERRCODE = 'P0001',
      DETAIL = 'university_course_prerequisite_not_met:' || v_slug,
      HINT = 'Complete the required prerequisite before enrolling.';
END;
$function$;

COMMENT ON FUNCTION public.validate_university_course_tier_enrollment() IS
  'Enforces university course prerequisites using skill_parent_links thresholds and legacy/canonical skill aliases.';

DO $validation$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
  FROM public.skill_parent_links spl
  JOIN public.skill_definitions child ON child.id = spl.skill_id
  JOIN public.skill_definitions parent ON parent.id = spl.parent_skill_id
  WHERE child.slug::text = 'genres_professional_punk_rock'
    AND parent.slug::text = 'genres_basic_punk_rock'
    AND spl.unlock_threshold <> 10;

  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'Professional Punk Rock prerequisite threshold is not 10';
  END IF;
END;
$validation$;
