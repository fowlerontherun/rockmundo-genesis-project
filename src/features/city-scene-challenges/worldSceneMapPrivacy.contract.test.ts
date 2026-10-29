import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261029081108_scene_world_map_status.sql'), 'utf8');
const page = readFileSync(resolve(process.cwd(), 'src/pages/WorldMap.tsx'), 'utf8');
const atlas = readFileSync(resolve(process.cwd(), 'src/components/map/WorldAtlas.tsx'), 'utf8');
const map = readFileSync(resolve(process.cwd(), 'src/components/map/InteractiveWorldMap.tsx'), 'utf8');

describe('World Scene map privacy and player UX', () => {
  it('returns only persisted non-revoked milestone stages, no raw activity identity or score', () => {
    expect(sql).toContain('public.scene_milestones');
    expect(sql).toContain('m.revoked_at is null');
    expect(sql).toContain('m.percent_threshold in (25,50,75,100)');
    expect(sql).toContain("c.status = 'active'");
    expect(sql).toContain('c.ends_at > now()');
    expect(sql).toContain("when 'monthly' then 0 else 1");
    expect(sql).toContain("'confirmed_stage'");
    for (const unsafe of ['scene_contributions', 'account_id', 'profile_id', 'source_event_id', "'earned_points'"]) {
      expect(sql).not.toContain(unsafe);
    }
  });
  it('uses authenticated read-only RPC and no client mutation or XP activation', () => {
    expect(sql).toContain("if (select auth.uid()) is null then");
    expect(sql).toContain('revoke all on function public.get_world_city_scene_status()');
    expect(sql).toContain('from public,anon');
    expect(sql).toContain('to authenticated,service_role');
    expect(sql).not.toMatch(/(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.scene_/i);
    expect(page).toContain('rpc("get_world_city_scene_status")');
    expect(page).toContain('isWorldSceneStatus(data)');
    expect(page).toContain('activeWorldScenes(sceneQuery.data, sceneNowMs)');
    expect(page).toContain('City Scene glow');
    expect(atlas).toContain('sceneStatusByCity');
    expect(atlas).toContain('/scene-challenges');
    expect(map).toContain("valueMode === 'scene'");
    expect(map).toContain('No active verified City Scene campaign');
    expect(page).not.toContain('scene_reward_payout_controls');
  });
});
