import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = name =>
  readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

const tableSource = migration('20250921113440_create_education_mentors_table.sql');
const overhaul = migration('20260129091720_4ae7982a-a3d5-49d0-ad0a-68820ab41cef.sql');
const febSeed = migration('20260216103554_cd91b281-6a49-45d7-9052-8f589da8234a.sql');

function extract(source, pattern, label) {
  const result = source.match(pattern)?.[0];
  assert.ok(result, `Cannot find historical ${label} SQL`);
  return result;
}

test('February mentor catalogue provides all required September fields after January mastery changes', async () => {
  const createTable = extract(
    tableSource,
    /CREATE TABLE IF NOT EXISTS public\.education_mentors\s*\([\s\S]*?\n\);/,
    'mentor table definition',
  );
  const alterTable = extract(
    overhaul,
    /ALTER TABLE education_mentors\s+[\s\S]*?;/,
    'legendary masters columns',
  );
  const mentorSeed = febSeed.slice(0, febSeed.indexOf('-- PART 2: ADD MORE INSTRUMENT UNIVERSITY COURSES'));
  const guard = mentorSeed.slice(0, mentorSeed.indexOf('-- CORE SKILLS'));
  const cities = [...new Set([...guard.matchAll(/\('([^']+)'\)/g)].map(m => m[1]))];
  const expectedCount = (mentorSeed.match(/^\('/gm) || []).length;
  assert.ok(cities.length >= 30, 'Keep the seed city dependency guard');
  assert.ok(expectedCount >= 50, 'Preserve the full February mentor catalogue');
  assert.match(mentorSeed, /0, seed\.skill_gain_ratio, seed\.specialty,/);

  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.cities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE
      );
    `);
    await db.exec(createTable);
    await db.exec(alterTable);
    // Earlier October mentor-discovery migrations introduce this column.
    await db.exec('ALTER TABLE public.education_mentors ADD COLUMN discovery_type text');
    await db.exec(`INSERT INTO public.cities (name) VALUES
      ${cities.map(name => `('${name.replaceAll("'", "''")}')`).join(',\n')}`);
    await db.exec(mentorSeed);

    const { rows: counts } = await db.query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE required_skill_value <> 0)::int AS gated,
      count(*) FILTER (WHERE bonus_description IS DISTINCT FROM specialty)::int AS missing_bonus,
      count(*) FILTER (WHERE city_id IS NULL)::int AS missing_city
      FROM public.education_mentors`);
    assert.deepEqual(counts[0], {
      total: expectedCount,
      gated: 0,
      missing_bonus: 0,
      missing_city: 0,
    });

    const { rows: examples } = await db.query(`SELECT name, required_skill_value,
      bonus_description, specialty, discovery_type
      FROM public.education_mentors
      WHERE name IN ('Vocal Queen Amara', 'Pro AI Music Researcher')
      ORDER BY name`);
    assert.equal(examples.length, 2);
    for (const row of examples) {
      assert.equal(row.required_skill_value, 0);
      assert.equal(row.bonus_description, row.specialty);
      assert.equal(row.discovery_type, 'exploration');
    }
  } finally {
    await db.close();
  }
});
