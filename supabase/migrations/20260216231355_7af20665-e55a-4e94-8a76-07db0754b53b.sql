-- Backfill has_performed = true for all bands that have completed gigs in a country
UPDATE band_country_fans bcf
SET has_performed = true, updated_at = now()
FROM (
  SELECT DISTINCT g.band_id, c.country
  FROM gigs g
  JOIN venues v ON v.id = g.venue_id
  JOIN cities c ON c.id = v.city_id
  WHERE g.status = 'completed'
) performed
WHERE bcf.band_id = performed.band_id
AND bcf.country = performed.country
AND bcf.has_performed = false;

-- Also insert missing entries for bands that performed in countries not yet in band_country_fans
INSERT INTO band_country_fans (band_id, country, has_performed, fame, total_fans, casual_fans, dedicated_fans, superfans)
SELECT DISTINCT g.band_id, c.country, true, 0, 0, 0, 0, 0
FROM gigs g
JOIN venues v ON v.id = g.venue_id
JOIN cities c ON c.id = v.city_id
WHERE g.status = 'completed'
AND NOT EXISTS (
  SELECT 1 FROM band_country_fans bcf 
  WHERE bcf.band_id = g.band_id AND bcf.country = c.country
)
ON CONFLICT DO NOTHING;