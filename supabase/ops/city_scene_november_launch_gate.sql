-- November City Scene launch gate (read-only, operator use only).
-- Run in the Supabase SQL editor with privileged operator access.
-- Never enables campaigns, scores events, grants XP, or schedules jobs.
-- Run before 1 Nov and again after the first 15-minute worker ticks.
-- A missing monthly campaign only becomes a watchpoint after 2 Nov UTC:
-- eligibility depends on recently active characters, not all configured cities.
with
  rollout as (
    select cycle_generation_enabled, scoring_enabled, monthly_first_start
    from public.scene_rollout_controls where singleton is true
  ),
  source_flags as (
    select
      count(*) filter (where enabled and action_type in (
        'scene:verified_community', 'gig:verified_performance',
        'recording:completed', 'rehearsal:completed'
      )) as required_enabled,
      coalesce(bool_or(enabled) filter (
        where action_type = 'jam:verified_collaboration'
      ), false) as jam_enabled
    from public.scene_source_controls
  ),
  monthly_template as (
    select count(*) filter (where enabled and cadence = 'monthly'
      and action_type = 'scene:verified_community') as enabled_count
    from public.scene_challenge_templates
  ),
  worker as (
    select jobid, active, schedule,
      command = 'select private.scene_run_verified_tick(50);' as expected_command
    from cron.job where jobname = 'rockmundo-city-scene-verified-v1'
    order by jobid desc limit 1
  ),
  latest_worker_run as (
    select status, start_time from cron.job_run_details
    where jobid = (select jobid from worker)
    order by start_time desc limit 1
  ),
  worker_failures as (
    select count(*) as recent_count from cron.job_run_details
    where jobid = (select jobid from worker)
      and start_time > now() - interval '1 hour'
      and status = 'failed'
  ),
  monthly as (
    select count(*) as cycle_count
    from public.scene_challenge_cycles
    where cadence = 'monthly'
      and starts_at >= timestamptz '2026-11-01 00:00:00+00'
      and starts_at < timestamptz '2026-12-01 00:00:00+00'
  ),
  duplicates as (
    select count(*) as duplicate_groups
    from (
      select city_id, cadence, starts_at
      from public.scene_challenge_cycles
      where cadence = 'monthly'
        and starts_at >= timestamptz '2026-11-01 00:00:00+00'
        and starts_at < timestamptz '2026-12-01 00:00:00+00'
      group by city_id, cadence, starts_at having count(*) > 1
    ) duplicates
  ),
  bad_monthly_objectives as (
    select count(*) as cycle_count from (
      select cc.id
      from public.scene_challenge_cycles cc
      left join public.scene_challenge_objectives ob on ob.cycle_id = cc.id
      where cc.cadence = 'monthly'
        and cc.starts_at >= timestamptz '2026-11-01 00:00:00+00'
        and cc.starts_at < timestamptz '2026-12-01 00:00:00+00'
      group by cc.id having count(ob.id) <> 1
    ) invalid_objective_count
  ),
  existing as (
    select
      count(*) filter (where cadence = 'daily') as daily,
      count(*) filter (where cadence = 'weekly') as weekly
    from public.scene_challenge_cycles
    where starts_at <= now() and ends_at > now()
  ),
  rewards as (
    select
      coalesce((select payouts_enabled from public.scene_reward_payout_controls where singleton is true), true) as payouts_enabled,
      (select count(*) from public.scene_reward_policies where enabled) as enabled_policies,
      (select count(*) from public.scene_reward_grant_receipts) as grant_receipts,
      (select count(*) from private.scene_reward_activation_authorizations
        where singleton is true) as approval_record_count,
      coalesce((select approved_until > now()
        from private.scene_reward_activation_authorizations where singleton is true), false) as live_reward_approval,
      (select count(*) from cron.job where active and jobname like '%scene%xp%') as active_xp_schedules
  )
select
  now() at time zone 'UTC' as checked_utc,
  case
    when not coalesce((select cycle_generation_enabled and scoring_enabled
                       and monthly_first_start = date '2026-11-01' from rollout), false)
      or (select required_enabled from source_flags) <> 4
      or (select jam_enabled from source_flags)
      or (select enabled_count from monthly_template) = 0
      or not coalesce((select active and schedule = '*/15 * * * *'
                       and expected_command from worker), false)
      or (select duplicate_groups from duplicates) > 0
      or (select cycle_count from bad_monthly_objectives) > 0
      or (select payouts_enabled or enabled_policies > 0
                       or grant_receipts > 0 or approval_record_count <> 1
                       or live_reward_approval or active_xp_schedules > 0 from rewards)
      then 'BLOCKED'
    when not coalesce((select status = 'succeeded'
                       and start_time >= now() - interval '45 minutes'
                       from latest_worker_run), false)
      or (select recent_count from worker_failures) > 0
      or (now() >= timestamptz '2026-11-02 00:00:00+00'
          and (select cycle_count from monthly) = 0)
      then 'WATCH'
    else 'READY'
  end as launch_gate,
  case
    when now() < timestamptz '2026-11-01 00:00:00+00' then 'PRE_LAUNCH'
    when now() < timestamptz '2026-11-02 00:00:00+00' then 'ACTIVATION_WINDOW'
    else 'POST_START_REVIEW'
  end as launch_phase,
  jsonb_build_object(
    'rollout_enabled', (select cycle_generation_enabled from rollout),
    'scoring_enabled', (select scoring_enabled from rollout),
    'monthly_first_start', (select monthly_first_start from rollout),
    'required_sources_enabled', (select required_enabled from source_flags),
    'jam_source_enabled', (select jam_enabled from source_flags),
    'monthly_template_enabled', (select enabled_count from monthly_template),
    'cron_active', (select active from worker),
    'cron_schedule', (select schedule from worker),
    'cron_command_expected', (select expected_command from worker),
    'last_worker_status', (select status from latest_worker_run),
    'last_worker_at', (select start_time from latest_worker_run),
    'worker_failures_last_hour', (select recent_count from worker_failures),
    'daily_active_cycles', (select daily from existing),
    'weekly_active_cycles', (select weekly from existing),
    'november_monthly_cycles', (select cycle_count from monthly),
    'duplicate_monthly_groups', (select duplicate_groups from duplicates),
    'monthly_cycles_with_wrong_objective_count', (select cycle_count from bad_monthly_objectives),
    'payouts_enabled', (select payouts_enabled from rewards),
    'enabled_reward_policies', (select enabled_policies from rewards),
    'xp_grant_receipts', (select grant_receipts from rewards),
    'reward_approval_record_count', (select approval_record_count from rewards),
    'active_reward_approval', (select live_reward_approval from rewards),
    'active_xp_schedules', (select active_xp_schedules from rewards)
  ) as evidence;
