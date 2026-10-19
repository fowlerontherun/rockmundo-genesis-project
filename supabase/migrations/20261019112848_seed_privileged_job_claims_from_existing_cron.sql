-- Production receipt 20261019112848. Legacy successfully dispatched
-- pg_cron windows are consumed at cutover. Re-running a partially completed
-- global worker is unsafe; operator reconciliation is required instead.
INSERT INTO public.privileged_job_window_claims(job_name,window_started_at)
SELECT DISTINCT c.job_name,
 to_timestamp(floor(extract(epoch from d.start_time)/(c.minutes*60))*(c.minutes*60))
FROM cron.job_run_details d
JOIN (VALUES
 (12,'generate-gig-offers',360),
 (49,'generate-pr-offers',360),
 (53,'generate-radio-invitations',360),
 (47,'complete-release-manufacturing',2),
 (64,'process-tour-travel',60),
 (45,'auto-complete-gigs',15)
) AS c(job_id,job_name,minutes) ON c.job_id=d.jobid
WHERE d.status='succeeded' AND d.start_time>=now()-interval '2 days'
ON CONFLICT DO NOTHING;
