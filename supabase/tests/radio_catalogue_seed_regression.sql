\set ON_ERROR_STOP on
BEGIN;

DO $preconditions$
BEGIN
  ASSERT (SELECT count(*) FROM public.radio_stations
           WHERE (name, country) IN (('BBC Radio 1', 'United Kingdom'),
                                     ('BBC Radio 2', 'United Kingdom'),
                                     ('Capital FM', 'United Kingdom'),
                                     ('Heart FM', 'United Kingdom'),
                                     ('Kiss FM UK', 'United Kingdom'),
                                     ('iHeartRadio', 'United States'),
                                     ('NPR Music', 'United States'),
                                     ('Triple J', 'Australia'))) = 8,
    'all eight show-catalogue stations must resolve exactly once';
END
$preconditions$;

-- Description is runtime-owned and must survive a catalogue redeployment.
UPDATE public.radio_stations
   SET description = 'radio-seed-runtime-preservation-sentinel'
 WHERE name = 'BBC Radio 1' AND country = 'United Kingdom';

\ir ../migrations/20251219081242_3236e47d-c811-41d5-a58f-5eb9de732e26.sql
\ir ../migrations/20251219081343_28408769-9382-475f-8c87-479d3ff9acd6.sql

DO $regression$
BEGIN
  ASSERT (SELECT count(*) FROM public.radio_stations
           WHERE name = 'BBC Radio 1' AND country = 'United Kingdom') = 1,
    'station seed replay created a duplicate';
  ASSERT (SELECT description FROM public.radio_stations
           WHERE name = 'BBC Radio 1' AND country = 'United Kingdom') =
         'radio-seed-runtime-preservation-sentinel',
    'station seed replay overwrote runtime-owned data';
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.radio_shows show
     WHERE NOT EXISTS (SELECT 1 FROM public.radio_stations station
                        WHERE station.id = show.station_id)
  ), 'a radio show references a missing station';
  ASSERT (SELECT count(*) FROM public.radio_shows show
           JOIN public.radio_stations station ON station.id = show.station_id
          WHERE (station.name, station.country) IN
                (('BBC Radio 1', 'United Kingdom'), ('BBC Radio 2', 'United Kingdom'),
                 ('Capital FM', 'United Kingdom'), ('Heart FM', 'United Kingdom'),
                 ('Kiss FM UK', 'United Kingdom'), ('iHeartRadio', 'United States'),
                 ('NPR Music', 'United States'), ('Triple J', 'Australia'))
            AND (show.show_name, show.day_of_week, show.time_slot) IN
                (SELECT seeded.show_name, seeded.day_of_week, seeded.time_slot
                   FROM radio_show_catalogue_seed seeded)) = 31,
    'radio show seed replay changed the expected cardinality';
END
$regression$;

ROLLBACK;
