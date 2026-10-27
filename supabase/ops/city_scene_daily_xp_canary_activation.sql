-- Production-only, reviewed canary activation. Never invoke from migrations.
-- First reward: 20 XP once per account per expired daily City Scene cycle.
-- Other reward policies remain off. Existing atomic grant applies wallet,
-- ledger, profile-level trigger, unique receipt, and claim in one transaction.
do $$
declare v_job bigint;
begin
  perform pg_advisory_xact_lock(hashtext('rockmundo:scene:daily-xp-canary-activation'));
  if exists (select 1 from cron.job where jobname='rockmundo-city-scene-xp-canary-v1')
    or exists(select 1 from public.scene_reward_claims)
    or exists(select 1 from public.scene_reward_grant_receipts)
    or exists(select 1 from public.scene_reward_policies where enabled)
    or exists(select 1 from public.scene_reward_payout_controls where payouts_enabled)
  then raise exception 'Existing active Scene rewards or payout schedule; canary activation aborted';end if;
  if not exists(select 1 from public.scene_rollout_controls
    where singleton=true and scoring_enabled=true and cycle_generation_enabled=true)
  then raise exception 'City Scene scoring must be active before XP canary';end if;
  if (select count(*) from public.scene_reward_policies)<>4
    or not exists (select 1 from public.scene_reward_policies
      where reward_key='daily_participation_xp' and cadence='daily'
        and min_personal_points=1 and reward_amount=20 and reward_kind='xp'
        and requires_city_success=false and enabled=false)
  then raise exception 'Scene reward policy balance differs from reviewed canary';end if;
  if exists(select 1 from public.scene_reward_policies
     where reward_key<>'daily_participation_xp' and enabled)
  then raise exception 'Unexpectedly enabled non-canary rewards';end if;

  update public.scene_reward_policies
  set enabled=true where reward_key='daily_participation_xp';
  update public.scene_reward_payout_controls
  set payouts_enabled=true,updated_at=now() where singleton=true;

  v_job:=cron.schedule(
    'rockmundo-city-scene-xp-canary-v1',
    '35 * * * *',
    'select private.grant_scene_earned_xp(10);'
  );
  if v_job is null then raise exception 'Could not register scene XP canary';end if;
  raise notice 'City Scene XP canary active; job %, 20 XP per daily account; remaining policies off',v_job;
end $$;
