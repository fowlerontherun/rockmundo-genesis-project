-- Read-only regression of the April radio station catalogue and canonical city IDs.
DO $test$
DECLARE missing integer;
DECLARE wrong_city integer;
BEGIN
  WITH expected(station_name,city_name) AS (VALUES
('Soul City FM','Detroit'),
('Southern Soul Radio','Memphis'),
('Soul Britannia','London'),
('Funk Nation Radio','Detroit'),
('Planet Funk','London'),
('Funky Town FM','Los Angeles'),
('Gospel Fire Radio','Memphis'),
('Praise FM','Nashville'),
('Gospel Waves UK','Manchester'),
('Folk Roots Radio','Edinburgh'),
('Acoustic Highway','Nashville'),
('Folk FM','Dublin'),
('Grunge Radio Seattle','Seattle'),
('Flannel FM','Los Angeles'),
('Dirty Sound Radio','Sydney'),
('Prog Planet Radio','London'),
('The Prog Vault','New York'),
('Progresivo FM','Barcelona'),
('Celtic Heart Radio','Dublin'),
('Highland Sounds','Edinburgh'),
('Celtic Winds FM','Bristol'),
('House Nation Radio','Chicago'),
('Deep House FM','London'),
('Ibiza House Radio','Ibiza'),
('Techno Bunker Radio','Berlin'),
('Warehouse FM','Manchester'),
('Dark Techno Radio','Amsterdam'),
('Sub FM','Bristol'),
('Wobble Radio','Los Angeles'),
('Bass Weight FM','London'),
('Jungle Frequency','London'),
('DnB FM','Bristol'),
('Breakbeat Radio','Sydney'),
('Ambient Waves','London'),
('Drone Zone Radio','New York'),
('Space Music FM','Berlin'),
('Rust Radio','Berlin'),
('Machine Music FM','Chicago'),
('Factory Floor Radio','Manchester'),
('Trance Energy FM','Amsterdam'),
('Uplifting Radio','London'),
('Banjo Creek Radio','Nashville'),
('Mountain Music FM','Nashville'),
('Two Tone Radio','London'),
('Ska Parade FM','Los Angeles')
  )
  SELECT count(*) INTO missing FROM expected x WHERE NOT EXISTS (
    SELECT 1 FROM public.radio_stations s
    JOIN public.cities c ON c.id=s.city_id
    WHERE s.name=x.station_name AND lower(c.name)=lower(x.city_name)
  );
  IF missing<>0 THEN RAISE EXCEPTION 'Radio station seed: % stations are missing from their canonical cities',missing; END IF;
  WITH expected(station_name,city_name) AS (VALUES
('Soul City FM','Detroit'),
('Southern Soul Radio','Memphis'),
('Soul Britannia','London'),
('Funk Nation Radio','Detroit'),
('Planet Funk','London'),
('Funky Town FM','Los Angeles'),
('Gospel Fire Radio','Memphis'),
('Praise FM','Nashville'),
('Gospel Waves UK','Manchester'),
('Folk Roots Radio','Edinburgh'),
('Acoustic Highway','Nashville'),
('Folk FM','Dublin'),
('Grunge Radio Seattle','Seattle'),
('Flannel FM','Los Angeles'),
('Dirty Sound Radio','Sydney'),
('Prog Planet Radio','London'),
('The Prog Vault','New York'),
('Progresivo FM','Barcelona'),
('Celtic Heart Radio','Dublin'),
('Highland Sounds','Edinburgh'),
('Celtic Winds FM','Bristol'),
('House Nation Radio','Chicago'),
('Deep House FM','London'),
('Ibiza House Radio','Ibiza'),
('Techno Bunker Radio','Berlin'),
('Warehouse FM','Manchester'),
('Dark Techno Radio','Amsterdam'),
('Sub FM','Bristol'),
('Wobble Radio','Los Angeles'),
('Bass Weight FM','London'),
('Jungle Frequency','London'),
('DnB FM','Bristol'),
('Breakbeat Radio','Sydney'),
('Ambient Waves','London'),
('Drone Zone Radio','New York'),
('Space Music FM','Berlin'),
('Rust Radio','Berlin'),
('Machine Music FM','Chicago'),
('Factory Floor Radio','Manchester'),
('Trance Energy FM','Amsterdam'),
('Uplifting Radio','London'),
('Banjo Creek Radio','Nashville'),
('Mountain Music FM','Nashville'),
('Two Tone Radio','London'),
('Ska Parade FM','Los Angeles')
  )
  SELECT count(*) INTO wrong_city FROM expected x
  JOIN public.radio_stations s ON s.name=x.station_name
  JOIN public.cities c ON c.id=s.city_id
  WHERE lower(c.name)<>lower(x.city_name);
  IF wrong_city<>0 THEN RAISE EXCEPTION 'Radio station seed: % mislocated stations',wrong_city; END IF;
END $test$;
