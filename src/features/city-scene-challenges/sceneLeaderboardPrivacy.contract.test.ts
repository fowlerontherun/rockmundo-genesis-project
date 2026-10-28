import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261028074234_scene_opt_in_leaderboard.sql'), 'utf8',
);
const page = readFileSync(resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'), 'utf8');

describe('City Scene supporter leaderboard SQL safety', () => {
  it('is default-off with no direct browser table read or mutation', () => {
    expect(sql).toContain('enabled boolean not null default false');
    expect(sql).toContain('alter table public.scene_leaderboard_opt_ins enable row level security');
    expect(sql).toContain('revoke all on public.scene_leaderboard_opt_ins from public,anon,authenticated');
    expect(sql).not.toContain('create policy');
  });

  it('requires authenticated self-owned consent and verified profile eligibility', () => {
    expect(sql).toContain('v_account uuid := (select auth.uid())');
    expect(sql).toContain("raise exception 'AUTH_REQUIRED'");
    expect(sql).toContain('sc.account_id=v_account');
    expect(sql).toContain('sc.invalidated_at is null');
    expect(sql).toContain('p.user_id=v_account');
    expect(sql).toContain("privacy.profile_visibility='public'");
    expect(sql).toContain("privacy.activity_visibility='public'");
    expect(sql).toContain("raise exception 'SCENE_PUBLIC_PROFILE_REQUIRED'");
    expect(sql).toContain('where account_id=v_account and city_id=p_city_id');
  });

  it('renders ranks only for opted-in accounts allowed by privacy and social safety rules', () => {
    expect(sql).toContain('opt.enabled is true');
    expect(sql).toContain('sc.invalidated_at is null');
    expect(sql).toContain("privacy.profile_visibility='public'");
    expect(sql).toContain("privacy.activity_visibility='public'");
    expect(sql).toContain('public.player_blocks');
    expect(sql).toContain('public.profile_mutes');
    expect(sql).toContain('viewer_profile.user_id=v_viewer');
    expect(sql).toContain('row_number() over');
    expect(sql).toContain('eligible.account_id asc');
    expect(sql).toContain('where rank <= p_limit');
    expect(sql).toContain('p_limit > 20');
  });

  it('never returns identity keys or private contributions and never awards rewards', () => {
    const payload = sql.split("jsonb_build_object('rank'")[1]?.split(')\n      order by')[0] ?? '';
    expect(payload).toContain("'display_name'");
    expect(payload).toContain("'points'");
    expect(payload).not.toContain("'account_id'");
    expect(payload).not.toContain("'profile_id'");
    expect(payload).not.toContain("'source_event_id'");
    expect(sql).not.toContain('cron.schedule(');
    expect(sql).not.toContain('scene_grant_earned_xp(');
    expect(sql).not.toMatch(/update public.scene_reward_/i);
    expect(page).toContain('<SceneLeaderboard cityId={board.city_id} cadence={active} refresh={refresh} />');
  });
});
