import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const earlier = readFileSync(fileURLToPath(new URL('../supabase/migrations/20250923223323_create_songwriting_tables.sql', import.meta.url)), 'utf8');
const enhanced = readFileSync(fileURLToPath(new URL('../supabase/migrations/20250929081356_d2ccfe3a-df45-4a51-b0cf-deb31430cccd.sql', import.meta.url)), 'utf8');

describe('legacy 2025 songwriting feature enhancement is compatible with existing tables', () => {
  it('starts from an earlier schema with existing projects and sessions', () => {
    assert.match(earlier, /CREATE TABLE IF NOT EXISTS public\.songwriting_projects/i);
    assert.match(earlier, /CREATE TABLE IF NOT EXISTS public\.songwriting_sessions/i);
    assert.match(earlier, /started_at TIMESTAMPTZ NOT NULL/i);
    assert.match(earlier, /sessions_completed INTEGER/i);
  });

  it('does not attempt duplicate unconditional table creation', () => {
    for (const name of ['song_themes', 'chord_progressions', 'songwriting_projects', 'songwriting_sessions']) {
      assert.match(enhanced, new RegExp('CREATE TABLE IF NOT EXISTS public\\.' + name + '\\s*\\(', 'i'));
      assert.doesNotMatch(enhanced, new RegExp('CREATE TABLE public\\.' + name + '\\s*\\(', 'i'));
    }
  });

  it('adds all the enhanced fields needed by following migration without dropping existing data', () => {
    const expectedProjects = ['theme_id', 'chord_progression_id', 'initial_lyrics', 'music_progress',
      'lyrics_progress', 'total_sessions', 'estimated_sessions', 'quality_score', 'is_locked'];
    const expectedSessions = ['session_start', 'session_end', 'music_progress_gained',
      'lyrics_progress_gained', 'xp_earned'];
    for (const col of [...expectedProjects, ...expectedSessions])
      assert.match(enhanced, new RegExp('ADD COLUMN IF NOT EXISTS ' + col + '\\s', 'i'));
    assert.doesNotMatch(enhanced, /(?:DROP TABLE|TRUNCATE TABLE|DELETE FROM public\.songwriting_)/i);
  });

  it('uses PostgreSQL-compatible guard for an existing session estimate constraint', () => {
    const refine = readFileSync(fileURLToPath(new URL('../supabase/migrations/20250929104000_refine_songwriting_schema.sql', import.meta.url)), 'utf8');
    // SQL comments may explain unsupported syntax; only actual statements matter.
    const executableSql = refine.replace(/--[^\r\n]*/g, '');
    assert.doesNotMatch(executableSql, /ADD CONSTRAINT IF NOT EXISTS/i);
    assert.match(refine, /FROM pg_constraint/);
    assert.match(refine, /conrelid = 'public\.songwriting_projects'::regclass/);
    assert.match(refine, /ADD CONSTRAINT songwriting_projects_estimated_completion_sessions_check/);
  });

  it('preserves actual historic session starts instead of backfilling now()', () => {
    assert.match(enhanced, /SET session_start = started_at\s+WHERE session_start IS NULL AND started_at IS NOT NULL/i);
    assert.ok(enhanced.indexOf('ALTER TABLE public.songwriting_sessions\n ADD COLUMN IF NOT EXISTS session_start')
      < enhanced.indexOf('SET session_start = started_at'));
  });
});
