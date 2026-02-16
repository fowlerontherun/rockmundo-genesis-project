
-- Clear existing data to rebuild properly
DELETE FROM major_event_song_performances;
DELETE FROM major_event_performances;
DELETE FROM major_event_instances;

UPDATE major_events SET last_occurrence_year = NULL;

-- Annual events (frequency_years = 1): Game Years 1-10
INSERT INTO major_event_instances (event_id, year, status, invited_band_ids)
SELECT me.id, gs.yr, 
  CASE WHEN gs.yr = 1 AND me.month <= 4 THEN 'past' ELSE 'upcoming' END,
  '{}'::uuid[]
FROM major_events me
CROSS JOIN generate_series(1, 10) AS gs(yr)
WHERE me.frequency_years = 1
  AND me.is_active = true;

-- Winter Olympics Opening & Closing (month 2, freq 4): Game Years 2, 6, 10
INSERT INTO major_event_instances (event_id, year, status, invited_band_ids)
SELECT me.id, gs.yr, 'upcoming', '{}'::uuid[]
FROM major_events me
CROSS JOIN (VALUES (2), (6), (10)) AS gs(yr)
WHERE me.name IN ('Winter Olympics Opening Ceremony', 'Winter Olympics Closing Ceremony')
  AND me.is_active = true;

-- Summer Olympics (month 7, freq 4): Game Years 4, 8
INSERT INTO major_event_instances (event_id, year, status, invited_band_ids)
SELECT me.id, gs.yr, 'upcoming', '{}'::uuid[]
FROM major_events me
CROSS JOIN (VALUES (4), (8)) AS gs(yr)
WHERE me.name = 'Olympics Opening Ceremony'
  AND me.is_active = true;

-- Men's World Cup (month 6, freq 4): Game Years 2, 6, 10
INSERT INTO major_event_instances (event_id, year, status, invited_band_ids)
SELECT me.id, gs.yr, 'upcoming', '{}'::uuid[]
FROM major_events me
CROSS JOIN (VALUES (2), (6), (10)) AS gs(yr)
WHERE me.name = 'Men''s World Cup Final'
  AND me.is_active = true;

-- Women's World Cup (month 7, freq 4): Game Years 3, 7
INSERT INTO major_event_instances (event_id, year, status, invited_band_ids)
SELECT me.id, gs.yr, 'upcoming', '{}'::uuid[]
FROM major_events me
CROSS JOIN (VALUES (3), (7)) AS gs(yr)
WHERE me.name = 'Women''s World Cup Final'
  AND me.is_active = true;
