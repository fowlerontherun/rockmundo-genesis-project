import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const payoutSql = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027131500_scene_reward_payout_revalidation.sql'),
  'utf8',
);
const harnessSql = readFileSync(
  resolve(process.cwd(), 'supabase/tests/city_scene_xp_grant_staging_harness.sql'),
  'utf8',
);

describe('City Scene XP payout source revocation gates', () => {
  it('rechecks personal and capped city contribution totals before awarding XP', () => {
    expect(payoutSql).toContain('sc.invalidated_at is null');
    expect(payoutSql).toContain('obj.cycle_id=c.cycle_id');
    expect(payoutSql).toContain('sc.account_id=c.account_id');
    expect(payoutSql).toContain('>= policy.min_personal_points');
    expect(payoutSql).toContain('private.scene_capped_cycle_points(c.cycle_id) >= cyc.target_total');
    expect(payoutSql).toContain("cyc.status in ('expired','completed')");
    expect(payoutSql).toContain('c.entitled_at = cyc.ends_at');
  });

  it('preserves the exact-once wallet, ledger, receipt and claim transaction', () => {
    expect(payoutSql).toContain('for update of c skip locked');
    expect(payoutSql).toContain('insert into public.experience_ledger');
    expect(payoutSql).toContain('insert into public.scene_reward_grant_receipts');
    expect(payoutSql).toContain('update public.player_xp_wallet');
    expect(payoutSql).toContain("set status='granted',claimed_at=now()");
    expect(payoutSql).not.toContain('cron.schedule(');
    expect(payoutSql).not.toContain('payouts_enabled=true');
  });

  it('tests revoked pending claims and runs inside a rollback-only staging transaction', () => {
    expect(harnessSql).toContain('begin;');
    expect(harnessSql).toMatch(/rollback;\s*$/);
    expect(harnessSql).toContain('set invalidated_at=now()');
    expect(harnessSql).toContain('REVOKED_CONTRIBUTION_PAID_XP');
    expect(harnessSql).toContain('set invalidated_at=null');
    expect(harnessSql).toContain('DUPLICATE_XP_GRANT');
  });
});
