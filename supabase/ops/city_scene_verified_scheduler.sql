-- City Scene operational schedule (run by an authorised DBA, NOT a migration).
-- Idempotent and guarded; function checks public.scene_rollout_controls.
-- Disable immediately with:
-- UPDATE public.scene_rollout_controls
-- SET scoring_enabled=false,cycle_generation_enabled=false,updated_at=now()
-- WHERE singleton is true;
-- Or stop schedule with: SELECT cron.unschedule('rockmundo-city-scene-verified-v1');
do $$
begin
  if exists(select 1 from cron.job where jobname='rockmundo-city-scene-verified-v1') then
    raise exception 'City Scene cron already exists; inspect before replacing';
  end if;
  perform cron.schedule(
    'rockmundo-city-scene-verified-v1',
    '*/15 * * * *',
    'select private.scene_run_verified_tick(50);'
  );
end;
$$;
