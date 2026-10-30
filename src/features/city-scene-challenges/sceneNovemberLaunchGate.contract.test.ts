import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const query = readFileSync(
  resolve(process.cwd(), 'supabase/ops/city_scene_november_launch_gate.sql'), 'utf8',
);
const sql = query.replace(/^--.*$/gm, '');

describe('November City Scene prelaunch operator gate', () => {
  it('stays read-only and cannot enable scoring, rewards or schedule jobs', () => {
    expect(sql).toMatch(/^\s*with\s+/i);
    expect(sql).toContain('select');
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|drop|truncate|create|grant|revoke|call|perform|execute)\b/i);
    expect(sql).not.toMatch(/^\s*select\s+private\.scene_run_verified_tick\(50\)\s*;/im);
    expect(sql).not.toContain('source_event_id');
    expect(sql).not.toContain('profile_id');
    expect(sql).not.toContain('account_id');
  });

  it('checks source gates, 15-minute worker health and idempotent November cycles', () => {
    for (const required of [
      'scene_rollout_controls',
      "monthly_first_start = date '2026-11-01'",
      'scene_challenge_templates',
      "action_type = 'scene:verified_community'",
      "'gig:verified_performance'",
      "'recording:completed'",
      "'rehearsal:completed'",
      "'jam:verified_collaboration'",
      'or (select jam_enabled from source_flags)',
      "schedule = '*/15 * * * *'",
      "start_time >= now() - interval '45 minutes'",
      'worker_failures_last_hour',
      'duplicate_monthly_groups',
      'monthly_cycles_with_wrong_objective_count',
      'left join public.scene_challenge_objectives ob on ob.cycle_id = cc.id',
      'having count(ob.id) <> 1',
      "'2026-11-02 00:00:00+00'",
      "'PRE_LAUNCH'",
      "'ACTIVATION_WINDOW'",
      "'POST_START_REVIEW'",
    ]) expect(sql).toContain(required);
  });

  it('does not mark unauthorized XP payouts as ready', () => {
    for (const gate of [
      'scene_reward_payout_controls',
      'scene_reward_policies',
      'scene_reward_grant_receipts',
      'scene_reward_activation_authorizations',
      'live_reward_approval',
      'approval_record_count <> 1',
      'reward_approval_record_count',
      'active_xp_schedules',
      'grant_receipts > 0',
      "then 'BLOCKED'",
    ]) expect(sql).toContain(gate);
  });

  it('watches for any eligible missing city even when other cities have launched', () => {
    expect(sql).toContain('from private.scene_november_city_readiness()');
    expect(sql).toContain("readiness = 'missing_after_grace'");
    expect(sql).toContain("'eligible_cities_now'");
    expect(sql).toContain("'monthly_created_cities'");
    expect(sql).toContain("'monthly_missing_cities'");
    expect(sql).toContain("'city_readiness'");
    expect(sql).toContain("'projected_target'");
    expect(sql).toContain("'november_cycles'");
    expect(sql).toContain("'objectives'");
    expect(sql).not.toContain('scene_contributions');
  });

  it('reports statuses and safe aggregate evidence instead of identities', () => {
    for (const key of [
      'launch_gate', 'launch_phase', 'checked_utc', 'evidence',
      'monthly_template_enabled', 'november_monthly_cycles',
      'daily_active_cycles', 'weekly_active_cycles', 'last_worker_status',
      'payouts_enabled', 'enabled_reward_policies',
    ]) expect(sql).toContain(key);
  });
});
