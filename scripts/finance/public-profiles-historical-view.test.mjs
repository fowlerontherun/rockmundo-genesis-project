import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const readMigration = name =>
  readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

const septemberView = readMigration('20250920155525_add_profile_city_gender_age.sql');
const februaryView = readMigration('20260220090000_create_public_profiles_view.sql');
const marchView = readMigration('20260305100000_extend_profiles_with_biographical_fields.sql');

const extractView = sql => {
  const match = sql.match(/CREATE OR REPLACE VIEW public\.public_profiles AS[\s\S]*?FROM public\.profiles;/);
  assert.ok(match, 'Historical public_profiles definition must be present');
  return match[0];
};

const columns = async db => {
  const { rows } = await db.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_profiles'
    ORDER BY ordinal_position`);
  return rows.map(row => row.column_name);
};

test('February public profile migration narrows the earlier wide view without leaking fields or losing anon access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        username text,
        display_name text,
        avatar_url text,
        bio text,
        gender text,
        city_of_birth text,
        age integer,
        current_city text,
        cash bigint NOT NULL DEFAULT 10000
      );
      ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
        FOR SELECT USING (true);
    `);
    await db.exec(extractView(septemberView));
    await db.exec('GRANT SELECT ON public.public_profiles TO anon;');
    assert.deepEqual(await columns(db), [
      'id', 'user_id', 'username', 'display_name', 'avatar_url', 'bio',
      'gender', 'city_of_birth', 'age', 'current_city',
    ]);

    await db.exec(februaryView);
    assert.deepEqual(await columns(db), [
      'id', 'user_id', 'username', 'display_name', 'avatar_url', 'bio',
    ]);
    const { rows: privileges } = await db.query(`
      SELECT
        has_table_privilege('anon', 'public.public_profiles', 'SELECT') AS anon_can_select,
        has_table_privilege('authenticated', 'public.public_profiles', 'SELECT') AS signed_in_can_select
    `);
    assert.deepEqual(privileges[0], { anon_can_select: true, signed_in_can_select: true });

    const { rows: policies } = await db.query(`SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'profiles' ORDER BY policyname`);
    assert.deepEqual(policies.map(row => row.policyname), ['Profile owners can view their data']);

    // March legitimately widens the sanitized view; clean replay must continue.
    await db.exec(extractView(marchView));
    assert.deepEqual(await columns(db), [
      'id', 'user_id', 'username', 'display_name', 'avatar_url', 'bio',
      'gender', 'city_of_birth', 'age',
    ]);
  } finally {
    await db.close();
  }
});
