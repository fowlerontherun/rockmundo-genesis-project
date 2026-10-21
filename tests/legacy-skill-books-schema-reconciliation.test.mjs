import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sql = name => readFileSync(fileURLToPath(
  new URL('../supabase/migrations/' + name, import.meta.url),
), 'utf8');
const septemberFirst = sql('20250919100056_create_skill_books_tables.sql');
const septemberSecond = sql('20250919101204_create_skill_books_tables.sql');
const october = sql('20251007092021_af351c25-5b45-448f-8a6a-382c323688fa.sql');

describe('2025 book schema continuity during clean Supabase replay', () => {
  it('recognises that September already created book and ownership tables', () => {
    assert.match(septemberFirst, /CREATE TABLE IF NOT EXISTS public\.skill_books\s*\(/i);
    assert.match(septemberFirst, /cost numeric\(12, 2\) NOT NULL DEFAULT 0/i);
    assert.match(septemberFirst, /CREATE TABLE IF NOT EXISTS public\.player_skill_books\s*\(/i);
    assert.match(septemberSecond, /ADD COLUMN IF NOT EXISTS slug text/i);
    assert.match(october, /CREATE TABLE IF NOT EXISTS public\.skill_books\s*\(/i);
    assert.doesNotMatch(october, /CREATE TABLE public\.skill_books\s*\(/i);
  });

  it('reconciles missing October fields *before* books are seeded', () => {
    const alter = october.indexOf('ALTER TABLE public.skill_books\n  ADD COLUMN IF NOT EXISTS price');
    const backfill = october.indexOf('SET price = cost::INTEGER');
    const required = october.indexOf('ALTER TABLE public.skill_books ALTER COLUMN price SET NOT NULL');
    const seed = october.indexOf('INSERT INTO public.skill_books');
    assert.ok(alter > -1 && alter < backfill && backfill < required && required < seed);
    for (const column of ['price', 'base_reading_days', 'skill_percentage_gain',
      'required_skill_level', 'daily_reading_time', 'reading_hour', 'category']) {
      assert.match(october, new RegExp('ADD COLUMN IF NOT EXISTS ' + column + '\\s', 'i'));
    }
    assert.match(october, /UPDATE public\.skill_books\s+SET price = cost::INTEGER\s+WHERE price IS NULL/i);
  });

  it('preserves original September prices and seeds both book price models consistently', () => {
    const insert = october.slice(october.indexOf('INSERT INTO public.skill_books'));
    assert.match(insert, /price, cost, base_reading_days, category\) VALUES/);
    const rows = insert.trim().split('\n').filter(row => /^\s*\('[a-z_]+',/.test(row));
    assert.equal(rows.length, 9);
    for (const row of rows) {
      const match = row.match(/, (\d+), (\d+), [234], '(?:Foundational Musicianship|Songwriting & Creativity|Music Business & Branding)'\)[,;]/);
      assert.ok(match, 'expected both price and cost in ' + row);
      assert.equal(match[1], match[2], 'must not seed a different/free legacy price');
    }
    assert.doesNotMatch(october, /(?:DROP TABLE|TRUNCATE TABLE|DELETE FROM public\.skill_books|DROP COLUMN)/i);
  });

  it('replaces the older updated_at trigger instead of doubling its effects', () => {
    const drop = october.indexOf('DROP TRIGGER IF EXISTS set_skill_books_updated_at');
    const create = october.indexOf('CREATE TRIGGER update_skill_books_updated_at');
    assert.ok(drop > 0 && drop < create);
    assert.match(october, /ALTER TABLE public\.skill_books ENABLE ROW LEVEL SECURITY/i);
  });
});
