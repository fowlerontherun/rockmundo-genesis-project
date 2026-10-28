import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const readMigration = name =>
  readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

const onboarding = readMigration('20250925211737_handle_new_user_username_retry.sql');
const characterSlots = readMigration('20261001090000_add_profile_character_slots.sql');
const profileScopedSkills = readMigration('20260315090000_add_character_slots.sql');

test('September signup uses only the user-scoped skill and feed columns that exist before character slots', async () => {
  assert.doesNotMatch(onboarding, /\bslot_number\s*,|\bunlock_cost\s*,/);
  assert.match(characterSlots, /ADD COLUMN IF NOT EXISTS slot_number integer/);
  assert.match(characterSlots, /ADD COLUMN IF NOT EXISTS unlock_cost integer/);
  assert.match(characterSlots, /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/);
  assert.match(profileScopedSkills, /ADD COLUMN IF NOT EXISTS profile_id uuid/);
  assert.match(profileScopedSkills, /ALTER TABLE public\.activity_feed ADD COLUMN IF NOT EXISTS profile_id uuid/);
  assert.doesNotMatch(onboarding, /INSERT INTO public\.player_skills \(\s*user_id,\s*profile_id/);
  assert.doesNotMatch(onboarding, /INSERT INTO public\.activity_feed \(user_id, profile_id/);
  assert.match(onboarding, /ON CONFLICT \(user_id\) DO NOTHING/);
  assert.match(onboarding, /ON CONFLICT \(profile_id\) DO UPDATE SET/);

  const db = new PGlite();
  try {
    const skillColumns = [
      'guitar', 'vocals', 'drums', 'bass', 'performance', 'songwriting',
      'composition', 'creativity', 'technical', 'business', 'marketing',
    ].map(name => `${name} integer`).join(', ');
    const attributeColumns = [
      'physical_endurance', 'mental_focus', 'stage_presence', 'crowd_engagement',
      'social_reach', 'looks', 'charisma', 'musicality', 'creativity',
      'technical', 'business', 'marketing', 'composition',
      'attribute_points', 'attribute_points_spent',
    ].map(name => `${name} integer`).join(', ');
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb);
      CREATE TABLE public.profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        username text NOT NULL CONSTRAINT profiles_username_key UNIQUE,
        display_name text, current_city_id uuid, current_location text,
        health integer, gender text, city_of_birth text, age integer
      );
      CREATE TABLE public.user_roles (user_id uuid, role text, PRIMARY KEY(user_id,role));
      CREATE TABLE public.player_skills (user_id uuid UNIQUE, ${skillColumns});
      CREATE TABLE public.fan_demographics (user_id uuid PRIMARY KEY);
      CREATE TABLE public.activity_feed (user_id uuid, activity_type text, message text);
      CREATE TABLE public.player_attributes (
        user_id uuid,
        profile_id uuid UNIQUE, ${attributeColumns}
      );
      CREATE TABLE public.achievements (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, name text);
      CREATE TABLE public.player_achievements (
        user_id uuid, achievement_id uuid, PRIMARY KEY(user_id, achievement_id)
      );
      CREATE FUNCTION public.get_default_city_id() RETURNS uuid LANGUAGE sql
        AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
    `);
    await db.exec(onboarding);
    await db.exec(`CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()`);
    await db.exec(`INSERT INTO auth.users (id, raw_user_meta_data)
      VALUES ('00000000-0000-0000-0000-000000000002',
        '{"username":"rockstar","display_name":"Rock Star"}')`);
    const { rows: profiles } = await db.query(`SELECT username, display_name
      FROM public.profiles`);
    assert.deepEqual(profiles, [{ username: 'rockstar', display_name: 'Rock Star' }]);
    const { rows: skills } = await db.query(`SELECT guitar, vocals
      FROM public.player_skills`);
    assert.deepEqual(skills, [{ guitar: 5, vocals: 5 }]);
    const { rows: activity } = await db.query(`SELECT activity_type, message
      FROM public.activity_feed`);
    assert.equal(activity.length, 1);
    assert.equal(activity[0].activity_type, 'join');
    const { rows: roles } = await db.query(`SELECT role FROM public.user_roles`);
    assert.deepEqual(roles, [{ role: 'user' }]);
    const { rows: attributes } = await db.query(`SELECT physical_endurance, attribute_points
      FROM public.player_attributes`);
    assert.deepEqual(attributes, [{ physical_endurance: 5, attribute_points: 0 }]);
  } finally {
    await db.close();
  }
});
