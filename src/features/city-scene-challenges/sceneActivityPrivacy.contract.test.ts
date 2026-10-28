import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261028062600_scene_owner_activity_timeline.sql'),
  'utf8',
);
const page = readFileSync(
  resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'),
  'utf8',
);

describe('City Scene activity history DB contract', () => {
  it('is strictly authenticated and RLS-constrained to the owning account and city', () => {
    expect(sql).toContain('get_my_city_scene_activity');
    expect(sql).toContain('security invoker');
    expect(sql).not.toContain('security definer');
    expect(sql).toContain('sc.account_id = (select auth.uid())');
    expect(sql).toContain('sc.city_id = p_city_id');
    expect(sql).toContain('cyc.city_id = p_city_id');
    expect(sql).toContain('sc.invalidated_at is null');
    expect(sql).toContain("raise exception 'AUTH_REQUIRED'");
    expect(sql).toContain('p_limit > 100');
    expect(sql).toContain('revoke all on function public.get_my_city_scene_activity(uuid, integer)');
    expect(sql).toContain('from public, anon;');
    expect(sql).toContain('to authenticated, service_role;');
  });

  it('returns only cycle, cadence, action, points and timestamps', () => {
    const payload = sql.split('jsonb_build_object(')[1]?.split(')\n      order by')[0] ?? '';
    expect(payload).toContain("'cycle_id'");
    expect(payload).toContain("'action_type'");
    expect(payload).toContain("'completed_at'");
    for (const privateColumn of ["'account_id'", "'profile_id'", "'band_id'", "'source_event_id'", "'reward_key'"]) {
      expect(payload).not.toContain(privateColumn);
    }
  });

  it('does not create or enable reward processing or scoring', () => {
    expect(sql).not.toContain('cron.schedule(');
    expect(sql).not.toMatch(/update public.scene_reward_/i);
    expect(sql).not.toContain('scene_grant_earned_xp(');
    expect(page).toContain("rpc('get_my_city_scene_activity'");
    expect(page).toContain('isSceneActivityCredits(activity.data)');
    expect(page).toContain('<SceneActivityTimeline credits={credits} />');
    expect(page).not.toContain("rpc('scene_grant_earned_xp'");
  });
});
