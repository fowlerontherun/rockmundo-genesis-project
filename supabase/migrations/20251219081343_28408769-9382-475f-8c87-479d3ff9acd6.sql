-- Shows deliberately resolve the generated station UUID through the national
-- station catalogue identity.  A temporary source makes resolution auditable
-- before any row is written and is also safe when this seed is reapplied.
CREATE TEMP TABLE radio_show_catalogue_seed (
  station_name text NOT NULL,
  station_country text NOT NULL,
  show_name text NOT NULL,
  host_name text NOT NULL,
  time_slot text NOT NULL,
  day_of_week integer NOT NULL,
  listener_multiplier numeric NOT NULL,
  show_genres text[] NOT NULL,
  is_active boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO radio_show_catalogue_seed
  (station_name, station_country, show_name, host_name, time_slot,
   day_of_week, listener_multiplier, show_genres, is_active)
VALUES
-- BBC Radio 1 Shows
('BBC Radio 1', 'United Kingdom', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 1, 2.0, ARRAY['pop', 'indie'], true),
('BBC Radio 1', 'United Kingdom', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 2, 2.0, ARRAY['pop', 'indie'], true),
('BBC Radio 1', 'United Kingdom', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 3, 2.0, ARRAY['pop', 'indie'], true),
('BBC Radio 1', 'United Kingdom', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 4, 2.0, ARRAY['pop', 'indie'], true),
('BBC Radio 1', 'United Kingdom', 'Radio 1 Breakfast', 'Greg James', 'morning_drive', 5, 2.0, ARRAY['pop', 'indie'], true),
('BBC Radio 1', 'United Kingdom', 'Live Lounge', 'Clara Amfo', 'afternoon_drive', 1, 1.8, ARRAY['pop', 'indie', 'alternative'], true),
('BBC Radio 1', 'United Kingdom', 'Future Sounds', 'Annie Mac', 'evening', 4, 1.5, ARRAY['electronic', 'dance'], true),
('BBC Radio 1', 'United Kingdom', 'Radio 1 Dance Party', 'Danny Howard', 'evening', 6, 1.6, ARRAY['dance', 'electronic'], true),
('BBC Radio 1', 'United Kingdom', 'Diplo and Friends', 'Diplo', 'late_night', 0, 1.4, ARRAY['electronic', 'hip-hop'], true),
-- BBC Radio 2 Shows
('BBC Radio 2', 'United Kingdom', 'Radio 2 Breakfast', 'Zoe Ball', 'morning_drive', 1, 2.5, ARRAY['pop', 'rock'], true),
('BBC Radio 2', 'United Kingdom', 'Radio 2 Breakfast', 'Zoe Ball', 'morning_drive', 2, 2.5, ARRAY['pop', 'rock'], true),
('BBC Radio 2', 'United Kingdom', 'Radio 2 Breakfast', 'Zoe Ball', 'morning_drive', 3, 2.5, ARRAY['pop', 'rock'], true),
('BBC Radio 2', 'United Kingdom', 'Steve Wright in the Afternoon', 'Steve Wright', 'afternoon_drive', 1, 1.8, ARRAY['pop', 'classic rock'], true),
('BBC Radio 2', 'United Kingdom', 'Sounds of the 80s', 'Gary Davies', 'evening', 6, 1.5, ARRAY['pop'], true),
('BBC Radio 2', 'United Kingdom', 'Jo Whiley Show', 'Jo Whiley', 'evening', 1, 1.6, ARRAY['rock', 'indie'], true),
-- Capital FM Shows
('Capital FM', 'United Kingdom', 'Capital Breakfast', 'Roman Kemp', 'morning_drive', 1, 2.0, ARRAY['pop', 'dance'], true),
('Capital FM', 'United Kingdom', 'Capital Breakfast', 'Roman Kemp', 'morning_drive', 2, 2.0, ARRAY['pop', 'dance'], true),
('Capital FM', 'United Kingdom', 'Capital Evening Show', 'Marvin Humes', 'evening', 5, 1.5, ARRAY['pop', 'r&b'], true),
-- Heart FM Shows
('Heart FM', 'United Kingdom', 'Heart Breakfast', 'Jamie Theakston', 'morning_drive', 1, 2.0, ARRAY['pop'], true),
('Heart FM', 'United Kingdom', 'Heart Breakfast', 'Jamie Theakston', 'morning_drive', 2, 2.0, ARRAY['pop'], true),
-- Kiss FM Shows
('Kiss FM UK', 'United Kingdom', 'Kiss Breakfast', 'Jordan Banjo', 'morning_drive', 1, 1.8, ARRAY['hip-hop', 'r&b', 'dance'], true),
('Kiss FM UK', 'United Kingdom', 'Kiss Fresh', 'DJ Target', 'evening', 5, 1.5, ARRAY['grime', 'hip-hop'], true),
-- iHeartRadio Shows
('iHeartRadio', 'United States', 'The Bobby Bones Show', 'Bobby Bones', 'morning_drive', 1, 2.2, ARRAY['country', 'pop'], true),
('iHeartRadio', 'United States', 'On Air with Ryan Seacrest', 'Ryan Seacrest', 'morning_drive', 2, 2.5, ARRAY['pop'], true),
('iHeartRadio', 'United States', 'Elvis Duran Morning Show', 'Elvis Duran', 'morning_drive', 3, 2.0, ARRAY['pop'], true),
-- NPR Music Shows
('NPR Music', 'United States', 'Tiny Desk Concert', 'Bob Boilen', 'afternoon_drive', 3, 1.8, ARRAY['indie', 'folk', 'world'], true),
('NPR Music', 'United States', 'All Songs Considered', 'Bob Boilen', 'evening', 5, 1.5, ARRAY['indie', 'alternative'], true),
('NPR Music', 'United States', 'World Cafe', 'Raina Douris', 'afternoon_drive', 1, 1.4, ARRAY['world', 'indie'], true),
-- Triple J Shows
('Triple J', 'Australia', 'Triple J Breakfast', 'Bryce Mills', 'morning_drive', 1, 2.0, ARRAY['indie', 'alternative'], true),
('Triple J', 'Australia', 'Like A Version', 'Various', 'morning_drive', 5, 2.5, ARRAY['indie', 'rock', 'pop'], true),
('Triple J', 'Australia', 'Hottest 100', 'Various', 'weekend', 0, 3.0, ARRAY['indie', 'rock', 'pop', 'electronic'], true);

DO $resolution_check$
DECLARE
  missing_identities text;
  ambiguous_identities text;
BEGIN
  SELECT string_agg(format('%s (%s)', expected.station_name, expected.station_country), ', ' ORDER BY expected.station_name)
    INTO missing_identities
    FROM (SELECT DISTINCT station_name, station_country FROM radio_show_catalogue_seed) expected
   WHERE NOT EXISTS (
     SELECT 1 FROM public.radio_stations station
      WHERE station.name = expected.station_name
        AND station.country = expected.station_country
        AND station.station_type = 'national'
   );

  SELECT string_agg(format('%s (%s): %s rows', station_name, station_country, matches), ', ' ORDER BY station_name)
    INTO ambiguous_identities
    FROM (
      SELECT expected.station_name, expected.station_country, count(station.id) AS matches
        FROM (SELECT DISTINCT station_name, station_country FROM radio_show_catalogue_seed) expected
        JOIN public.radio_stations station
          ON station.name = expected.station_name
         AND station.country = expected.station_country
         AND station.station_type = 'national'
       GROUP BY expected.station_name, expected.station_country
      HAVING count(station.id) <> 1
    ) duplicate_station;

  IF missing_identities IS NOT NULL OR ambiguous_identities IS NOT NULL THEN
    RAISE EXCEPTION 'Radio show station resolution failed. Missing: %. Ambiguous: %',
      coalesce(missing_identities, 'none'), coalesce(ambiguous_identities, 'none');
  END IF;
END
$resolution_check$;

CREATE UNIQUE INDEX IF NOT EXISTS radio_shows_station_schedule_uidx
  ON public.radio_shows (station_id, show_name, day_of_week, time_slot);

INSERT INTO public.radio_shows
  (station_id, show_name, host_name, time_slot, day_of_week,
   listener_multiplier, show_genres, is_active)
SELECT station.id, seed.show_name, seed.host_name, seed.time_slot,
       seed.day_of_week, seed.listener_multiplier, seed.show_genres, seed.is_active
  FROM radio_show_catalogue_seed seed
  JOIN public.radio_stations station
    ON station.name = seed.station_name
   AND station.country = seed.station_country
   AND station.station_type = 'national'
ON CONFLICT (station_id, show_name, day_of_week, time_slot)
DO UPDATE SET
  host_name = EXCLUDED.host_name,
  listener_multiplier = EXCLUDED.listener_multiplier,
  show_genres = EXCLUDED.show_genres,
  is_active = EXCLUDED.is_active;
