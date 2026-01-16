-- Unschedule existing jobs with wrong keys using the proper function
SELECT cron.unschedule('auto-start-gigs');
SELECT cron.unschedule('auto-complete-gigs');
SELECT cron.unschedule('complete-travel');
SELECT cron.unschedule('complete-release-manufacturing');
SELECT cron.unschedule('complete-video-production');
SELECT cron.unschedule('process-prison-events-cron');
SELECT cron.unschedule('release-prisoners-cron');
SELECT cron.unschedule('generate-radio-invitations-cron');
SELECT cron.unschedule('process-radio-submissions-cron');
SELECT cron.unschedule('simulate-radio-plays-cron');
SELECT cron.unschedule('simulate-video-views-cron');