import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(),
  'supabase/migrations/20261027170000_scene_source_integrity_preview.sql'),'utf8');
const harness = readFileSync(resolve(process.cwd(),
  'supabase/tests/city_scene_source_integrity_integration.sql'),'utf8');

describe('City Scene non-mutating source integrity diagnostics', () => {
  it('uses a strict service-only read-only provenance query', () => {
    expect(migration).toContain('stable');
    expect(migration).toContain('security definer');
    expect(migration).toContain('revoke all on function private.scene_source_integrity_preview(integer)');
    expect(migration).toContain('from public,anon,authenticated');
    expect(migration).toContain('to service_role');
    expect(migration).toContain("p_limit<1 or p_limit>500");
    expect(migration).not.toMatch(/\bupdate\s+public\.scene_contributions\b/i);
    expect(migration).not.toContain('cron.schedule(');
  });
  it('revalidates canonical evidence for all three deployed sources', () => {
    expect(migration).toContain("'verified_gig_performance'");
    expect(migration).toContain("'completed_recording'");
    expect(migration).toContain("'verified_rehearsal'");
    expect(migration).toContain("g.cancelled_at is null");
    expect(migration).toContain("gp.lineup_status='performed'");
    expect(migration).toContain("s.xp_awards<>'{}'::jsonb");
    expect(migration).toContain('r.xp_earned>0');
    expect(migration).toContain("sc.invalidated_at is null");
  });
  it('tests cancellation and XP corrections without deleting score history', () => {
    expect(harness).toContain('VALID_COMPLETIONS_FALSE_POSITIVE');
    expect(harness).toContain('CORRECTED_SOURCE_NOT_FLAGGED');
    expect(harness).toContain('READ_ONLY_PREVIEW_MUTATED_PLAYER_POINTS');
    expect(harness).toContain('RESTORED_SOURCES_REMAIN_FLAGGED');
    expect(harness).toMatch(/rollback;\s*$/);
  });
});
