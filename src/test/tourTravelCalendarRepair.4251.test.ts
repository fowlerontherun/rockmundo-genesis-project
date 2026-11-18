import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261118073027_reconcile_tour_history_calendar_mirrors.sql', 'utf8');
const worker = readFileSync('supabase/functions/process-tour-travel/index.ts', 'utf8');
const rejoin = readFileSync('supabase/migrations/20261019084000_atomic_tour_rejoin_without_teleport.sql', 'utf8');

describe('tour history/calendar recovery (#4251)', () => {
  it('repairs an existing history row regardless of whether the original INSERT is replayed', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.reconcile_tour_travel_calendar');
    expect(migration).toContain('FROM public.player_travel_history h');
    expect(migration).toContain('NOT EXISTS (');
    expect(migration).toContain("a.metadata->>'travel_history_id' = h.id::text");
    expect(migration).toContain("a.metadata->>'tour_leg_id' = h.tour_leg_id::text");
    expect(migration).toContain('ON CONFLICT DO NOTHING');
    expect(migration).toContain('FOR UPDATE OF h SKIP LOCKED');
  });

  it('preserves cancellation and account/character ownership boundaries', () => {
    expect(migration).toContain('JOIN public.profiles p ON p.id = h.profile_id AND p.user_id = h.user_id');
    expect(migration).toContain("h.status IN ('scheduled', 'in_progress', 'completed')");
    expect(migration).toContain("t.status IS DISTINCT FROM 'cancelled'");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.reconcile_tour_travel_calendar');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.reconcile_tour_travel_calendar(integer) TO service_role');
    expect(rejoin).toContain('player_scheduled_travel_profile_leg_unique');
  });

  it('runs reconciliation before arrival, and leaves history retryable after a failed profile/calendar update', () => {
    expect(worker).toContain("'reconcile_tour_travel_calendar', { p_batch_size: 100 }");
    expect(worker.indexOf('reconcile_tour_travel_calendar')).toBeLessThan(worker.indexOf(".from('player_travel_history')"));
    expect(worker.indexOf('if (scheduleError) throw scheduleError')).toBeLessThan(worker.indexOf(".update({ status: 'completed' })\n            .eq('id', travel.id)"));
    expect(worker).toContain('if (profileError) throw profileError');
    expect(worker).toContain('if (historyError) throw historyError');
  });
});
