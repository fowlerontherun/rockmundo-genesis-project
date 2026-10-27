import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261027070000_city_scene_challenges_foundation.sql'),
  'utf8',
);

describe('City Scene Challenges fail-closed database foundation', () => {
  it('creates every core table with RLS enabled', () => {
    for (const table of [
      'scene_challenge_templates', 'scene_challenge_cycles', 'scene_challenge_objectives',
      'scene_daily_affiliations', 'scene_contributions', 'scene_milestones', 'scene_reward_claims',
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('deduplicates an event per account and objective and binds daily city affiliation', () => {
    expect(migration).toContain('unique (objective_id, source_type, source_event_id, account_id)');
    expect(migration).toContain('primary key (account_id, date_utc)');
    expect(migration).toContain('unique (account_id, cycle_id, reward_key)');
  });

  it('never grants clients mutation privileges or installs a payout/scheduler', () => {
    expect(migration).not.toMatch(/grant\s+(?:all|insert|update|delete)\s+on[^;]*to\s+authenticated/i);
    expect(migration).not.toContain('cron.schedule(');
    expect(migration).not.toContain('create function public.scene_process_completed_action');
    expect(migration).toContain('scene_contribution_owner_read');
    expect(migration).toContain('scene_reward_owner_read');
  });
});
