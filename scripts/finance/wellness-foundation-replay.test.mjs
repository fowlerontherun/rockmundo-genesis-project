import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const source = readFileSync(new URL(
  '../../supabase/migrations/20260712120000_expand_wellness_foundation.sql',
  import.meta.url,
), 'utf8');

const addProfileWellness = source.match(/alter table public\.profiles\s+[\s\S]*?;/i)?.[0];
const seedProfileWellness = source.match(/update public\.profiles\s+set physical_health[\s\S]*?;/i)?.[0];
assert.ok(addProfileWellness, 'Use the real historical profile wellness ALTER TABLE');
assert.ok(seedProfileWellness, 'Use the real historical wellness backfill');

const setup = async (schema) => {
  const db = new PGlite();
  await db.exec(schema);
  return db;
};

test('wellness bootstrap replays without legacy mood or stress columns', async () => {
  const db = await setup(`
    CREATE TABLE public.profiles (
      id integer PRIMARY KEY,
      health integer NOT NULL DEFAULT 100
    );
    INSERT INTO public.profiles(id,health) VALUES (1,88);
  `);
  try {
    await db.exec(addProfileWellness);
    await db.exec(seedProfileWellness);
    const { rows } = await db.query(`
      SELECT mood,stress,physical_health,happiness,burnout_risk
      FROM public.profiles WHERE id=1
    `);
    assert.deepEqual(rows, [{
      mood:70,stress:30,physical_health:88,happiness:70,burnout_risk:14,
    }]);
    // A second clean bootstrap must not change the player state, and the
    // IF NOT EXISTS replay must remain safe when the columns already exist.
    await db.exec(addProfileWellness);
    await db.exec(seedProfileWellness);
    const { rows: repeated } = await db.query(`
      SELECT mood,stress,physical_health,happiness,burnout_risk
      FROM public.profiles WHERE id=1
    `);
    assert.deepEqual(repeated, rows);
  } finally {
    await db.close();
  }
});

test('wellness bootstrap preserves preexisting legacy mood/stress values', async () => {
  const db = await setup(`
    CREATE TABLE public.profiles (
      id integer PRIMARY KEY,
      health integer NOT NULL DEFAULT 100,
      mood integer NOT NULL DEFAULT 70,
      stress integer NOT NULL DEFAULT 30
    );
    INSERT INTO public.profiles(id,health,mood,stress)
      VALUES (2,81,41,80);
  `);
  try {
    await db.exec(addProfileWellness);
    await db.exec(seedProfileWellness);
    const { rows } = await db.query(`
      SELECT mood,stress,physical_health,happiness,burnout_risk
      FROM public.profiles WHERE id=2
    `);
    assert.deepEqual(rows, [{
      mood:41,stress:80,physical_health:81,happiness:41,burnout_risk:36,
    }]);
  } finally {
    await db.close();
  }
});

test('the backfill references only scalar columns initialized at this stage', () => {
  for (const legacy of ['mood', 'stress']) {
    assert.match(addProfileWellness,
      new RegExp(`add column if not exists ${legacy} integer not null default (?:70|30)`, 'i'));
  }
  assert.match(seedProfileWellness, /coalesce\(mood,\s*happiness,\s*72\)/i);
  assert.match(seedProfileWellness, /coalesce\(stress,\s*28\)/i);
});


test('missing historical wellness tables restore schema and seed eight activity rows', async () => {
  const catalogDDL = source.match(/CREATE TABLE IF NOT EXISTS public\.wellness_activity_catalog\s*\([\s\S]*?\n\);/i)?.[0];
  const ailmentsDDL = source.match(/CREATE TABLE IF NOT EXISTS public\.player_ailments\s*\([\s\S]*?\n\);/i)?.[0];
  const catalogExpansion = source.match(/alter table public\.wellness_activity_catalog\s+add column if not exists unlock_tier[\s\S]*?;/i)?.[0];
  const ailmentExpansion = source.match(/alter table public\.player_ailments\s+add column if not exists expected_recovery_at[\s\S]*?;/i)?.[0];
  const activitySeed = source.match(/insert into public\.wellness_activity_catalog\s+[\s\S]*?on conflict \(slug\) do update set[\s\S]*?;/i)?.[0];
  assert.ok(catalogDDL, 'Recreate the catalog baseline on a clean database');
  assert.ok(ailmentsDDL, 'Recreate the ailment baseline on a clean database');
  assert.ok(catalogExpansion);
  assert.ok(ailmentExpansion);
  assert.ok(activitySeed);

  const db = await setup(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY);
    INSERT INTO auth.users (id)
      VALUES ('00000000-0000-4000-8000-000000000001');
    INSERT INTO public.profiles (id)
      VALUES ('00000000-0000-4000-8000-000000000011');
  `);
  try {
    await db.exec(catalogDDL);
    await db.exec(ailmentsDDL);
    await db.exec(catalogExpansion);
    await db.exec(ailmentExpansion);
    await db.exec(activitySeed);

    const { rows: activityCount } = await db.query(`
      SELECT count(*)::int AS count,
        count(*) FILTER (WHERE is_active)::int AS enabled
      FROM public.wellness_activity_catalog
    `);
    assert.deepEqual(activityCount[0], { count:8, enabled:8 });

    // Seeding is repeatable and a live catalog value is not destroyed by
    // CREATE TABLE IF NOT EXISTS (e.g. existing admin-tuned activities).
    await db.exec(catalogDDL);
    await db.exec(activitySeed);
    const { rows: repeated } = await db.query(
      'SELECT count(*)::int AS count FROM public.wellness_activity_catalog',
    );
    assert.equal(repeated[0].count,8);
    await db.exec(`
      INSERT INTO public.player_ailments
        (user_id,profile_id,slug,name)
      VALUES
        ('00000000-0000-4000-8000-000000000001',
         '00000000-0000-4000-8000-000000000011',
         'cold','Cold');
    `);
    const { rows: ailments } = await db.query(
      'SELECT count(*)::int AS count FROM public.player_ailments',
    );
    assert.equal(ailments[0].count,1);
    await assert.rejects(db.exec(`
      INSERT INTO public.player_ailments
        (user_id,profile_id,slug,name)
      VALUES
        ('00000000-0000-4000-8000-000000000099',
         '00000000-0000-4000-8000-000000000011',
         'cold','Cold');
    `), /foreign key/i);
  } finally {
    await db.close();
  }
});

test('restored wellness tables are RLS-protected before player access', () => {
  assert.match(source, /ALTER TABLE public\.wellness_activity_catalog ENABLE ROW LEVEL SECURITY/i);
  assert.match(source, /ALTER TABLE public\.player_ailments ENABLE ROW LEVEL SECURITY/i);
  assert.match(source, /CREATE POLICY "wellness_catalog readable"/);
  assert.match(source, /CREATE POLICY "ailments own all"/);
  assert.match(source, /FOR ALL TO authenticated USING \(\(SELECT auth\.uid\(\)\) = user_id\) WITH CHECK/);
});
