import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const policy = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027101000_scene_reward_entitlements.sql'), 'utf8',
);
const processor = readFileSync(
  resolve(process.cwd(), 'supabase/functions/scene-challenges-processor/index.ts'), 'utf8',
);
const cursor = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027100000_scene_jam_batch_cursor.sql'), 'utf8',
);

describe('City Scene reward entitlement safety', () => {
  it('seeds disabled, balance-reviewable XP policies', () => {
    expect(policy).toContain("'daily_participation_xp', 'daily', 2, false, 'xp', 100, false");
    expect(policy).toContain("'weekly_participation_xp', 'weekly', 8, false, 'xp', 350, false");
    expect(policy).toContain("'monthly_participation_xp', 'monthly', 20, false, 'xp', 1000, false");
    expect(policy).toContain('and policy.enabled is true');
    expect(policy).toContain('contribution.invalidated_at is null');
  });

  it('creates account-scoped, idempotent pending entitlements only', () => {
    expect(policy).toContain('on conflict(account_id, cycle_id, reward_key) do nothing');
    expect(policy).toContain("'pending', policy.reward_kind, policy.reward_amount");
    expect(policy).toContain('cycle.ends_at <= now()');
    expect(policy).toContain('earned.earned_points >= policy.min_personal_points');
    expect(policy).toContain('earned.city_points >= earned.target_total');
    expect(policy).not.toMatch(/\binsert\s+into\s+public\.experience_ledger\b/i);
    expect(policy).not.toMatch(/\bupdate\s+public\.player_xp_wallet\b/i);
    expect(policy).not.toMatch(/\bupdate\s+public\.profiles\b/i);
  });

  it('keeps evaluation service-only and does not pay through the edge processor', () => {
    expect(policy).toContain('security invoker');
    expect(policy).toContain('from public, anon, authenticated');
    expect(policy).toContain('to service_role');
    expect(processor).toContain(".rpc('scene_reconcile_reward_entitlements')");
    expect(processor).not.toContain('player_xp_wallet');
    expect(processor).not.toContain('experience_ledger');
  });

  it('cannot consume a finalised jam before an enabled, healthy cycle is present', () => {
    expect(cursor).toContain("coalesce(o.source_health_snapshot->>'scoring_enabled','false') = 'true'");
    expect(cursor).toContain("cycle.ends_at >= now() - interval '7 days'");
    expect(cursor).toContain("'disabled', true");
  });
});
