import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/20261016205500_halloween_2026_reward_publication_interlock.sql');
const original = read('supabase/migrations/20261016103000_halloween_2026_gig_rewards.sql');
const deferred = read('supabase/migrations/20261016130000_halloween_2026_deferred_outcome_reward_reconciliation.sql');
const sqlGate = read('.github/workflows/halloween-2026-sql.yml');

function definition(source: string, name: string) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `missing SQL function ${name}`).toBeGreaterThan(-1);
  const end = source.indexOf('$$;', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 3);
}

describe('Halloween rewards never launch with an unpublished Pumpkin Hat', () => {
  it('fails closed at all three server payout authorities', () => {
    for (const name of [
      'capture_halloween_2026_gig_outfits',
      'get_halloween_2026_gig_bonus',
      'reconcile_halloween_2026_first_rewards',
    ]) {
      const fn = definition(migration, name);
      expect(fn).toContain("coalesce(v_settings->>'enabled','false') <> 'true'");
      expect(fn).toContain("coalesce(v_settings->>'rewards_live','false') <> 'true'");
      expect(fn).toContain('OR NOT public.halloween_2026_hat_is_published()');
      expect(fn).not.toContain('UPDATE public.avatar_clothing_items');
    }
    const publication = definition(migration, 'halloween_2026_hat_is_published');
    expect(publication).toContain("curated_asset_key='clothing.halloween.2026.pumpkin-hat'");
    expect(publication).toContain("curated_asset_status='published'");
    expect(publication).not.toContain('validation_notes=');
  });

  it('changes only the event gates, not existing roll, snapshot, or XP logic', () => {
    for (const name of [
      'capture_halloween_2026_gig_outfits',
      'get_halloween_2026_gig_bonus',
    ]) {
      const oldFn = definition(original, name);
      const newFn = definition(migration, name);
      expect(newFn.replace(/\s+OR NOT public\.halloween_2026_hat_is_published\(\)/, '')).toBe(oldFn);
    }
    const name = 'reconcile_halloween_2026_first_rewards';
    expect(definition(migration, name)
      .replace(/\s+OR NOT public\.halloween_2026_hat_is_published\(\)/, ''))
      .toBe(definition(deferred, name));
    expect(migration).not.toContain('DROP TABLE');
    expect(migration).not.toContain('DELETE FROM');
  });

  it('has a real PostgreSQL publication toggle and exactly-once payout regression gate', () => {
    const test = read('supabase/tests/halloween_2026_reward_publication_interlock.sql');
    expect(test).toContain("curated_asset_status='asset_ready'");
    expect(test).toContain("curated_asset_status='published'");
    expect(test).toContain('get_halloween_2026_gig_bonus');
    expect(test).toContain('reconcile_halloween_2026_first_rewards');
    expect(test).toContain('ROLLBACK;');
    expect(sqlGate).toContain('20261016205500_halloween_2026_reward_publication_interlock.sql');
    expect(sqlGate).toContain('halloween_2026_reward_publication_interlock.sql');
  });
});
