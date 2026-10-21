import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sql = filename => readFileSync(fileURLToPath(
  new URL('../supabase/migrations/' + filename, import.meta.url),
), 'utf8');
const original = sql('20251007205818_add_city_night_clubs.sql');
const later = sql('20251008060518_dd3638c4-6667-4843-be19-34c88bd10745.sql');

describe('consecutive October 2025 nightclub migrations replay safely', () => {
  it('retains the existing club table rather than replacing records', () => {
    assert.match(original, /CREATE TABLE IF NOT EXISTS public\.city_night_clubs/);
    assert.match(later, /CREATE TABLE IF NOT EXISTS public\.city_night_clubs/);
    assert.doesNotMatch(later, /(?:DROP TABLE|TRUNCATE TABLE|DELETE FROM public\.city_night_clubs)/i);
  });

  it('replaces repeated RLS policies and the update trigger on clean replay', () => {
    for (const policy of ['Night clubs are viewable by everyone', 'Admins can manage night clubs']) {
      assert.match(later, new RegExp('DROP POLICY IF EXISTS "' + policy + '" ON public\\.city_night_clubs;[\\s\\S]*?CREATE POLICY "' + policy + '"'));
    }
    assert.match(original, /CREATE TRIGGER update_city_night_clubs_updated_at/);
    assert.match(later, /DROP TRIGGER IF EXISTS update_city_night_clubs_updated_at ON public\.city_night_clubs;\s*CREATE TRIGGER update_city_night_clubs_updated_at/i);
    assert.match(later, /ALTER TABLE public\.city_night_clubs ENABLE ROW LEVEL SECURITY/i);
    // Never drop or replace the September/October 7 privileged-role manager policy.
    assert.doesNotMatch(later, /DROP POLICY .*"Privileged roles manage night clubs"/i);
  });

  it('preserves the original London club seed and prices', () => {
    for (const name of ['The Electric Basement', 'Neon Dreams', 'The Velvet Room'])
      assert.ok(later.includes(name), 'missing historical seed: ' + name);
    assert.match(later, /ON CONFLICT DO NOTHING/g);
  });
});
