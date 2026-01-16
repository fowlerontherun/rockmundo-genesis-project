-- Add fame penalty tier and base fame impact columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fame_penalty_tier TEXT 
  CHECK (fame_penalty_tier IN ('none', 'minor', 'moderate', 'severe'))
  DEFAULT 'none';

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS base_fame_impact INTEGER DEFAULT 0;

-- Update existing jobs to set base_fame_impact from fame_impact_per_shift
UPDATE jobs SET base_fame_impact = fame_impact_per_shift WHERE base_fame_impact = 0 OR base_fame_impact IS NULL;

-- Set fame penalty tier for existing low-wage jobs
UPDATE jobs SET fame_penalty_tier = 'minor' WHERE hourly_wage <= 15 AND fame_penalty_tier = 'none';
UPDATE jobs SET fame_penalty_tier = 'moderate' WHERE category IN ('manual_labor', 'food_service') AND fame_penalty_tier = 'none';

-- Insert new LOW-PRESTIGE jobs that will hurt famous artists
INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Cleaner' as title,
  'Clean offices and commercial buildings. Early morning or late night shifts. Famous musicians seen doing this will lose respect.' as description,
  'CleanCo - ' || c.name as company_name,
  'manual_labor' as category,
  14 as hourly_wage,
  -3 as fame_impact_per_shift,
  -3 as base_fame_impact,
  'moderate' as fame_penalty_tier,
  -8 as health_impact_per_shift,
  30 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday"]'::jsonb as work_days,
  '05:00'::time as start_time,
  '09:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Cleaner' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Dishwasher' as title,
  'Wash dishes in restaurant kitchens. Hot, humid, and physically demanding. Not a good look for famous artists.' as description,
  'DishDash - ' || c.name as company_name,
  'food_service' as category,
  13 as hourly_wage,
  -2 as fame_impact_per_shift,
  -2 as base_fame_impact,
  'moderate' as fame_penalty_tier,
  -6 as health_impact_per_shift,
  25 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday","saturday"]'::jsonb as work_days,
  '18:00'::time as start_time,
  '23:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Dishwasher' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Garbage Collector' as title,
  'Collect and dispose of waste around the city. Very physically demanding and socially stigmatized for famous people.' as description,
  'City Waste Services - ' || c.name as company_name,
  'manual_labor' as category,
  16 as hourly_wage,
  -4 as fame_impact_per_shift,
  -4 as base_fame_impact,
  'severe' as fame_penalty_tier,
  -12 as health_impact_per_shift,
  40 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday"]'::jsonb as work_days,
  '04:00'::time as start_time,
  '10:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Garbage Collector' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Fast Food Worker' as title,
  'Prepare and serve fast food. Low status job that celebrity gossip loves to catch stars at.' as description,
  'QuickBite - ' || c.name as company_name,
  'food_service' as category,
  12 as hourly_wage,
  -2 as fame_impact_per_shift,
  -2 as base_fame_impact,
  'moderate' as fame_penalty_tier,
  -4 as health_impact_per_shift,
  20 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'::jsonb as work_days,
  '11:00'::time as start_time,
  '19:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Fast Food Worker' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Warehouse Worker' as title,
  'Pick, pack, and ship orders in a warehouse. Physical labor that hurts your image if you are famous.' as description,
  'MegaWarehouse - ' || c.name as company_name,
  'manual_labor' as category,
  15 as hourly_wage,
  -2 as fame_impact_per_shift,
  -2 as base_fame_impact,
  'minor' as fame_penalty_tier,
  -10 as health_impact_per_shift,
  35 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday"]'::jsonb as work_days,
  '06:00'::time as start_time,
  '14:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Warehouse Worker' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Telemarketer' as title,
  'Make cold calls to sell products or services. Soul-crushing and embarrassing if you are recognized.' as description,
  'CallCenter Pro - ' || c.name as company_name,
  'service' as category,
  12 as hourly_wage,
  -1 as fame_impact_per_shift,
  -1 as base_fame_impact,
  'minor' as fame_penalty_tier,
  -3 as health_impact_per_shift,
  15 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday"]'::jsonb as work_days,
  '09:00'::time as start_time,
  '17:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Telemarketer' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Car Wash Attendant' as title,
  'Wash and detail cars. Outdoor work that could get you photographed by paparazzi.' as description,
  'Sparkle Auto Wash - ' || c.name as company_name,
  'service' as category,
  11 as hourly_wage,
  -2 as fame_impact_per_shift,
  -2 as base_fame_impact,
  'minor' as fame_penalty_tier,
  -5 as health_impact_per_shift,
  20 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday","saturday"]'::jsonb as work_days,
  '08:00'::time as start_time,
  '16:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Car Wash Attendant' AND city_id IS NOT NULL);

-- Insert new MUSIC INDUSTRY jobs that boost fame
INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Music Blog Writer' as title,
  'Write music reviews and articles. Stay connected to the scene and build industry contacts.' as description,
  'MusicBeat Magazine - ' || c.name as company_name,
  'music_industry' as category,
  20 as hourly_wage,
  3 as fame_impact_per_shift,
  3 as base_fame_impact,
  'none' as fame_penalty_tier,
  -2 as health_impact_per_shift,
  15 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday"]'::jsonb as work_days,
  '10:00'::time as start_time,
  '18:00'::time as end_time,
  3 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Music Blog Writer' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Session Musician' as title,
  'Play as a hired gun on other artists recordings. Builds skills and industry reputation.' as description,
  'Session Stars Agency - ' || c.name as company_name,
  'music_industry' as category,
  35 as hourly_wage,
  5 as fame_impact_per_shift,
  5 as base_fame_impact,
  'none' as fame_penalty_tier,
  -5 as health_impact_per_shift,
  25 as energy_cost_per_shift,
  '["tuesday","wednesday","thursday","friday"]'::jsonb as work_days,
  '14:00'::time as start_time,
  '22:00'::time as end_time,
  5 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Session Musician' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Venue Sound Tech' as title,
  'Run sound at local venues. Meet touring bands and learn the technical side of live music.' as description,
  'Live Sound Pro - ' || c.name as company_name,
  'entertainment' as category,
  28 as hourly_wage,
  2 as fame_impact_per_shift,
  2 as base_fame_impact,
  'none' as fame_penalty_tier,
  -4 as health_impact_per_shift,
  20 as energy_cost_per_shift,
  '["thursday","friday","saturday","sunday"]'::jsonb as work_days,
  '17:00'::time as start_time,
  '01:00'::time as end_time,
  3 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Venue Sound Tech' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Music Store Clerk' as title,
  'Sell instruments and gear. Meet fellow musicians and stay connected to the local scene.' as description,
  'Strings & Things - ' || c.name as company_name,
  'retail' as category,
  18 as hourly_wage,
  2 as fame_impact_per_shift,
  2 as base_fame_impact,
  'none' as fame_penalty_tier,
  -2 as health_impact_per_shift,
  10 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday","saturday"]'::jsonb as work_days,
  '10:00'::time as start_time,
  '18:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Music Store Clerk' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Radio Station Intern' as title,
  'Help out at a local radio station. Learn broadcasting and make industry connections.' as description,
  'Local FM - ' || c.name as company_name,
  'entertainment' as category,
  15 as hourly_wage,
  3 as fame_impact_per_shift,
  3 as base_fame_impact,
  'none' as fame_penalty_tier,
  -2 as health_impact_per_shift,
  12 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday"]'::jsonb as work_days,
  '06:00'::time as start_time,
  '12:00'::time as end_time,
  2 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Radio Station Intern' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Roadie' as title,
  'Load in/out gear for touring bands. Hard physical work but great networking opportunities.' as description,
  'Tour Crew Services - ' || c.name as company_name,
  'music_industry' as category,
  22 as hourly_wage,
  4 as fame_impact_per_shift,
  4 as base_fame_impact,
  'none' as fame_penalty_tier,
  -8 as health_impact_per_shift,
  30 as energy_cost_per_shift,
  '["friday","saturday","sunday"]'::jsonb as work_days,
  '15:00'::time as start_time,
  '02:00'::time as end_time,
  2 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Roadie' AND city_id IS NOT NULL);

INSERT INTO jobs (title, description, company_name, category, hourly_wage, fame_impact_per_shift, base_fame_impact, fame_penalty_tier, health_impact_per_shift, energy_cost_per_shift, work_days, start_time, end_time, required_level, city_id)
SELECT 
  'Studio Runner' as title,
  'Assist at a recording studio. Fetch coffee, run errands, and learn from professional sessions.' as description,
  'Pro Audio Studios - ' || c.name as company_name,
  'music_industry' as category,
  16 as hourly_wage,
  2 as fame_impact_per_shift,
  2 as base_fame_impact,
  'none' as fame_penalty_tier,
  -3 as health_impact_per_shift,
  15 as energy_cost_per_shift,
  '["monday","tuesday","wednesday","thursday","friday"]'::jsonb as work_days,
  '12:00'::time as start_time,
  '20:00'::time as end_time,
  1 as required_level,
  c.id as city_id
FROM cities c
WHERE c.id NOT IN (SELECT DISTINCT city_id FROM jobs WHERE title = 'Studio Runner' AND city_id IS NOT NULL);