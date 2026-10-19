-- #4242. Historical plays keep NULL simulation_hour and are untouched.
-- Only the internal hourly settlement worker creates new simulated plays.
ALTER TABLE public.radio_plays ADD COLUMN IF NOT EXISTS simulation_hour timestamptz;
-- Cutover guard: if the legacy HTTP job already made one or more plays
-- during the current hour, recognize ONE of them as that playlist's claim.
-- Never mutate historical rewards, listeners or cash in the backfill.
WITH newest_existing_hour AS (
  SELECT DISTINCT ON (playlist_id)
    id, date_trunc('hour',played_at) AS simulated_hour
  FROM public.radio_plays
  WHERE played_at >= date_trunc('hour',now())
    AND played_at < date_trunc('hour',now())+interval '1 hour'
    AND simulation_hour IS NULL
  ORDER BY playlist_id,played_at DESC,id DESC
)
UPDATE public.radio_plays rp
 SET simulation_hour=claim.simulated_hour
FROM newest_existing_hour claim
WHERE rp.id=claim.id AND NOT EXISTS (
 SELECT 1 FROM public.radio_plays existing
 WHERE existing.playlist_id=rp.playlist_id
   AND existing.simulation_hour=claim.simulated_hour
);
CREATE UNIQUE INDEX IF NOT EXISTS radio_plays_playlist_hour_unique
  ON public.radio_plays(playlist_id, simulation_hour)
  WHERE simulation_hour IS NOT NULL;

REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.radio_plays
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.process_hourly_radio_plays()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_hour timestamptz:=date_trunc('hour',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_item record;
  v_song public.songs%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_vote numeric;
  v_listeners integer;
  v_hype integer;
  v_streams integer;
  v_fame integer;
  v_fans integer;
  v_sentiment integer;
  v_morale integer;
  v_multiplier numeric;
  v_engagement numeric;
  v_reputation numeric;
  v_time_multiplier numeric;
  v_period_hour integer;
  v_receipt uuid;
  v_inserted integer:=0;
  v_skipped integer:=0;
  v_failed integer:=0;
  v_listeners_total bigint:=0;
  v_hype_total bigint:=0;
BEGIN
  v_period_hour:=extract(hour from v_hour)::integer;
  v_time_multiplier:=CASE WHEN v_period_hour BETWEEN 7 AND 9
         OR v_period_hour BETWEEN 17 AND 20 THEN 1.5
       WHEN v_period_hour BETWEEN 0 AND 5 THEN 0.3 ELSE 1.0 END;

  -- Newer playlist rows and pages beyond the former arbitrary 100-row cap
  -- are included in deterministic order. Concurrent runners skip locked
  -- playlist claims. Per-hour UNIQUE guards sequential retry and races.
  FOR v_item IN
    SELECT pl.id AS playlist_id,pl.song_id,pl.show_id,
           st.id AS station_id,st.name AS station_name,
           st.country,st.listener_base
    FROM public.radio_playlists pl
    JOIN public.radio_shows sh ON sh.id=pl.show_id
    JOIN public.radio_stations st ON st.id=sh.station_id
    WHERE coalesce(pl.is_active,true) AND coalesce(sh.is_active,true)
      AND coalesce(st.is_active,true)
    ORDER BY pl.id
    FOR UPDATE OF pl SKIP LOCKED
  LOOP
    BEGIN
      -- Lock current song before computing state-dependent engagement.
      SELECT * INTO v_song FROM public.songs
       WHERE id=v_item.song_id FOR UPDATE;
      IF NOT FOUND THEN
        v_skipped:=v_skipped+1; CONTINUE;
      END IF;
      -- The exact same song/playlist never credits twice in the hour.
      IF EXISTS(SELECT 1 FROM public.radio_plays
        WHERE playlist_id=v_item.playlist_id AND simulation_hour=v_hour) THEN
        v_skipped:=v_skipped+1; CONTINUE;
      END IF;

      v_vote:=coalesce(public.get_song_vote_score(v_song.id),0);
      v_multiplier:=1+least(0.5,greatest(0,v_vote*0.02));
      v_engagement:=1;
      v_reputation:=1;
      IF v_song.band_id IS NOT NULL THEN
        SELECT * INTO v_band FROM public.bands WHERE id=v_song.band_id FOR UPDATE;
        IF NOT FOUND THEN
          v_skipped:=v_skipped+1; CONTINUE;
        END IF;
        v_engagement:=round(
          0.7 + ((least(100,greatest(-100,coalesce(v_band.fan_sentiment_score,0)))+100)/200)*0.6,2);
        v_reputation:=round(
          0.8 + ((least(100,greatest(-100,coalesce(v_band.reputation_score,0)))+100)/200)*0.4,2);
      END IF;

      -- Per-hour server RNG, never client-selected. A 70%-130% variance.
      v_listeners:=greatest(0,round(
        greatest(0,coalesce(v_item.listener_base,10000))*
        v_time_multiplier*(0.7+random()*0.6)*0.01
      )::integer);
      v_hype:=greatest(0,round(v_listeners*0.05*
        greatest(0,coalesce(v_song.quality_score,50))/100.0*
        v_multiplier*v_engagement*v_reputation)::integer);
      v_streams:=greatest(0,round(v_listeners*0.1*v_engagement*v_reputation)::integer);

      -- All ledger and reward changes in one SQL subtransaction: any
      -- failure rolls back this playlist's receipt and reward writes.
      INSERT INTO public.radio_plays(
        playlist_id,song_id,show_id,station_id,played_at,
        simulation_hour,listeners,hype_gained,streams_boost
      ) VALUES (
        v_item.playlist_id,v_song.id,v_item.show_id,v_item.station_id,
        now(),v_hour,v_listeners,v_hype,v_streams
      )
      ON CONFLICT (playlist_id,simulation_hour)
        WHERE simulation_hour IS NOT NULL DO NOTHING
      RETURNING id INTO v_receipt;
      IF v_receipt IS NULL THEN
        v_skipped:=v_skipped+1; CONTINUE;
      END IF;

      UPDATE public.songs
        SET hype=least(2147483647,coalesce(hype,0)::bigint+v_hype)
        WHERE id=v_song.id;

      IF v_song.band_id IS NOT NULL THEN
        v_fame:=greatest(0,round(v_hype*0.5*v_multiplier)::integer);
        v_fans:=greatest(0,round(v_hype*0.2)::integer);
        v_sentiment:=CASE WHEN v_listeners>5000 THEN 2
            WHEN v_listeners>1000 THEN 1 ELSE 0 END;
        v_morale:=CASE WHEN v_listeners>5000 THEN 3
            WHEN v_listeners>1000 THEN 2
            WHEN v_listeners>200 THEN 1 ELSE 0 END;
        UPDATE public.bands
           SET fame=least(2147483647,coalesce(fame,0)::bigint+v_fame),
               fan_sentiment_score=least(100,coalesce(fan_sentiment_score,0)+v_sentiment),
               morale=least(100,coalesce(morale,50)+v_morale)
         WHERE id=v_song.band_id;
        IF v_sentiment>0 THEN
          INSERT INTO public.band_sentiment_events(
            band_id,event_type,sentiment_change,media_intensity_change,
            sentiment_after,source,description,metadata
          ) VALUES (
            v_song.band_id,'radio_play',v_sentiment,1,
            least(100,coalesce(v_band.fan_sentiment_score,0)+v_sentiment),
            'process_hourly_radio_plays',
            'Hourly radio rotation on '||coalesce(v_item.station_name,'radio'),
            jsonb_build_object('radio_play_id',v_receipt,'simulation_hour',v_hour)
          );
        END IF;
        IF nullif(btrim(coalesce(v_item.country,'')),'') IS NOT NULL THEN
          PERFORM public.add_band_country_fame(
            v_song.band_id,v_item.country,v_fame,v_fans,false);
        END IF;
      ELSIF v_song.profile_id IS NOT NULL THEN
        -- Never credit all characters of a solo artist account; use the
        -- exact recorded song/profile ownership or skip inconsistent data.
        UPDATE public.profiles
        SET fame=least(2147483647,fame+round(v_hype*0.3)::integer),
            fans=least(2147483647,coalesce(fans,0)::bigint+round(v_hype*0.1)::integer)
        WHERE id=v_song.profile_id AND user_id=v_song.user_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'RADIO_SOLO_PROFILE_MISMATCH'; END IF;
      END IF;

      v_inserted:=v_inserted+1;
      v_listeners_total:=v_listeners_total+v_listeners;
      v_hype_total:=v_hype_total+v_hype;
    EXCEPTION WHEN OTHERS THEN
      v_failed:=v_failed+1;
      RAISE WARNING 'Radio playlist settlement failed %: %',
        v_item.playlist_id,SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('simulation_hour',v_hour,
    'plays_created',v_inserted,'skipped',v_skipped,'failed',v_failed,
    'listeners',v_listeners_total,'hype',v_hype_total);
END;
$fn$;

REVOKE ALL ON FUNCTION public.process_hourly_radio_plays()
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_hourly_radio_plays()
 TO service_role;

-- Cut over job #55 in place. Do not change its original hourly cadence.
-- The prior cron command included a hardcoded JWT and invoked public HTTP.
DO $cron$
DECLARE v_job bigint;
BEGIN
 IF to_regclass('cron.job') IS NOT NULL THEN
   SELECT jobid INTO v_job FROM cron.job
   WHERE jobname='simulate-radio-plays-cron' LIMIT 1;
   IF v_job IS NOT NULL THEN
     PERFORM cron.alter_job(v_job,command=>'SELECT public.process_hourly_radio_plays();');
   END IF;
 END IF;
END;
$cron$;
