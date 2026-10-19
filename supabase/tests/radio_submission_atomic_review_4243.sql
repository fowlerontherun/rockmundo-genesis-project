-- #4243 production rollback-only integration fixture, no lasting changes.
BEGIN;
CREATE TEMP TABLE radio_review_fixtures ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY sub.id) AS n,sub.id,sub.band_id,
  sub.song_id,sub.station_id
FROM public.radio_submissions sub
JOIN public.songs so ON so.id=sub.song_id
JOIN public.radio_stations st ON st.id=sub.station_id
WHERE sub.status='accepted'
  AND coalesce(st.is_active,true)
  AND so.band_id IS NOT DISTINCT FROM sub.band_id
  AND EXISTS (SELECT 1 FROM public.radio_shows sh
    WHERE sh.station_id=sub.station_id AND sh.is_active=true)
ORDER BY sub.id LIMIT 3;

DO $required$
BEGIN
 IF (SELECT count(*) FROM radio_review_fixtures) <> 3 THEN
   RAISE EXCEPTION 'RADIO_REVIEW_FIXTURES_MISSING';
 END IF;
END;
$required$;

-- Rewind only three real, already-reviewed rows INSIDE the transaction.
-- The first two are eligible; third should stay pending until one hour.
UPDATE public.radio_submissions s
 SET status='pending',reviewed_at=NULL,rejection_reason=NULL,
  submitted_at=CASE WHEN f.n=3 THEN now()-interval '30 minutes'
    ELSE now()-interval '2 hours' END,
  review_claimed_at=NULL,review_claim_id=NULL
FROM radio_review_fixtures f WHERE s.id=f.id;

-- Force a crash during the terminal status UPDATE for exactly one fixture.
-- Its playlist and band event must roll back along with the processing claim.
SELECT set_config('app.radio_review_failure_id',
 (SELECT id::text FROM radio_review_fixtures WHERE n=2),true);

CREATE FUNCTION pg_temp.reject_radio_review_terminal()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
 IF NEW.id::text=current_setting('app.radio_review_failure_id',true)
   AND NEW.status IN ('accepted','rejected') THEN
    RAISE EXCEPTION 'RADIO_TEST_INJECTED_TERMINAL_ERROR';
 END IF;
 RETURN NEW;
END;
$fn$;
CREATE TRIGGER test_injected_radio_review_failure
 BEFORE UPDATE ON public.radio_submissions
 FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_radio_review_terminal();

CREATE TEMP TABLE radio_review_first AS
SELECT public.process_due_radio_submissions(100) outcome;
CREATE TEMP TABLE radio_review_after_failure AS
SELECT s.id,s.status,s.reviewed_at,
 (SELECT count(*) FROM public.band_health_events e
   WHERE e.band_id=s.band_id AND e.created_at>now()-interval '5 minutes'
     AND e.source IN ('radio_accepted','radio_rejection')) events_recent
FROM public.radio_submissions s JOIN radio_review_fixtures f ON s.id=f.id;
DROP TRIGGER test_injected_radio_review_failure ON public.radio_submissions;

CREATE TEMP TABLE radio_review_retry AS
SELECT public.process_due_radio_submissions(100) outcome;

CREATE TEMP TABLE radio_review_snapshot AS
SELECT
 (SELECT count(*) FROM public.radio_playlists) playlists,
 (SELECT count(*) FROM public.band_health_events) health_events,
 (SELECT sum(morale) FROM public.bands) band_morale,
 (SELECT sum(reputation_score) FROM public.bands) reputation;
CREATE TEMP TABLE radio_review_replay AS
SELECT public.process_due_radio_submissions(100) outcome;

SELECT
 (SELECT count(*)=3 FROM radio_review_fixtures) fixtures_found,
 (SELECT (outcome->>'eligible')::int=2 FROM radio_review_first) due_only_one_hour,
 (SELECT (outcome->>'failed')::int=1 FROM radio_review_first) injected_failure_counted,
 (SELECT (outcome->>'accepted')::int+(outcome->>'rejected')::int=1 FROM radio_review_first)
   first_one_committed,
 (SELECT status='pending' AND reviewed_at IS NULL
   FROM radio_review_after_failure WHERE id=(SELECT id FROM radio_review_fixtures WHERE n=2))
   failed_claim_rolled_back,
 (SELECT (outcome->>'accepted')::int+(outcome->>'rejected')::int=1
    AND (outcome->>'failed')::int=0 FROM radio_review_retry)
   failed_submission_safely_retried,
 (SELECT count(*)=2 FROM public.radio_submissions s
    JOIN radio_review_fixtures f ON f.id=s.id
    WHERE f.n IN (1,2) AND s.status IN ('accepted','rejected')
       AND s.reviewed_at IS NOT NULL) exactly_two_terminal,
 (SELECT s.status='pending' AND s.reviewed_at IS NULL
   FROM public.radio_submissions s JOIN radio_review_fixtures f ON f.id=s.id
   WHERE f.n=3) recent_submission_still_pending,
 (SELECT (outcome->>'eligible')::int=0 FROM radio_review_replay)
   replay_no_eligible_rows,
 (SELECT (outcome->>'accepted')::int=0 AND (outcome->>'rejected')::int=0
   FROM radio_review_replay) replay_no_extra_settlement,
 (SELECT (SELECT count(*) FROM public.radio_playlists)=playlists
   FROM radio_review_snapshot) replay_no_extra_playlist,
 (SELECT (SELECT count(*) FROM public.band_health_events)=health_events
   FROM radio_review_snapshot) replay_no_extra_health_events,
 (SELECT (SELECT sum(morale) FROM public.bands)=band_morale
   FROM radio_review_snapshot) replay_no_extra_morale,
 (SELECT (SELECT sum(reputation_score) FROM public.bands)=reputation
   FROM radio_review_snapshot) replay_no_extra_reputation,
 (SELECT count(*)=0 FROM public.radio_submissions s
   JOIN radio_review_fixtures f ON f.id=s.id
   WHERE s.status='processing') no_stuck_processing_claims,
 NOT has_function_privilege('anon','public.process_due_radio_submissions(integer)','EXECUTE')
   anon_worker_denied,
 NOT has_function_privilege('authenticated','public.process_due_radio_submissions(integer)','EXECUTE')
   browser_worker_denied,
 has_function_privilege('service_role','public.process_due_radio_submissions(integer)','EXECUTE')
   scheduler_worker_authorized,
 (SELECT schedule='*/30 * * * *'
    AND command='SELECT public.process_due_radio_submissions();'
    AND active FROM cron.job WHERE jobname='process-radio-submissions-cron')
   live_internal_cron_preserved,
 (SELECT is_active=false AND allow_manual_trigger=false
    FROM public.cron_job_config WHERE job_name='process-radio-submissions')
   old_manual_http_disabled;
ROLLBACK;
