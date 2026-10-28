import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(
  process.cwd(), 'supabase/migrations/20261028125435_scene_pulse_verified_source_codes.sql',
), 'utf8');
const pulse = readFileSync(resolve(
  process.cwd(), 'src/features/city-scene-challenges/ScenePulse.tsx',
), 'utf8');

describe('Scene Pulse: canonical verified ledger to display categories', () => {
  const mappings = [
    ['verified_gig_performance', 'gig:verified_performance'],
    ['completed_recording', 'recording:completed'],
    ['verified_rehearsal', 'rehearsal:completed'],
    ['completed_verified_jam', 'jam:verified_collaboration'],
  ] as const;

  it('matches actual ledger source codes while emitting supported display labels', () => {
    for (const [source, display] of mappings) {
      expect(migration).toContain(`when '${source}' then '${display}'`);
      expect(migration).toContain(`'${source}'`);
      expect(pulse).toContain(`'${display}'`);
    }
    expect(migration).toContain('end as action_type');
    expect(migration).not.toContain('sc.source_type as action_type,');
  });

  it('never leaks sparse groups or raw source events', () => {
    expect(migration).toContain('having count(distinct sc.account_id) >= 3');
    expect(migration).toContain('count(distinct (sc.source_type, sc.source_event_id, sc.account_id))');
    expect(migration).toContain('sc.invalidated_at is null');
    expect(migration).toContain('sc.source_completed_at >= cycle.starts_at');
    expect(migration).toContain('sc.source_completed_at < cycle.ends_at');
    expect(migration).toContain('milestone.revoked_at is null');
    const payload = migration.split("jsonb_build_object(\n        'day_utc'")[1]?.split(')\n      order by')[0] ?? '';
    expect(payload).toContain("'action_type'");
    expect(payload).not.toContain("'account_id'");
    expect(payload).not.toContain("'source_event_id'");
    expect(payload).not.toContain("'profile_id'");
    expect(payload).not.toContain("'source_completed_at'");
  });

  it('keeps authenticated-only read permissions and XP payouts untouched', () => {
    expect(migration).toContain("if (select auth.uid()) is null");
    expect(migration).toContain('p_limit > 20');
    expect(migration).toContain('from public, anon;');
    expect(migration).not.toContain('cron.schedule');
    expect(migration).not.toMatch(/update public.scene_reward_/i);
    expect(migration).not.toContain('grant_scene_earned_xp');
  });
});
