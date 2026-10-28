import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(),
  'supabase/migrations/20261028125354_scene_daily_weekly_legacy.sql'), 'utf8');
const page = readFileSync(resolve(process.cwd(),
  'src/pages/CitySceneChallenges.tsx'), 'utf8');
const postgresWorkflow = readFileSync(resolve(process.cwd(),
  '.github/workflows/city-scene-postgres.yml'), 'utf8');

describe('Scene Legacy read-only identity and milestone contract',()=>{
  it('limits access to authenticated daily and weekly historical cycles',()=>{
    expect(sql).toContain("if (select auth.uid()) is null");
    expect(sql).toContain("p_cadence not in ('daily','weekly')");
    expect(sql).toContain('c.ends_at <= now()');
    expect(sql).toContain("c.status in ('completed','expired')");
    expect(sql).toContain('c.city_id = p_city_id');
    expect(sql).toContain('p_limit > 24');
    expect(sql).toContain('revoke all on function public.get_city_scene_legacy(uuid,text,integer)');
    expect(sql).toContain('to authenticated,service_role');
  });
  it('computes score from source validity and keeps revoked milestones out',()=>{
    expect(sql).toContain('private.scene_capped_cycle_points(h.id)');
    expect(sql).toContain('sm.revoked_at is null');
    expect(sql).toContain('jsonb_agg(sm.percent_threshold');
    expect(sql).not.toContain('from public.profiles');
    expect(sql).not.toContain('from public.scene_contributions');
    expect(sql).not.toContain("'account_id'");
    expect(sql).not.toContain("'profile_id'");
    expect(sql).not.toContain("'source_event_id'");
    expect(sql).not.toContain('scene_grant_earned_xp');
    expect(sql).not.toContain('scene_reward_payout_controls');
  });
  it('is integrated with city page and isolated integration checks',()=>{
    expect(page).toContain('<SceneLegacy cityId={board.city_id} cityName={board.city_name} refresh={refresh} />');
    expect(postgresWorkflow).toContain('city_scene_legacy_integration.sql');
  });
});
