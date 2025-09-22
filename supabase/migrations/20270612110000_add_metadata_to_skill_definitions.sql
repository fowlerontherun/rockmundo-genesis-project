-- Add metadata column to skill definitions for admin catalog usage
ALTER TABLE public.skill_definitions
  ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.skill_definitions
  ADD CONSTRAINT skill_definitions_metadata_is_object
  CHECK (jsonb_typeof(metadata) = 'object');
