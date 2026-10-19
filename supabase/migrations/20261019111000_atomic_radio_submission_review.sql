-- P1 #4243: radio submission reviews must run on the clock and settle
-- review, playlist and band effects atomically. No public service-role HTTP.
ALTER TABLE public.radio_submissions
  DROP CONSTRAINT IF EXISTS radio_submissions_status_check;
ALTER TABLE public.radio_submissions
  ADD CONSTRAINT radio_submissions_status_check
    CHECK (status IN ('pending','processing','accepted','rejected'));

ALTER TABLE public.radio_submissions
  ADD COLUMN IF NOT EXISTS review_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_claim_id uuid;

-- Locking is held through the full SQL transaction. A failed item rolls back
-- the processing claim in its PL/pgSQL exception subtransaction. Stale
-- claims from any previous interrupted implementation can be reclaimed only
-- after a conservative 15-minute lease.
CREATE OR REPLACE FUNCTION public.process_due_radio_submissions(
  p_limit integer DEFAULT 250
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
  v_item public.radio_submissions%ROWTYPE;
  v_song public.songs%ROWTYPE;
  v_station public.radio_stations%ROWTYPE;
  v_band public.bands%ROWTYPE;
  v_show_id uuid;
  v_country_fame integer;
  v_min_quality numeric;
  v_genre_match boolean;
  v_accept_probability numeric;
  v_is_accepted boolean;
  v_reason text;
  v_week_start date;
  v_morale numeric;
  v_reputation numeric;
  v_claim uuid;
  v_accepted integer:=0;
  v_rejected integer:=0;
  v_failed integer:=0;
  v_eligible integer:=0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 1000 THEN
    RAISE EXCEPTION 'RADIO_REVIEW_INVALID_BATCH_LIMIT';
  END IF;

  v_week_start := (now() AT TIME ZONE 'UTC')::date
    - (extract(isodow from now() AT TIME ZONE 'UTC')::integer - 1);

  FOR v_item IN
    SELECT sub.* FROM public.radio_submissions sub
    WHERE sub.submitted_at <= now() - interval '1 hour'
      AND (
        sub.status='pending' OR
        (sub.status='processing' AND sub.review_claimed_at <
          now() - interval '15 minutes')
      )
    ORDER BY sub.submitted_at,sub.id
    LIMIT p_limit
    FOR UPDATE OF sub SKIP LOCKED
  LOOP
    v_eligible:=v_eligible+1;
    BEGIN
      -- Explicit, exclusively claimed pending->processing->terminal path.
      v_claim:=gen_random_uuid();
      UPDATE public.radio_submissions
      SET status='processing',review_claimed_at=now(),review_claim_id=v_claim
      WHERE id=v_item.id AND status IN ('pending','processing');
      IF NOT FOUND THEN RAISE EXCEPTION 'RADIO_REVIEW_CLAIM_LOST'; END IF;

      SELECT * INTO v_song FROM public.songs WHERE id=v_item.song_id;
      SELECT * INTO v_station FROM public.radio_stations
        WHERE id=v_item.station_id;
      v_reason:=NULL;
      v_is_accepted:=false;
      v_country_fame:=0;
      v_show_id:=NULL;

      IF v_song.id IS NULL OR v_station.id IS NULL THEN
        v_reason:='Missing song or radio station data';
      ELSIF v_station.is_active IS FALSE THEN
        v_reason:='Station is no longer active';
      ELSIF v_song.band_id IS DISTINCT FROM v_item.band_id
          OR (v_item.band_id IS NULL
              AND v_song.user_id IS DISTINCT FROM v_item.user_id) THEN
        -- A forged or outdated attribution must not reward another artist.
        v_reason:='Song no longer belongs to submitting artist';
      ELSE
        IF v_item.band_id IS NOT NULL THEN
          SELECT * INTO v_band FROM public.bands
          WHERE id=v_item.band_id FOR UPDATE;
          IF NOT FOUND THEN
            v_reason:='Submitting band no longer exists';
          END IF;
        END IF;
        IF v_reason IS NULL THEN
          SELECT coalesce(bcf.fame,0) INTO v_country_fame
          FROM public.band_country_fans bcf
          WHERE bcf.band_id=v_item.band_id
            AND bcf.country=v_station.country;
          v_country_fame:=coalesce(v_country_fame,0);

          IF coalesce(v_station.min_fame_required,0)>v_country_fame
             AND v_item.band_id IS NOT NULL THEN
            v_reason:='Insufficient regional fame in '
              ||coalesce(v_station.country,'this country');
          END IF;
        END IF;

        IF v_reason IS NULL THEN
          SELECT id INTO v_show_id FROM public.radio_shows
          WHERE station_id=v_station.id AND is_active IS TRUE
          ORDER BY id LIMIT 1;
          IF v_show_id IS NULL THEN
            v_reason:='Station has no active radio show';
          ELSE
            v_min_quality:=greatest(20,coalesce(v_station.quality_level,50)*0.6);
            v_genre_match:=cardinality(coalesce(v_station.accepted_genres,ARRAY[]::text[]))=0
              OR lower(coalesce(v_song.genre,''))=ANY(
                ARRAY(SELECT lower(g) FROM unnest(v_station.accepted_genres) g));
            v_accept_probability:=0.3
              + CASE WHEN coalesce(v_song.quality_score,0)>=v_min_quality THEN 0.3 ELSE 0 END
              + CASE WHEN v_genre_match THEN 0.2 ELSE 0 END
              + CASE WHEN coalesce(v_song.hype,0)>=100 THEN 0.2 ELSE 0 END
              + CASE WHEN v_country_fame>=500 THEN 0.1 ELSE 0 END;
            IF v_item.band_id IS NOT NULL THEN
              v_accept_probability:=v_accept_probability+
                CASE WHEN coalesce(v_band.reputation_score,0)>=40 THEN 0.1
                WHEN coalesce(v_band.reputation_score,0)>=20 THEN 0.05
                WHEN coalesce(v_band.reputation_score,0)<=-40 THEN -0.15
                WHEN coalesce(v_band.reputation_score,0)<=-20 THEN -0.08
                ELSE 0 END;
            END IF;
            v_accept_probability:=least(0.95,greatest(0.05,v_accept_probability));
            v_is_accepted:=random()<v_accept_probability;
            IF NOT v_is_accepted THEN
              v_reason:=CASE WHEN coalesce(v_song.quality_score,0)<v_min_quality
                THEN 'Song does not meet the station quality requirement'
                WHEN NOT v_genre_match THEN 'Song genre not accepted by station'
                ELSE 'Song did not meet station criteria' END;
            END IF;
          END IF;
        END IF;
      END IF;

      IF v_is_accepted THEN
        -- Never credit acceptance until its playable show/playlist entry is
        -- durably present. The unique weekly key makes retries safe.
        INSERT INTO public.radio_playlists(
          show_id,song_id,week_start_date,is_active
        ) VALUES (v_show_id,v_song.id,v_week_start,true)
        ON CONFLICT (show_id,song_id,week_start_date)
        DO UPDATE SET is_active=true;

        IF v_item.band_id IS NOT NULL THEN
          UPDATE public.bands
          SET morale=least(100,coalesce(morale,50)+3),
              reputation_score=least(100,coalesce(reputation_score,0)+2)
          WHERE id=v_item.band_id
          RETURNING morale,reputation_score INTO v_morale,v_reputation;
          IF NOT FOUND THEN RAISE EXCEPTION 'RADIO_REVIEW_BAND_CHANGED'; END IF;
          INSERT INTO public.band_health_events(
            band_id,event_type,delta,new_value,source,description
          ) VALUES
          (v_item.band_id,'morale',3,round(v_morale)::integer,
            'radio_accepted','Song accepted by '||v_station.name),
          (v_item.band_id,'reputation',2,round(v_reputation)::integer,
            'radio_accepted','Radio rotation on '||v_station.name);
        END IF;

        UPDATE public.radio_submissions
          SET status='accepted',reviewed_at=now(),rejection_reason=NULL,
              review_claimed_at=NULL
        WHERE id=v_item.id AND status='processing'
          AND review_claim_id=v_claim;
        IF NOT FOUND THEN RAISE EXCEPTION 'RADIO_REVIEW_FINALIZE_FAILED'; END IF;
        v_accepted:=v_accepted+1;
      ELSE
        IF v_item.band_id IS NOT NULL AND v_song.id IS NOT NULL
          AND v_song.band_id=v_item.band_id THEN
          UPDATE public.bands SET morale=greatest(0,coalesce(morale,50)-1)
          WHERE id=v_item.band_id RETURNING morale INTO v_morale;
          IF FOUND THEN
            INSERT INTO public.band_health_events(
              band_id,event_type,delta,new_value,source,description
            ) VALUES (v_item.band_id,'morale',-1,round(v_morale)::integer,
              'radio_rejection',left('Radio submission rejected: '
                ||coalesce(v_reason,'Did not meet criteria'),500));
          END IF;
        END IF;
        UPDATE public.radio_submissions
          SET status='rejected',reviewed_at=now(),
              rejection_reason=left(coalesce(v_reason,'Did not meet criteria'),500),
              review_claimed_at=NULL
        WHERE id=v_item.id AND status='processing'
          AND review_claim_id=v_claim;
        IF NOT FOUND THEN RAISE EXCEPTION 'RADIO_REVIEW_FINALIZE_FAILED'; END IF;
        v_rejected:=v_rejected+1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- PL/pgSQL exception blocks are subtransactions. A failing playlist
      -- insert, terminal status update or health event undoes the claim AND
      -- all partial effects, making the pending submission retryable.
      v_failed:=v_failed+1;
      RAISE WARNING 'Radio review % failed: %',v_item.id,SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('eligible',v_eligible,'accepted',v_accepted,
    'rejected',v_rejected,'failed',v_failed);
END;
$fn$;

REVOKE ALL ON FUNCTION public.process_due_radio_submissions(integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_radio_submissions(integer)
  TO service_role;

-- Preserve existing cron job #54 and */30 * * * * schedule, replacing
-- network access (and stored anon JWT) with internal PostgreSQL execution.
DO $cron$
DECLARE v_job bigint;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    SELECT jobid INTO v_job FROM cron.job
      WHERE jobname='process-radio-submissions-cron' LIMIT 1;
    IF v_job IS NOT NULL THEN
      PERFORM cron.alter_job(v_job,
        command=>'SELECT public.process_due_radio_submissions();');
    END IF;
  END IF;
END;
$cron$;

-- Superseded admin scheduler must not invoke the old Edge route manually.
UPDATE public.cron_job_config
SET is_active=false,allow_manual_trigger=false,
    schedule='*/30 * * * *',
    description='Legacy Edge/manual review retired; live station submissions are processed by internal pg_cron process-radio-submissions-cron every 30 minutes.',
    updated_at=now()
WHERE job_name='process-radio-submissions';
