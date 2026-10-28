import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(),
  'supabase/migrations/20261028125200_scene_band_consent_leadership_revocation.sql'), 'utf8');
const integration = readFileSync(resolve(process.cwd(),
  'supabase/tests/city_scene_band_supporters_integration.sql'), 'utf8');

describe('City Scene band consent follows the current leader', () => {
  it('revokes stale approval atomically on any authorised leader change', () => {
    expect(sql).toContain('after update of leader_id on public.bands');
    expect(sql).toContain('new.leader_id is distinct from old.leader_id');
    expect(sql).toContain('set enabled = false');
    expect(sql).toContain('updated_by_account = null');
    expect(sql).toContain('where band_id = new.id and enabled is true');
  });

  it('cleans up old approvals that cannot be attributed to the current leader', () => {
    expect(sql).toContain('and leader.user_id = opt.updated_by_account');
    expect(sql).toContain('and not exists (');
  });

  it('never exposes a browser scoring or consent mutation API', () => {
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).not.toMatch(/grant execute on function public\./i);
    expect(sql).not.toMatch(/update public\.scene_(?:contributions|reward_claims|reward_payout_controls)/i);
  });

  it('proves ranking is hidden immediately after a transfer without user interaction', () => {
    expect(integration).toContain('Former leader consent survived transfer');
    expect(integration).toContain('Band consent not revoked transactionally');
  });
});
