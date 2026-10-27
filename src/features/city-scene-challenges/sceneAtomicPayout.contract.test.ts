import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const payout = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027130000_scene_atomic_xp_reward_grants.sql'),
  'utf8',
);
const history = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027130500_scene_private_reward_history.sql'),
  'utf8',
);
const board = readFileSync(
  resolve(process.cwd(), 'src/pages/CitySceneChallenges.tsx'),
  'utf8',
);

describe('City Scene XP grant safety', () => {
  it('installs a separate disabled-by-default payout switch', () => {
    expect(payout).toContain('payouts_enabled boolean not null default false');
    expect(payout).toContain('values(true,false)');
    expect(payout).toContain('payouts_enabled is true');
    expect(payout).toContain("'disabled',true,'xp_granted',0");
    expect(payout).not.toContain('cron.schedule(');
  });

  it('idempotently couples the wallet, experience ledger and grant receipt', () => {
    expect(payout).toContain('claim_id uuid primary key references public.scene_reward_claims(id)');
    expect(payout).toContain('ledger_id uuid not null unique references public.experience_ledger(id)');
    expect(payout).toContain('for update of c skip locked');
    expect(payout).toMatch(/limit p_limit\s+for update of c skip locked/);
    expect(payout).toContain('insert into public.player_xp_wallet(profile_id)');
    expect(payout).toContain('update public.player_xp_wallet');
    expect(payout).toContain('skill_xp_lifetime = coalesce(skill_xp_lifetime,0) + v_claim.reward_amount');
    expect(payout).toContain('insert into public.experience_ledger');
    expect(payout).toContain("'city_scene_reward'");
    expect(payout).toContain('insert into public.scene_reward_grant_receipts');
    expect(payout).toContain("set status='granted',claimed_at=now(),grant_reference=v_ledger_id::text");
  });

  it('requires verified profile ownership, enabled matching policy and unexpired cycle', () => {
    expect(payout).toContain('p.user_id = v_claim.account_id');
    expect(payout).toContain('p.deleted_at is null and p.is_active is true');
    expect(payout).toContain('policy.reward_amount = c.reward_amount');
    expect(payout).toContain('policy.enabled is true');
    expect(payout).toContain('c.status = \'pending\'');
    expect(payout).toContain('c.expires_at > now()');
    expect(payout).toContain("cyc.ends_at > now() - interval '7 days'");
    expect(payout).toContain("set status = 'expired'");
    expect(payout).toContain("earned.ends_at + interval '7 days'");
  });

  it('restricts writes to the service role and leaves browsers read-only', () => {
    expect(payout).toContain('alter table public.scene_reward_grant_receipts enable row level security');
    expect(payout).toContain('alter table public.scene_reward_payout_controls enable row level security');
    expect(payout).toContain('revoke all on function public.scene_grant_earned_xp(integer)');
    expect(payout).toContain('from public,anon,authenticated');
    expect(payout).toContain('grant execute on function public.scene_grant_earned_xp(integer)');
    expect(payout).toContain('to service_role');
    expect(payout).not.toContain('grant execute on function public.scene_grant_earned_xp(integer) to authenticated');
  });

  it('shows owner-only earned XP and grant status, not wallet action controls', () => {
    expect(history).toContain('security invoker');
    expect(history).toContain('c.account_id = (select auth.uid())');
    expect(history).toContain('revoke all on function public.get_my_scene_reward_history(uuid,integer)');
    expect(board).toContain("rpc('get_my_scene_reward_history'");
    expect(board).toContain('Awaiting processing');
    expect(board).toContain('Awarded');
    expect(board).not.toContain("rpc('scene_grant_earned_xp'");
  });
});
