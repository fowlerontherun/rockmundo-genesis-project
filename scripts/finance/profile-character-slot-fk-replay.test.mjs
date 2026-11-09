import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const historical = readFileSync(
  new URL('../../supabase/migrations/20260315090000_add_character_slots.sql', import.meta.url),
  'utf8',
);
const retarget = historical.match(/DO \$retarget_profile_user_fks\$[\s\S]*?\$retarget_profile_user_fks\$;/)?.[0];
assert.ok(retarget, 'The historical character-slot migration must guard account-level FKs');

const originalReferences = [
  'band_members_user_id_fkey',
  'venue_relationships_user_id_fkey',
  'venue_bookings_user_id_fkey',
  'songwriting_projects_user_id_fkey',
  'songwriting_sessions_user_id_fkey',
];

const fixture = async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE TABLE public.profiles (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id)
    );
    INSERT INTO auth.users(id)
      VALUES ('00000000-0000-4000-8000-000000000001'),
             ('00000000-0000-4000-8000-000000000002');
    INSERT INTO public.profiles(id,user_id)
      VALUES ('00000000-0000-4000-8000-000000000011',
              '00000000-0000-4000-8000-000000000001');

    CREATE TABLE public.band_members (
      id integer PRIMARY KEY, user_id uuid NOT NULL,
      CONSTRAINT band_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE TABLE public.venue_relationships (
      id integer PRIMARY KEY, user_id uuid NOT NULL,
      CONSTRAINT venue_relationships_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE TABLE public.venue_bookings (
      id integer PRIMARY KEY, user_id uuid NOT NULL,
      CONSTRAINT venue_bookings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
        ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE TABLE public.songwriting_projects (
      id integer PRIMARY KEY, user_id uuid NOT NULL,
      CONSTRAINT songwriting_projects_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
        ON DELETE CASCADE
    );
    CREATE TABLE public.songwriting_sessions (
      id integer PRIMARY KEY, user_id uuid NOT NULL,
      CONSTRAINT songwriting_sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(user_id)
        ON DELETE CASCADE
    );

    INSERT INTO public.band_members(id,user_id)
      VALUES (1,'00000000-0000-4000-8000-000000000001');
    INSERT INTO public.venue_relationships(id,user_id)
      VALUES (1,'00000000-0000-4000-8000-000000000001');
    INSERT INTO public.venue_bookings(id,user_id)
      VALUES (1,'00000000-0000-4000-8000-000000000001');
    INSERT INTO public.songwriting_projects(id,user_id)
      VALUES (1,'00000000-0000-4000-8000-000000000001');
    INSERT INTO public.songwriting_sessions(id,user_id)
      VALUES (1,'00000000-0000-4000-8000-000000000001');
  `);
  return db;
};

test('historical character slots retarget only known account FKs without deleting data', async () => {
  const db = await fixture();
  try {
    await db.exec(retarget);
    const { rows } = await db.query(`
      SELECT c.conname, c.confrelid::regclass::text AS target, c.confupdtype,
             c.confdeltype
      FROM pg_constraint c
      WHERE c.conname=ANY($1::text[])
      ORDER BY c.conname
    `, [originalReferences]);
    assert.equal(rows.length, 5);
    for (const row of rows) {
      assert.match(row.target, /auth\.users$/);
      assert.equal(row.confdeltype, 'c', 'Retain ON DELETE CASCADE');
      assert.equal(row.confupdtype,
        row.conname.startsWith('songwriting_') ? 'a' : 'c',
        'Retain original ON UPDATE behaviour');
    }

    for (const table of ['band_members','venue_relationships','venue_bookings',
      'songwriting_projects','songwriting_sessions']) {
      const { rows: counts } = await db.query(`SELECT count(*)::int AS count FROM public.${table}`);
      assert.equal(counts[0].count, 1, `Preserve existing ${table} records`);
    }

    await db.exec('ALTER TABLE public.profiles DROP CONSTRAINT profiles_user_id_key;');
    await db.exec(`INSERT INTO public.profiles(id,user_id)
      VALUES ('00000000-0000-4000-8000-000000000012',
              '00000000-0000-4000-8000-000000000001')`);

    const { rows: slots } = await db.query(`
      SELECT count(*)::int AS count FROM public.profiles
      WHERE user_id='00000000-0000-4000-8000-000000000001'
    `);
    assert.equal(slots[0].count, 2, 'Multiple character slots share one auth account');

    await db.exec(`INSERT INTO public.band_members(id,user_id)
      VALUES (2,'00000000-0000-4000-8000-000000000002')`);
    // A valid auth user should be referenceable without already having a
    // profile, because these are account-level relations, not character FKs.
    await assert.rejects(db.exec(`INSERT INTO public.band_members(id,user_id)
      VALUES (3,'00000000-0000-4000-8000-000000000099')`));
  } finally {
    await db.close();
  }
});

test('unknown profile user FK fails closed before any FK or uniqueness mutation', async () => {
  const db = await fixture();
  try {
    await db.exec(`
      CREATE TABLE public.unexpected_user_reference (
        user_id uuid REFERENCES public.profiles(user_id) ON DELETE CASCADE
      );
    `);
    await assert.rejects(
      db.exec(retarget),
      /Unexpected profiles\.user_id FK dependencies/,
    );
    const { rows } = await db.query(`
      SELECT c.confrelid::regclass::text AS target
      FROM pg_constraint c
      WHERE c.conname='band_members_user_id_fkey'
    `);
    assert.match(rows[0].target, /profiles$/);
    const { rows: stillUnique } = await db.query(`
      SELECT count(*)::int AS count FROM pg_constraint
      WHERE conrelid='public.profiles'::regclass
        AND conname='profiles_user_id_key'
    `);
    assert.equal(stillUnique[0].count, 1);
  } finally {
    await db.close();
  }
});
