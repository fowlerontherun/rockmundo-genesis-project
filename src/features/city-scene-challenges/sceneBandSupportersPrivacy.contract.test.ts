import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(),
  'supabase/migrations/20261028112420_scene_band_supporters_opt_in.sql'), 'utf8');
const page = readFileSync(resolve(process.cwd(),
  'src/pages/CitySceneChallenges.tsx'), 'utf8');

describe('Band supporter SQL privacy and payout contract', () => {
  it('uses leader-only explicit consent and no ordinary client table privileges', () => {
    expect(sql).toContain('enabled boolean not null default false');
    expect(sql).toContain('alter table public.scene_band_leaderboard_opt_ins enable row level security');
    expect(sql).toContain('revoke all on public.scene_band_leaderboard_opt_ins from public, anon, authenticated');
    expect(sql).toContain('leader.user_id=v_account');
    expect(sql).toContain('b.status=\'active\'');
    expect(sql).toContain("raise exception 'BAND_LEADER_REQUIRED'");
    expect(sql).toContain('sc.invalidated_at is null');
    expect(sql).toContain('opt.enabled is true');
  });
  it('only publishes aggregated band names, never member or source identifiers', () => {
    const payload = sql.split("jsonb_build_object('rank'")[1]?.split(')\n      order by')[0] ?? '';
    expect(payload).toContain("'band_name'");
    expect(payload).toContain("'verified_events'");
    for (const key of ["'account_id'", "'profile_id'", "'user_id'", "'source_event_id'", "'leader_id'"]) {
      expect(payload).not.toContain(key);
    }
    expect(sql).toContain('where rank<=p_limit');
    expect(sql).toContain('p_limit > 20');
  });
  it('keeps rewards and scoring untouched while attaching the band panel to the board', () => {
    expect(sql).not.toContain('cron.schedule(');
    expect(sql).not.toMatch(/update public.scene_reward_/i);
    expect(sql).not.toContain('scene_grant_earned_xp(');
    expect(page).toContain('<SceneBandSupporters cityId={board.city_id} cadence={active} refresh={refresh} />');
  });
});
