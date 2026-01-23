-- Fix release_formats constraints to include cassette and proper manufacturing statuses

-- Drop and recreate the format_type constraint to include cassette
ALTER TABLE release_formats DROP CONSTRAINT IF EXISTS release_formats_format_type_check;
ALTER TABLE release_formats ADD CONSTRAINT release_formats_format_type_check
  CHECK (format_type IN ('digital', 'cd', 'vinyl', 'streaming', 'cassette'));

-- Drop and recreate the manufacturing_status constraint to include 'manufacturing'
ALTER TABLE release_formats DROP CONSTRAINT IF EXISTS release_formats_manufacturing_status_check;
ALTER TABLE release_formats ADD CONSTRAINT release_formats_manufacturing_status_check
  CHECK (manufacturing_status IN ('pending', 'in_progress', 'completed', 'manufacturing'));