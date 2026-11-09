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
