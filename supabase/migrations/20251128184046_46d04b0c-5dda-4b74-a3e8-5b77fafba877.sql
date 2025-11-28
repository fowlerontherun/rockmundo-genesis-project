-- Add outdoor venue and time of day support to stage_templates
ALTER TABLE stage_templates 
ADD COLUMN IF NOT EXISTS is_outdoor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS time_of_day TEXT DEFAULT 'night',
ADD COLUMN IF NOT EXISTS sky_preset TEXT;

COMMENT ON COLUMN stage_templates.is_outdoor IS 'Whether this stage is outdoors (true) or indoors (false)';
COMMENT ON COLUMN stage_templates.time_of_day IS 'Time of day for outdoor stages: day, sunset, or night';
COMMENT ON COLUMN stage_templates.sky_preset IS 'Sky rendering preset for outdoor stages';