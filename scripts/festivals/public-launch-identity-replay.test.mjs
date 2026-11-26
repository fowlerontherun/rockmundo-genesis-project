import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync('supabase/migrations/20261126090742_public_festival_launch_identity.sql', 'utf8');
const launch = '11111111-1111-4111-8111-111111111111';
const edition = '22222222-2222-4222-8222-222222222222';
const company = '33333333-3333-4333-8333-333333333333';

async function prepare({ newerSchema = false } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE TABLE public.festival_launches (
      id uuid PRIMARY KEY, festival_company_id uuid NOT NULL, public_slug text NOT NULL
    );
    CREATE TABLE public.festival_public_profiles (
      festival_company_id uuid PRIMARY KEY, public_slug text NOT NULL
    );
    CREATE TABLE public.test_public_guides (
      slug text PRIMARY KEY, public_id uuid NOT NULL, visible boolean NOT NULL
    );
    INSERT INTO public.festival_launches VALUES ('${launch}', '${company}', 'summer-sound');
    INSERT INTO public.festival_public_profiles VALUES ('${company}', 'summer-sound');
    CREATE FUNCTION public.get_public_festival_guide(p_slug text) RETURNS jsonb
    LANGUAGE sql STABLE AS $$
      SELECT jsonb_build_object('id', public_id, 'slug', slug)
      FROM public.test_public_guides WHERE slug = p_slug AND visible
    $$;
  `);
  if (newerSchema) {
    await db.exec(`
      CREATE TABLE public.festival_public_editions (
        id uuid PRIMARY KEY, festival_launch_id uuid NOT NULL, slug text UNIQUE NOT NULL
      );
      INSERT INTO public.festival_public_editions VALUES ('${edition}', '${launch}', 'summer-sound');
    `);
  }
  await db.exec(`INSERT INTO public.test_public_guides VALUES ('summer-sound', '${newerSchema ? edition : launch}', true)`);
  return db;
}

for (const newerSchema of [false, true]) {
  test(`read-only festival identity works against ${newerSchema ? 'separate public edition' : 'current launch-id'} projection`, async () => {
    const db = await prepare({ newerSchema });
    try {
      await db.exec(migration);
      await db.exec(migration); // Forward migration is safe to reapply.
      const result = await db.query("SELECT public.get_public_festival_with_identity('summer-sound') AS value");
      assert.equal(result.rows[0].value.festivalLaunchId, launch);
      assert.equal(result.rows[0].value.id, newerSchema ? edition : launch);
      assert.equal((await db.query("SELECT public.get_public_festival_with_identity('private-festival') AS value")).rows[0].value, null);
      assert.equal((await db.query("SELECT public.get_public_festival_with_identity('bad slug!') AS value")).rows[0].value, null);
    } finally {
      await db.close();
    }
  });
}

test('a published slug cannot claim a different launch id by substituting the projection id', async () => {
  const db = await prepare();
  try {
    await db.exec(migration);
    await db.exec(`UPDATE public.test_public_guides SET public_id = '${edition}' WHERE slug = 'summer-sound'`);
    await assert.rejects(
      db.query("SELECT public.get_public_festival_with_identity('summer-sound')"),
      /festival_public_identity_unavailable/,
    );
  } finally {
    await db.close();
  }
});
