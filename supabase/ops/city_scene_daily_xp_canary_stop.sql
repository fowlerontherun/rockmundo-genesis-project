-- Immediate City Scene XP canary emergency stop.
-- This does NOT remove any already granted wallet XP or ledger receipts.
-- Use when worker errors, unexpected reward volumes, or economy issues arise.
do $$
begin
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:daily-xp-canary-activation'));
  update public.scene_reward_payout_controls
  set payouts_enabled=false,updated_at=now() where singleton=true;
  update public.scene_reward_policies
  set enabled=false where reward_key='daily_participation_xp';
  if exists(select 1 from cron.job where jobname='rockmundo-city-scene-xp-canary-v1')
  then perform cron.unschedule('rockmundo-city-scene-xp-canary-v1'); end if;
end $$;
