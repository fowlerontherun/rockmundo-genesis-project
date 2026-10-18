-- APPLIED DIRECTLY TO LIVE SUPABASE ON 2026-10-18.
-- Audit record for production changes, not a replacement for orderly future migrations.
-- Actions were performed as three independently verified transactions.
-- The script below is safe to re-run on a compatible schema, but verify
-- index and function definitions before applying to any other environment.
BEGIN;
SET LOCAL lock_timeout = '4s';
SET LOCAL statement_timeout = '45s';

-- Skill-focused University discovery avoids scanning all ~33,400 active courses.
CREATE INDEX IF NOT EXISTS idx_university_courses_active_skill_name_id
  ON public.university_courses (skill_slug, name, id)
  WHERE is_active = true;

-- Explicit, game-consistent Political Professional prerequisites.
-- Do not update earned XP, enrolments, or previous skill level rows.
WITH mappings(professional, basic) AS (
  VALUES
    ('professional_diplomacy','basic_negotiation'),
    ('professional_campaign_strategy','basic_governance')
)
UPDATE public.skill_definitions sd
SET tier_caps = coalesce(sd.tier_caps, '{}'::jsonb) ||
  jsonb_build_object('requires', mapping.basic,
                     'required_level', public.progression_skill_max_level(mapping.basic))
FROM mappings mapping
WHERE sd.slug::text = mapping.professional
  AND coalesce(sd.tier_caps->>'requires','') = ''
  AND NOT EXISTS (
    SELECT 1 FROM public.skill_parent_links spl WHERE spl.skill_id=sd.id
  )
  AND EXISTS (
    SELECT 1 FROM public.skill_definitions prereq
    WHERE prereq.slug::text=mapping.basic
  );

-- This is player-only functionality. Preserve direct access by authenticated
-- players and service_role; deny unauthenticated queries of progression states.
REVOKE EXECUTE ON FUNCTION public.skill_tier_unlocked(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.skill_tier_access_bulk(uuid,text[]) FROM PUBLIC, anon;

DO $verify$
DECLARE synthetic_profile uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public'
      AND tablename='university_courses'
      AND indexname='idx_university_courses_active_skill_name_id'
  ) THEN RAISE EXCEPTION 'Missing university skill index'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.skill_definitions sd
    WHERE sd.slug::text IN ('professional_diplomacy', 'professional_campaign_strategy')
      AND (coalesce(sd.tier_caps->>'requires','')='' OR
           coalesce((sd.tier_caps->>'required_level')::integer,0)<20)
  ) THEN RAISE EXCEPTION 'Politics advanced prerequisites missing'; END IF;

  IF public.skill_tier_unlocked(synthetic_profile,'professional_diplomacy')
    OR public.skill_tier_unlocked(synthetic_profile,'professional_campaign_strategy')
    OR NOT public.skill_tier_unlocked(synthetic_profile,'basic_governance')
    OR NOT public.skill_tier_unlocked(synthetic_profile,'basic_negotiation') THEN
    RAISE EXCEPTION 'Politics skill unlock regression';
  END IF;

  IF has_function_privilege('anon','public.skill_tier_unlocked(uuid,text)','EXECUTE')
    OR has_function_privilege('anon','public.skill_tier_access_bulk(uuid,text[])','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.skill_tier_unlocked(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.skill_tier_access_bulk(uuid,text[])','EXECUTE')
    OR NOT has_function_privilege('service_role','public.skill_tier_unlocked(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.skill_tier_access_bulk(uuid,text[])','EXECUTE') THEN
    RAISE EXCEPTION 'Incorrect Education RPC execution privileges';
  END IF;
END $verify$;

COMMIT;

-- Verification on live production:
-- EXPLAIN SELECT id,name,skill_slug FROM public.university_courses
-- WHERE is_active=true AND skill_slug='basic_mixing_mastering'
-- ORDER BY name,id LIMIT 1000;
-- Planner: Index Only Scan using idx_university_courses_active_skill_name_id.
--
-- REMAINING SECURITY WORK: authenticated caller access to another player's
-- profile ID on the definer RPC, tracked in #4301. Do not claim fully fixed.
-- REMAINING GAME DESIGN: professional_party_management remains locked pending
-- its explicit predecessor, tracked in #4298.
