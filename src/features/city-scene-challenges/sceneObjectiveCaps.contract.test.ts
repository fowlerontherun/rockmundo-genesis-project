import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027121000_scene_objective_capped_progress.sql'),
  'utf8',
);

describe('City Scene objective-aware community progress', () => {
  it('caps each objective separately, so one activity cannot win all daily tasks', () => {
    expect(sql).toContain('least(obj.target_points, coalesce((');
    expect(sql).toContain('sc.objective_id = obj.id and sc.invalidated_at is null');
    // Example: 3 daily goals with targets 2, 1, 1. A third gig cannot
    // compensate for an unfinished studio or jam goal.
    const target = [2, 1, 1];
    const earned = [6, 0, 0];
    const counted = target.reduce((sum, limit, i) => sum + Math.min(limit, earned[i] ?? 0), 0);
    expect(counted).toBe(2);
    expect(counted).toBeLessThan(target.reduce((a, b) => a + b, 0));
  });

  it('uses the same capped total in board projection, mural milestones and rewards', () => {
    expect(sql).toContain('private.scene_capped_cycle_points(cc.id)');
    expect(sql).toContain('private.scene_capped_cycle_points(c.id)');
    expect(sql).toContain('private.scene_capped_cycle_points(cycle.id) as city_points');
    expect(sql).toContain('least(ob.target_points, coalesce(sum(sc2.points), 0))');
    expect(sql).not.toContain('cron.schedule(');
    expect(sql).not.toMatch(/\bupdate\s+public\.player_xp_wallet\b/i);
  });

  it('updates objective completion flags using verified non-invalidated events', () => {
    expect(sql).toContain('update public.scene_challenge_objectives obj');
    expect(sql).toContain("then 'completed' else 'active' end");
    expect(sql).toContain('sc.invalidated_at is null');
  });

  it('restricts the helper and leaves existing reward policy flags unchanged', () => {
    expect(sql).toContain('revoke all on function private.scene_capped_cycle_points(uuid)');
    expect(sql).toContain('grant execute on function private.scene_capped_cycle_points(uuid) to service_role');
    expect(sql).not.toMatch(/\bupdate\s+public\.scene_reward_policies\b/i);
    expect(sql).not.toMatch(/\bupdate\s+public\.scene_challenge_templates\b/i);
  });
});
