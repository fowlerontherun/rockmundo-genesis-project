import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261030101132_scene_november_city_readiness.sql'),
  'utf8',
);

describe('November City Scene operator-only city eligibility snapshot', () => {
  it('keeps read access service-only and does not create a browser RPC', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION private.scene_november_city_readiness()');
    expect(migration.toLowerCase()).toContain('language sql');
    expect(migration).not.toMatch(/security\s+definer/i);
    expect(migration).toContain('revoke all on function private.scene_november_city_readiness() from public, anon, authenticated;');
    expect(migration).toContain('grant execute on function private.scene_november_city_readiness() to service_role;');
    expect(migration).not.toContain('grant execute on function private.scene_november_city_readiness() to authenticated');
  });

  it('mirrors the 14-day eligibility rule and November target formula', () => {
    for (const check of [
      'count(distinct p.user_id)',
      'p.user_id is not null',
      'p.is_active is true',
      'p.deleted_at is null',
      "p.last_login_at >= now() - interval '14 days'",
      'p.last_login_at <= now()',
      "cc.cadence = 'monthly'",
      "cc.starts_at = timestamptz '2026-11-01 00:00:00+00'",
      'ceil(e.accounts::numeric / 4)',
      "now() >= timestamptz '2026-11-02 00:00:00+00'",
    ]) expect(migration).toContain(check);
  });

  it('handles partial launches and invalid monthly cycle objective counts', () => {
    expect(migration).toContain('select id from eligible union select id from created');
    expect(migration).toContain('count(distinct cc.id)');
    expect(migration).toContain('count(ob.id)');
    for (const state of ['duplicate_cycles', 'bad_objective_count', 'created', 'missing_after_grace', 'awaiting_worker']) {
      expect(migration).toContain(state);
    }
  });

  it('is a strictly read-only function without player-level output', () => {
    const body = migration.split('AS $function$')[1]?.split('$function$')[0];
    expect(body).toBeTruthy();
    expect(body).not.toMatch(/\b(insert|update|delete|drop|alter|truncate|grant|revoke)\b/i);
    expect(migration).toContain('RETURNS TABLE(');
    expect(migration).not.toContain('source_event_id');
    expect(migration).not.toContain('avatar_url');
  });
});
