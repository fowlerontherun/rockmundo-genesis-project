-- Fix legacy country abbreviations without colliding with the national-station
-- uniqueness rule. Historical seed data can contain the same national station
-- twice, once under the abbreviation and once under the canonical country name.
-- On a clean migration replay, remove only the obsolete abbreviated duplicate
-- before normalising the remaining rows.
DELETE FROM radio_stations legacy
USING radio_stations canonical
WHERE legacy.station_type = 'national'
  AND canonical.station_type = 'national'
  AND legacy.country = 'UK'
  AND canonical.country = 'United Kingdom'
  AND legacy.name = canonical.name
  AND legacy.id <> canonical.id;

UPDATE radio_stations
SET country = 'United Kingdom'
WHERE country = 'UK';

-- Apply the same collision-safe normalisation for USA -> United States.
DELETE FROM radio_stations legacy
USING radio_stations canonical
WHERE legacy.station_type = 'national'
  AND canonical.station_type = 'national'
  AND legacy.country = 'USA'
  AND canonical.country = 'United States'
  AND legacy.name = canonical.name
  AND legacy.id <> canonical.id;

UPDATE radio_stations
SET country = 'United States'
WHERE country = 'USA';
