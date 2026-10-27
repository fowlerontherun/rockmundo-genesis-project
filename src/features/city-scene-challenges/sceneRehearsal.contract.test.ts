import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const migration = readFileSync(
  resolve(process.cwd(),'supabase/migrations/20261027144500_scene_verified_rehearsal_source.sql'), 'utf8'
);
const processor = readFileSync(
  resolve(process.cwd(),'supabase/functions/scene-challenges-processor/index.ts'), 'utf8'
);

describe('City scene verified rehearsals as replacement for unverified jam goals', () => {
  it('only changes disabled templates and never enables an award', () => {
    expect(migration).toContain("where slug='daily-band-meeting' and enabled=false");
    expect(migration).toContain("where slug='weekly-open-jam' and enabled=false");
    expect(migration).toContain("'rehearsal:completed'");
    expect(migration).not.toContain('cron.schedule(');
    expect(migration).not.toMatch(/\bupdate\s+public\.scene_reward_payout_controls\b/i);
  });
  it('needs actual completed XP-bearing rehearsal evidence, not invitation status', () => {
    expect(migration).toContain("r.status='completed'");
    expect(migration).toContain('r.completed_at >= r.scheduled_end');
    expect(migration).toContain('r.xp_earned > 0');
    expect(migration).toContain('bm.profile_id=r.payment_profile_id');
    expect(migration).toContain('p.is_active is true and p.deleted_at is null');
    expect(migration).not.toMatch(/\bjoin\s+public\.band_rehearsal_participants\b/i);
  });
  it('caps per-account per-cycle and protects cross-city scoring', () => {
    expect(migration).toContain("'rockmundo:scene:acct:'");
    expect(migration).toContain("'rockmundo:scene:cycle:'");
    expect(migration).toContain('scene_daily_affiliations');
    expect(migration).toContain("when 'daily' then 5 when 'weekly' then 10 else 25");
    expect(migration).toContain('on conflict(objective_id,source_type,source_event_id,account_id)');
  });
  it('uses server-only ordered cursor and read-only dry-run preview', () => {
    expect(migration).toContain('for update;');
    expect(migration).toContain("now()-interval '15 minutes'");
    expect(migration).toContain('order by r.completed_at,r.id limit p_limit');
    expect(migration).toContain('to service_role');
    expect(migration).toContain('from public,anon,authenticated');
    expect(processor).toContain("rpc('scene_preview_verified_rehearsal_batch'");
    expect(processor).toContain("rpc('scene_process_verified_rehearsal_batch'");
  });
});
