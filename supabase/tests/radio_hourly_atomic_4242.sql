-- #4242: actual production catalogue, SQL-only simulation, rollback-only.
-- The worker runs twice within one transaction; no real fame/plays persist.
BEGIN;
CREATE TEMP TABLE radio_before AS
SELECT count(*) AS played,
       (SELECT count(*) FROM public.radio_playlists pl
         JOIN public.radio_shows sh ON sh.id=pl.show_id
         JOIN public.radio_stations st ON st.id=sh.station_id
         JOIN public.songs s ON s.id=pl.song_id
         WHERE coalesce(pl.is_active,true) AND coalesce(sh.is_active,true)
           AND coalesce(st.is_active,true)) AS eligible
FROM public.radio_plays;
CREATE TEMP TABLE radio_hour_before AS
SELECT count(*) already_claimed FROM public.radio_plays
WHERE simulation_hour=date_trunc('hour',now());
CREATE TEMP TABLE radio_first AS
SELECT public.process_hourly_radio_plays() AS receipt;
CREATE TEMP TABLE radio_after_first AS
SELECT (SELECT sum(hype::bigint) FROM public.songs) song_hype,
       (SELECT sum(fame::bigint) FROM public.bands) band_fame,
       (SELECT sum(fame::bigint) FROM public.profiles) player_fame,
       (SELECT count(*) FROM public.radio_plays) plays;
CREATE TEMP TABLE radio_second AS
SELECT public.process_hourly_radio_plays() AS receipt;
SELECT
 (SELECT eligible>100 FROM radio_before) AS all_playlist_pages_present,
 (SELECT (receipt->>'failed')::int=0 FROM radio_first) AS first_no_failures,
 (SELECT (receipt->>'plays_created')::int+
   (SELECT already_claimed FROM radio_hour_before)=
   (SELECT eligible FROM radio_before) FROM radio_first) AS complete_hourly_coverage,
 (SELECT (receipt->>'plays_created')::int=0 FROM radio_second) AS replay_zero_new_plays,
 (SELECT (receipt->>'failed')::int=0 FROM radio_second) AS replay_zero_errors,
 (SELECT count(*)=0 FROM (
   SELECT playlist_id, simulation_hour
   FROM public.radio_plays WHERE simulation_hour IS NOT NULL
   GROUP BY playlist_id,simulation_hour HAVING count(*)>1
 ) duplicates) AS unique_playlist_hour,
 (SELECT count(*) = (SELECT plays FROM radio_after_first)
  FROM public.radio_plays) AS replay_no_extra_receipts,
 (SELECT (SELECT sum(hype::bigint) FROM public.songs)=song_hype
  FROM radio_after_first) AS replay_no_extra_song_hype,
 (SELECT (SELECT sum(fame::bigint) FROM public.bands)=band_fame
  FROM radio_after_first) AS replay_no_extra_band_fame,
 (SELECT (SELECT sum(fame::bigint) FROM public.profiles)=player_fame
  FROM radio_after_first) AS replay_no_extra_profile_fame,
 NOT has_function_privilege('anon','public.process_hourly_radio_plays()','EXECUTE') AS anon_worker_denied,
 NOT has_function_privilege('authenticated','public.process_hourly_radio_plays()','EXECUTE') AS player_worker_denied,
 has_function_privilege('service_role','public.process_hourly_radio_plays()','EXECUTE') AS service_worker_authorized,
 NOT has_table_privilege('authenticated','public.radio_plays','INSERT') AS no_browser_fake_plays,
 NOT has_table_privilege('authenticated','public.radio_plays','UPDATE') AS no_browser_replay_mutation,
 (SELECT command='SELECT public.process_hourly_radio_plays();'
  FROM cron.job WHERE jobname='simulate-radio-plays-cron') AS internal_cron_command,
 (SELECT schedule='0 * * * *' AND active
  FROM cron.job WHERE jobname='simulate-radio-plays-cron') AS hourly_schedule_unchanged;
ROLLBACK;
