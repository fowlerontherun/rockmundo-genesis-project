-- Seed initial stage templates for Phase 1

-- Small Club Stage (already exists as default, update it)
UPDATE stage_templates 
SET 
  name = 'Intimate Club Stage',
  slug = 'intimate-club',
  size = 'small',
  capacity_min = 50,
  capacity_max = 200,
  camera_offset = '{"x": 0, "y": 1.6, "z": 6}'::jsonb,
  metadata = '{"spotlights": 4, "colorLights": 2, "intensity": 0.8, "crowdZones": [{"zone": "front", "density": 1.2, "minMood": 0, "maxMood": 100}, {"zone": "back", "density": 0.8, "minMood": 0, "maxMood": 100}]}'::jsonb
WHERE slug = 'small-club';

-- Medium Venue Stage
INSERT INTO stage_templates (name, slug, size, capacity_min, capacity_max, camera_offset, metadata) VALUES
  ('Mid-Size Venue Stage', 'medium-venue', 'medium', 200, 800, 
   '{"x": 0, "y": 1.6, "z": 8}'::jsonb,
   '{"spotlights": 6, "colorLights": 4, "intensity": 1.0, "crowdZones": [{"zone": "pit", "density": 1.5, "minMood": 40, "maxMood": 100}, {"zone": "floor", "density": 1.0, "minMood": 0, "maxMood": 100}, {"zone": "back", "density": 0.6, "minMood": 0, "maxMood": 100}]}'::jsonb);

-- Large Concert Hall Stage
INSERT INTO stage_templates (name, slug, size, capacity_min, capacity_max, camera_offset, metadata) VALUES
  ('Concert Hall Stage', 'concert-hall', 'large', 800, 3000, 
   '{"x": 0, "y": 1.6, "z": 10}'::jsonb,
   '{"spotlights": 10, "colorLights": 8, "intensity": 1.2, "crowdZones": [{"zone": "pit", "density": 1.8, "minMood": 50, "maxMood": 100}, {"zone": "floor", "density": 1.2, "minMood": 30, "maxMood": 100}, {"zone": "stands", "density": 0.9, "minMood": 0, "maxMood": 100}, {"zone": "back", "density": 0.5, "minMood": 0, "maxMood": 100}]}'::jsonb);

-- Arena Stage
INSERT INTO stage_templates (name, slug, size, capacity_min, capacity_max, camera_offset, metadata) VALUES
  ('Arena Stage', 'arena-stage', 'large', 3000, 15000, 
   '{"x": 0, "y": 1.6, "z": 12}'::jsonb,
   '{"spotlights": 16, "colorLights": 12, "intensity": 1.5, "crowdZones": [{"zone": "pit", "density": 2.0, "minMood": 60, "maxMood": 100}, {"zone": "floor", "density": 1.5, "minMood": 40, "maxMood": 100}, {"zone": "lower-stands", "density": 1.0, "minMood": 20, "maxMood": 100}, {"zone": "upper-stands", "density": 0.7, "minMood": 0, "maxMood": 100}]}'::jsonb);

-- Festival Main Stage
INSERT INTO stage_templates (name, slug, size, capacity_min, capacity_max, camera_offset, metadata) VALUES
  ('Festival Main Stage', 'festival-main', 'festival', 5000, 50000, 
   '{"x": 0, "y": 1.6, "z": 15}'::jsonb,
   '{"spotlights": 20, "colorLights": 16, "intensity": 2.0, "crowdZones": [{"zone": "front-pit", "density": 2.5, "minMood": 70, "maxMood": 100}, {"zone": "crowd-front", "density": 2.0, "minMood": 50, "maxMood": 100}, {"zone": "crowd-middle", "density": 1.5, "minMood": 30, "maxMood": 100}, {"zone": "crowd-back", "density": 1.0, "minMood": 0, "maxMood": 100}, {"zone": "hill", "density": 0.6, "minMood": 0, "maxMood": 100}]}'::jsonb);