import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const gate = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027163000_scene_reward_activation_approval_gate.sql'),
  'utf8',
);
const harness = readFileSync(
  resolve(process.cwd(), 'supabase/tests/city_scene_xp_grant_staging_harness.sql'),
  'utf8',
);

describe('City Scene reward operator-approval kill switch', () => {
  it('defaults to no approval and restricts writing the approval to DBA', () => {
    expect(gate).toContain('approved_until timestamptz');
    expect(gate).toContain('approved_by text');
    expect(gate).toContain('reason text');
    expect(gate).toContain('revoke all on private.scene_reward_activation_authorizations');
    expect(gate).toContain('from public,anon,authenticated,service_role');
    expect(gate).not.toContain('cron.schedule(');
  });

  it('rejects reward-policy and payout-switch activation until explicitly approved', () => {
    expect(gate).toContain('scene_reward_policy_activation_guard');
    expect(gate).toContain('scene_reward_payout_activation_guard');
    expect(gate).toContain('SCENE_XP_OPERATOR_APPROVAL_REQUIRED');
    expect(gate).toContain('clock_timestamp()');
    expect(gate).toContain('new.enabled is true');
    expect(gate).toContain('new.payouts_enabled is true');
  });

  it('blocks actual XP issuance once an approval expires, independently of payout flags', () => {
    expect(gate).toContain('create or replace function private.grant_scene_earned_xp');
    expect(gate).toContain('approved_until > clock_timestamp()');
    expect(gate).toContain("'approval_required',true");
    expect(gate).toContain('insert into public.scene_reward_grant_receipts');
    expect(gate).toContain('update public.player_xp_wallet');
    expect(gate).toContain('to service_role');
  });

  it('tests rejected activation, expired operator approval and exactly-once grants in rollback-only staging', () => {
    expect(harness).toContain('UNAPPROVED_REWARD_POLICY_ACTIVATED');
    expect(harness).toContain('UNAPPROVED_XP_PAYOUT_ACTIVATED');
    expect(harness).toContain('EXPIRED_SCENE_XP_APPROVAL_DID_NOT_BLOCK_GRANT');
    expect(harness).toContain('DUPLICATE_XP_GRANT');
    expect(harness).toMatch(/rollback;\s*$/);
  });
});
