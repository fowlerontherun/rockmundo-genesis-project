import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(),
    'supabase/migrations/20261027164500_scene_late_finalization_milestone_reconciliation.sql'), 'utf8',
);
const integration = readFileSync(
  resolve(process.cwd(),
    'supabase/tests/city_scene_late_event_reconciliation_integration.sql'), 'utf8',
);

describe('City Scene late source finalisation and mural revocation', () => {
  it('reconciles expired cycles for seven days after the event deadline', () => {
    expect(migration).toContain("'active','completed','expired'");
    expect(migration).toContain("c.ends_at > now() - interval '7 days'");
    expect(migration).toContain("when c.ends_at<=now() then 'expired'");
    expect(migration).toContain("when private.scene_capped_cycle_points(c.id)>=c.target_total then 'completed'");
  });

  it('preserves milestone history but hides revoked progress from player boards', () => {
    expect(migration).toContain('add column if not exists revoked_at timestamptz');
    expect(migration).toContain('set revoked_at=now()');
    expect(migration).toContain('on conflict(cycle_id,percent_threshold) do update');
    expect(migration).toContain('where sm.cycle_id = cc.id and sm.revoked_at is null');
    expect(migration).toContain('obj.status in (\'active\',\'completed\')');
  });

  it('prevents rewards or schedules from being introduced by reconciling murals', () => {
    expect(migration).not.toContain('cron.schedule(');
    expect(migration).not.toMatch(/\bupdate\s+public\.player_xp_wallet\b/i);
    expect(migration).not.toMatch(/\bupdate\s+public\.scene_reward_policies\b/i);
    expect(migration).not.toContain('scene_grant_earned_xp(');
  });

  it('has rollback-only test scenarios for late completion, invalidation and restoration', () => {
    expect(integration).toMatch(/^begin;/m);
    expect(integration).toMatch(/rollback;\s*$/);
    expect(integration).toContain('LATE_EVENT_DID_NOT_COMPLETE_EXPIRED_CYCLE');
    expect(integration).toContain('INVALIDATED_MURAL_STILL_VISIBLE_ON_BOARD');
    expect(integration).toContain('RESTORING_VALID_SOURCE_FAILED');
    expect(integration).toContain('SCENE_MURAL_RECONCILIATION_NOT_IDEMPOTENT');
  });
});
