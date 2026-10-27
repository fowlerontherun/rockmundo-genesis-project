import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027160000_scene_balanced_reward_policies.sql'), 'utf8',
);
const switches = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027161500_scene_immediate_source_kill_switches.sql'), 'utf8',
);

describe('City Scene post-launch XP balance and independent source gates', () => {
  it('keeps modest, attainable daily/weekly/monthly rewards disabled', () => {
    for (const [key, min, xp] of [
      ['daily_participation_xp', 1, 20],
      ['daily_completion_xp', 1, 20],
      ['weekly_participation_xp', 2, 75],
      ['monthly_participation_xp', 3, 250],
    ] as const) {
      expect(migration).toContain(`when '${key}' then ${min}`);
      expect(migration).toContain(`when '${key}' then ${xp}`);
    }
    // 31 days + up to five weekly periods + one monthly award.
    const upperBound = 31 * (20 + 20) + 5 * 75 + 250;
    expect(upperBound).toBe(1865);
    expect(migration).toContain("or exists(select 1 from public.scene_reward_grant_receipts)");
    expect(migration).toContain("where reward_key in (");
    expect(migration).toContain('and enabled=false and reward_kind=\'xp\'');
    expect(migration).not.toMatch(/\bupdate\s+public\.scene_reward_payout_controls\b/i);
  });

  it('blocks all three source ingesters when the individual live gate is off', () => {
    for (const source of ['recording:completed','gig:verified_performance','rehearsal:completed']) {
      expect(switches).toContain(`action_type='${source}' and enabled is true`);
    }
    expect(switches).toContain('select 1 from public.scene_rollout_controls');
    expect(switches).toContain('scoring_enabled is true');
    expect(switches).toContain('return 0;');
  });

  it('prevents queue cursor consumption during source downtime', () => {
    const guardCount = switches.split("return jsonb_build_object('disabled',true,'events_processed',0,'contributions_inserted',0,'backlog_pending',false)").length - 1;
    expect(guardCount).toBe(3);
    expect(switches).toContain("action_type='scene:verified_community' and monthly_ctrl.enabled is true");
    expect(switches).not.toContain('cron.schedule(');
    expect(switches).not.toContain('scene_grant_earned_xp');
  });
});
