-- Down migration for normalize skills
DROP TABLE IF EXISTS public.profile_skill_unlocks;
DROP TABLE IF EXISTS public.profile_skill_progress;
DROP TABLE IF EXISTS public.skill_relationships;
DROP TABLE IF EXISTS public.skill_definitions;
