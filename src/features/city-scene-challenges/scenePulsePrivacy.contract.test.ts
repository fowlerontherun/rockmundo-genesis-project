import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261028080000_scene_privacy_safe_pulse.sql'),
  'utf8',
);
const board = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');

describe('City Scene Pulse SQL privacy contract', () => {
  it('requires authentication, applies a three-account k-anonymity threshold and limits results', () => {
    expect(migration).toContain("raise exception 'AUTH_REQUIRED'");
    expect(migration).toContain('having count(distinct sc.account_id) >= 3');
    expect(migration).toContain('p_limit > 20');
    expect(migration).toContain('sc.invalidated_at is null');
    expect(migration).toContain('sc.source_completed_at >= cycle.starts_at');
    expect(migration).toContain('sc.source_completed_at < cycle.ends_at');
    expect(migration).toContain('milestone.revoked_at is null');
  });

  it('does not return actor, band, event or precise timestamp information', () => {
    const publicPayload = migration.split("jsonb_build_object(\n        'day_utc'")[1]?.split(')\n      order by')[0] ?? '';
    expect(publicPayload).toContain("'action_type'");
    expect(publicPayload).toContain("'milestone_percent'");
    for (const key of ["'account_id'", "'profile_id'", "'band_id'", "'source_event_id'", "'source_completed_at'", "'reached_at'"]) {
      expect(publicPayload).not.toContain(key);
    }
    expect(migration).toContain("at time zone 'UTC')::date");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain('revoke all on function public.get_city_scene_pulse(uuid,text,integer)');
    expect(migration).toContain('from public, anon;');
  });

  it('leaves XP approval, scoring and payout controls untouched', () => {
    expect(migration).not.toContain('cron.schedule(');
    expect(migration).not.toMatch(/update public.scene_reward_/i);
    expect(migration).not.toContain('scene_grant_earned_xp(');
    expect(board).toContain('<ScenePulse cityId={board.city_id} cadence={active} refresh={refresh} />');
  });
});
