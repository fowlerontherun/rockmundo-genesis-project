import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve(process.cwd(),
  'supabase/migrations/20261028121000_scene_late_source_replay.sql'), 'utf8');
const harness = readFileSync(resolve(process.cwd(),
  'supabase/tests/city_scene_source_replay_weekly_integration.sql'), 'utf8');

describe('City Scene seven-day source replay safety', () => {
  it('defaults off and requires both verified source and scoring controls', () => {
    expect(migration).toContain('enabled boolean not null default false');
    expect(migration).toContain('v_controls.enabled is not true');
    expect(migration).toContain('scoring_enabled is true');
    expect(migration).toContain('where action_type=v_action and enabled=true');
    expect(migration).toContain("'scene:verified_community'");
    expect(migration).not.toContain('cron.schedule(');
  });

  it('bounds each source to seven-day verified and settled event windows', () => {
    expect(migration).toContain("now()-interval '7 days'");
    expect(migration).toContain("now()-interval '15 minutes'");
    expect(migration).toContain('limit p_limit+1');
    expect(migration).toContain('scan_interval between interval');
    expect(migration).toContain("now()+v_controls.scan_interval");
    expect(migration).toContain('for update');
    expect(migration).toContain('pg_advisory_xact_lock');
  });

  it('reuses all three authoritative ingesters rather than crediting directly', () => {
    expect(migration).toContain('private.ingest_scene_verified_gig(v_evt.id)');
    expect(migration).toContain('private.ingest_scene_completed_recording(v_evt.id)');
    expect(migration).toContain('private.ingest_scene_verified_rehearsal(v_evt.id)');
    expect(migration).not.toContain('insert into public.scene_contributions');
    expect(migration).not.toContain('scene_grant_earned_xp');
    expect(migration).toContain('private.scene_replay_recent_verified_sources(p_limit)');
  });

  it('restricts replay controls and the replay entrypoint to the service role', () => {
    expect(migration).toContain('alter table public.scene_source_replay_controls enable row level security');
    expect(migration).toContain('alter table public.scene_source_replay_cursors enable row level security');
    expect(migration).toContain('revoke all on function private.scene_replay_recent_verified_sources(integer)');
    expect(migration).toContain('from public,anon,authenticated');
  });

  it('covers late arrivals after the forward cursor, cooldown and duplicate protection', () => {
    expect(harness).toContain('FORWARD_CURSOR_DID_NOT_REPRODUCE_MISSED_EVENTS');
    expect(harness).toContain('LATE_SCENE_SOURCE_REPLAY_FAILED');
    expect(harness).toContain('SECOND_SCENE_SOURCE_REPLAY_AWARDED_TWICE');
    expect(harness).toContain('SOURCE_KILL_SWITCH_NOT_APPLIED_TO_REPLAY');
    expect(harness).toContain('SCENE_REPLAY_ISSUED_REWARD');
    expect(harness).toMatch(/rollback;\s*$/);
  });
});
