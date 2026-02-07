-- Backfill streaming_analytics_daily with realistic data for existing rows
-- unique_listeners: 40-80% of daily_streams
-- skip_rate: 10-35% (numeric)
-- completion_rate: 55-90% (numeric)
-- listener_age_group: random realistic age groups
-- listener_region: random realistic regions

-- Update unique_listeners (40-80% of daily_streams)
UPDATE streaming_analytics_daily 
SET unique_listeners = GREATEST(1, (daily_streams * (40 + floor(random() * 40)) / 100)::int)
WHERE unique_listeners IS NULL OR unique_listeners = 0;

-- Update skip_rate (10-35%)
UPDATE streaming_analytics_daily 
SET skip_rate = round((10 + random() * 25)::numeric, 1)
WHERE skip_rate IS NULL;

-- Update completion_rate (55-90%)
UPDATE streaming_analytics_daily 
SET completion_rate = round((55 + random() * 35)::numeric, 1)
WHERE completion_rate IS NULL;

-- Update listener_age_group
UPDATE streaming_analytics_daily 
SET listener_age_group = (
  CASE floor(random() * 6)::int
    WHEN 0 THEN '13-17'
    WHEN 1 THEN '18-24'
    WHEN 2 THEN '25-34'
    WHEN 3 THEN '35-44'
    WHEN 4 THEN '45-54'
    ELSE '55+'
  END
)
WHERE listener_age_group IS NULL;

-- Update listener_region
UPDATE streaming_analytics_daily 
SET listener_region = (
  CASE floor(random() * 10)::int
    WHEN 0 THEN 'North America'
    WHEN 1 THEN 'Europe'
    WHEN 2 THEN 'Asia Pacific'
    WHEN 3 THEN 'Latin America'
    WHEN 4 THEN 'UK & Ireland'
    WHEN 5 THEN 'Scandinavia'
    WHEN 6 THEN 'Australia & NZ'
    WHEN 7 THEN 'Middle East'
    WHEN 8 THEN 'Africa'
    ELSE 'South East Asia'
  END
)
WHERE listener_region IS NULL;