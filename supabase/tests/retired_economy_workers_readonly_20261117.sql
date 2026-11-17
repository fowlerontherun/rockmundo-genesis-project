-- Read-only production certification for #4242, #4224 and #4253.
-- Safe to run in production: no calls to the privileged workers, no writes,
-- no stored tokens or user identifiers returned.
-- Any false result is a release blocker and requires investigation.
WITH checks AS (
  SELECT 'hourly_radio_internal_cron' AS check_name,
    EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobid=55 AND jobname='simulate-radio-plays-cron'
        AND active AND schedule='0 * * * *'
        AND command='SELECT public.process_hourly_radio_plays();'
    ) AS passed
  UNION ALL SELECT 'weekly_lottery_internal_cron',
    EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobid=123 AND jobname='weekly-lottery-draw'
        AND active AND schedule='5 0 * * 1'
        AND command='SELECT public.process_weekly_lottery_draw();'
    )
  UNION ALL SELECT 'video_completion_internal_cron',
    EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobid=48 AND jobname='complete-video-production'
        AND active AND schedule='*/30 * * * *'
        AND command='SELECT public.run_music_video_production_completion_scheduled();'
    )
  UNION ALL SELECT 'retired_crons_do_not_embed_jwts',
    NOT EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobid IN (48,55,123)
        AND command ~* 'eyJ[A-Za-z0-9_-]+[.]eyJ'
    )
  UNION ALL SELECT 'radio_job_blocks_anon_and_players',
    NOT has_function_privilege('anon','public.process_hourly_radio_plays()','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.process_hourly_radio_plays()','EXECUTE')
  UNION ALL SELECT 'lottery_job_blocks_anon_and_players',
    NOT has_function_privilege('anon','public.process_weekly_lottery_draw()','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.process_weekly_lottery_draw()','EXECUTE')
  UNION ALL SELECT 'video_jobs_block_anon_and_players',
    NOT has_function_privilege('anon','public.complete_due_music_video_productions_atomic(integer)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.complete_due_music_video_productions_atomic(integer)','EXECUTE')
    AND NOT has_function_privilege('anon','public.run_music_video_production_completion_scheduled()','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.run_music_video_production_completion_scheduled()','EXECUTE')
  UNION ALL SELECT 'retired_workers_are_service_executable',
    has_function_privilege('service_role','public.process_hourly_radio_plays()','EXECUTE')
    AND has_function_privilege('service_role','public.process_weekly_lottery_draw()','EXECUTE')
    AND has_function_privilege('service_role','public.run_music_video_production_completion_scheduled()','EXECUTE')
  UNION ALL SELECT 'video_awards_are_unique_and_private',
    EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid='public.music_video_production_awards'::regclass
        AND contype='p'
    )
    AND NOT has_table_privilege('authenticated','public.music_video_production_awards','INSERT')
    AND NOT has_table_privilege('anon','public.music_video_production_awards','INSERT')
  UNION ALL SELECT 'radio_playlist_hour_unique_receipt',
    EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND tablename='radio_plays'
        AND indexname='radio_plays_playlist_hour_unique'
    )
  UNION ALL SELECT 'no_awarded_unreleased_music_videos',
    NOT EXISTS (
      SELECT 1 FROM public.music_video_production_awards a
      JOIN public.music_videos v ON v.id=a.video_id
      WHERE v.status<>'released'
    )
)
SELECT check_name, passed FROM checks ORDER BY check_name;
