import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = name =>
  readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

const mentorTable = migration('20250921113440_create_education_mentors_table.sql');
const januaryOverhaul = migration('20260129091720_4ae7982a-a3d5-49d0-ad0a-68820ab41cef.sql');
const march = migration('20260308133646_d51526b9-536b-4b2c-a99e-0ac48012d7d7.sql');

const extract = (source, pattern, label) => {
  const fragment = source.match(pattern)?.[0];
  assert.ok(fragment, `Could not find historical ${label}`);
  return fragment;
};

test('March fashion seeds replay against the original mentor constraints', async () => {
  const createMentors = extract(
    mentorTable,
    /CREATE TABLE IF NOT EXISTS public\.education_mentors\s*\([\s\S]*?\n\);/,
    'September mentor table',
  );
  const cityColumns = extract(
    januaryOverhaul,
    /ALTER TABLE education_mentors\s+[\s\S]*?;/,
    'January mentor location and lore columns',
  );
  const seededMentors = extract(
    march,
    /INSERT INTO public\.education_mentors\s*\([\s\S]*?\n\);/,
    'March mentor catalogue',
  );
  assert.equal((seededMentors.match(/^\('/gm) || []).length, 8,
    'Keep all eight historical fashion/modeling mentors');
  assert.match(march, /CHECK \(difficulty IN \('beginner', 'intermediate', 'advanced', 'master'\)\)/);

  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.cities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE
      );
      CREATE TABLE public.universities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE
      );
      CREATE TABLE public.skill_definitions (
        slug text PRIMARY KEY, display_name text NOT NULL, description text
      );
      CREATE TABLE public.skill_books (
        skill_slug text, title text, author text, description text, price integer,
        base_reading_days integer, skill_percentage_gain numeric,
        required_skill_level integer, category text
      );
      CREATE TABLE public.university_courses (
        university_id uuid, skill_slug text, name text, description text,
        base_price integer, base_duration_days integer,
        required_skill_level integer, xp_per_day_min integer, xp_per_day_max integer
      );
    `);
    await db.exec(createMentors);
    await db.exec(cityColumns);
    await db.exec(`INSERT INTO public.cities (name) VALUES
      ('London'), ('Paris'), ('Milan'), ('Tokyo'), ('New York'),
      ('Los Angeles'), ('Seoul')`);
    await db.exec(`INSERT INTO public.universities (name) VALUES
      ('London School of Music'), ('London Conservatory of Arts'),
      ('Milan School of Music'), ('Milan Conservatory of Arts'),
      ('Seoul School of Music'), ('Seoul Conservatory of Arts')`);
    // Earlier mentors must retain their existing cooldown, grants, and level.
    await db.exec(`INSERT INTO public.education_mentors
      (name, focus_skill, description, specialty, cost, cooldown_hours,
       base_xp, difficulty, required_skill_value, skill_gain_ratio, bonus_description)
      VALUES ('Legacy mentor', 'guitar', 'Classic training', 'Guitar',
              200, 24, 100, 'beginner', 0, 1.1, 'Classic training')`);

    // The complete historical March migration must execute, not just an
    // isolated synthetic INSERT that omits the dependency and book/course seeds.
    await db.exec(march);

    const { rows: counts } = await db.query(`SELECT
      count(*)::integer AS total,
      count(*) FILTER (WHERE name <> 'Legacy mentor')::integer AS new_mentors,
      count(*) FILTER (WHERE name <> 'Legacy mentor' AND cooldown_hours = 168)::integer AS valid_cooldowns,
      count(*) FILTER (WHERE name <> 'Legacy mentor' AND bonus_description = specialty)::integer AS valid_bonuses,
      count(*) FILTER (WHERE name <> 'Legacy mentor' AND required_skill_value IN (200,500))::integer AS valid_requirements,
      count(*) FILTER (WHERE name <> 'Legacy mentor' AND city_id IS NOT NULL)::integer AS located
      FROM public.education_mentors`);
    assert.deepEqual(counts[0], {
      total: 9, new_mentors: 8, valid_cooldowns: 8,
      valid_bonuses: 8, valid_requirements: 8, located: 8,
    });

    const { rows: master } = await db.query(`SELECT difficulty, required_skill_value, cooldown_hours
      FROM public.education_mentors WHERE name = 'Naomi Fierce'`);
    assert.deepEqual(master, [{ difficulty: 'master', required_skill_value: 500, cooldown_hours: 168 }]);
    const { rows: legacy } = await db.query(`SELECT cooldown_hours, bonus_description, difficulty
      FROM public.education_mentors WHERE name = 'Legacy mentor'`);
    assert.deepEqual(legacy, [{ cooldown_hours: 24, bonus_description: 'Classic training', difficulty: 'beginner' }]);
    const { rows: books } = await db.query('SELECT count(*)::integer AS count FROM public.skill_books');
    const { rows: courses } = await db.query('SELECT count(*)::integer AS count FROM public.university_courses');
    assert.ok(books[0].count >= 15, 'Keep historical fashion/modeling books');
    assert.ok(courses[0].count >= 20, 'Keep historical fashion/modeling courses');
  } finally {
    await db.close();
  }
});
