
-- Add missing Olympics Closing Ceremony instances (month 8, freq 4): Game Years 4, 8
INSERT INTO major_event_instances (event_id, year, status, invited_band_ids)
SELECT me.id, gs.yr, 'upcoming', '{}'::uuid[]
FROM major_events me
CROSS JOIN (VALUES (4), (8)) AS gs(yr)
WHERE me.name = 'Olympics Closing Ceremony'
  AND me.is_active = true;
