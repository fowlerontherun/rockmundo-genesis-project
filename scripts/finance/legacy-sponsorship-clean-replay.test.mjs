import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = (name) => readFileSync(
  new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8',
);

const legacy = migration('20251125150703_create_sponsorship_offers.sql');
const january = migration('20260123132138_e4689c3e-1880-423a-8daf-ada229fc2958.sql');

test('January sponsorship policies and indexes replay on November band-only entities', async () => {
  const table = legacy.match(
    /CREATE TABLE IF NOT EXISTS public\.sponsorship_entities\s*\([\s\S]*?\n\);/,
  )?.[0];
  assert.ok(table, 'Replay the actual November entity table, not a January-shaped mock');
  assert.doesNotMatch(table, /artist_profile_id/);
  assert.match(january, /ADD COLUMN IF NOT EXISTS artist_profile_id uuid/);
  assert.match(january, /CREATE UNIQUE INDEX IF NOT EXISTS sponsorship_entities_artist_key/);

  const db = new PGlite();
  try {
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE ROLE service_role;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS
        $$ SELECT gen_random_uuid() $$;
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY, user_id uuid NOT NULL
      );
      CREATE TABLE public.bands (
        id uuid PRIMARY KEY, fame integer, status text
      );
      CREATE TABLE public.band_members (band_id uuid, user_id uuid);
    `);
    await db.exec(table);

    const bandId = '00000000-0000-0000-0000-000000000021';
    const profileId = '00000000-0000-0000-0000-000000000031';
    await db.query('INSERT INTO public.bands(id, fame, status) VALUES ($1, 50, $2)',
      [bandId, 'active']);
    await db.query('INSERT INTO public.profiles(id, user_id) VALUES ($1, $2)',
      [profileId, '00000000-0000-0000-0000-000000000001']);
    await db.query(`INSERT INTO public.sponsorship_entities (band_id, fame_momentum)
      VALUES ($1, 50)`, [bandId]);

    // Execute the entire January migration, including the partial unique
    // artist index, ownership policies and existing-band seed.
    await db.exec(january);

    const { rows: oldBands } = await db.query(`
      SELECT band_id, fame_momentum, artist_profile_id
      FROM public.sponsorship_entities WHERE band_id = $1`, [bandId]);
    assert.equal(oldBands.length, 1);
    assert.equal(oldBands[0].band_id, bandId);
    assert.equal(Number(oldBands[0].fame_momentum), 50);
    assert.equal(oldBands[0].artist_profile_id, null);

    await db.query(`INSERT INTO public.sponsorship_entities
      (artist_profile_id, brand_flags) VALUES ($1, ARRAY['solo']::text[])`, [profileId]);
    const { rows: solo } = await db.query(`
      SELECT artist_profile_id, brand_flags
      FROM public.sponsorship_entities WHERE artist_profile_id = $1`, [profileId]);
    assert.equal(solo.length, 1);
    assert.deepEqual(solo[0].brand_flags, ['solo']);

    const { rows: policies } = await db.query(`SELECT policyname
      FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'sponsorship_entities'`);
    assert.ok(policies.some(({ policyname }) =>
      policyname === 'Users can view their own sponsorship entities'));
    assert.ok(policies.some(({ policyname }) =>
      policyname === 'Service role can manage sponsorship entities'));

    const { rows: indexes } = await db.query(`SELECT indexname
      FROM pg_indexes WHERE schemaname = 'public'
      AND tablename = 'sponsorship_entities'`);
    assert.ok(indexes.some(({ indexname }) =>
      indexname === 'sponsorship_entities_artist_key'));
  } finally {
    await db.close();
  }
});
