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
    expect(sql).not.toContain('select private.scene_run_verified_tick(50);');
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
      "schedule = '*/15 * * * *'",
      "start_time >= now() - interval '45 minutes'",
      'worker_failures_last_hour',
      'duplicate_monthly_groups',
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
      'active_xp_schedules',
      'grant_receipts > 0',
      "then 'BLOCKED'",
    ]) expect(sql).toContain(gate);
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
