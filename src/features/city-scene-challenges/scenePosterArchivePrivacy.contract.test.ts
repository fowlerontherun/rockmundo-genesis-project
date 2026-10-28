import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(),
  'supabase/migrations/20261028115500_scene_monthly_poster_archive.sql'), 'utf8');
const board = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');

describe('City Scene historic mural archive SQL contract', () => {
  it('returns only ended monthly cycles with current non-revoked milestone truth', () => {
    expect(sql).toContain("c.cadence='monthly'");
    expect(sql).toContain('c.ends_at <= now()');
    expect(sql).toContain("c.status in ('completed','expired')");
    expect(sql).toContain('sm.revoked_at is null');
    expect(sql).toContain('private.scene_capped_cycle_points(m.id)');
    expect(sql).toContain('order by c.starts_at desc,c.id desc');
    expect(sql).toContain('p_limit > 24');
  });
  it('requires auth and does not expose member or reward fields', () => {
    expect(sql).toContain("raise exception 'AUTH_REQUIRED'");
    expect(sql).toContain('revoke all on function public.get_city_scene_poster_archive(uuid,integer)');
    expect(sql).toContain('from public, anon;');
    const payload = sql.split("jsonb_build_object(\n      'cycle_id'")[1]?.split(')\n    order by')[0] ?? '';
    expect(payload).toContain("'earned_points'");
    expect(payload).toContain("'milestones'");
    for (const key of ["'account_id'", "'profile_id'", "'user_id'", "'band_id'", "'source_event_id'"]) {
      expect(payload).not.toContain(key);
    }
    expect(sql).not.toContain('cron.schedule(');
    expect(sql).not.toMatch(/update public.scene_reward_/i);
    expect(board).toContain('<ScenePosterArchive cityId={board.city_id} cityName={board.city_name} refresh={refresh} />');
  });
});
