-- Remove metadata column from skill definitions
ALTER TABLE public.skill_definitions
  DROP CONSTRAINT IF EXISTS skill_definitions_metadata_is_object;

ALTER TABLE public.skill_definitions
  DROP COLUMN IF EXISTS metadata;
