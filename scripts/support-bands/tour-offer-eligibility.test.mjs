import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;

test('tour-only bands can receive and accept tour offers; single-gig preferences remain independent', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE profiles(id uuid PRIMARY KEY, user_id uuid);
      CREATE TABLE bands(id uuid PRIMARY KEY, status text DEFAULT 'active', leader_id uuid);
      CREATE TABLE venues(id uuid PRIMARY KEY, city_id uuid, capacity integer, name text);
      CREATE TABLE gigs(id uuid PRIMARY KEY, band_id uuid, venue_id uuid, scheduled_date timestamptz, scheduled_end timestamptz, status text, tour_id uuid);
      CREATE TABLE gig_support_slots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), gig_id uuid, support_band_id uuid, invited_by uuid, status text, revenue_share numeric, request_id uuid, responded_at timestamptz, response_note text, updated_at timestamptz);
      CREATE TABLE band_members(band_id uuid, profile_id uuid, user_id uuid, member_status text, is_touring_member boolean);
      CREATE TABLE player_scheduled_activities(user_id uuid, profile_id uuid, activity_type text, scheduled_start timestamptz, scheduled_end timestamptz, status text, title text, location text, linked_gig_id uuid, metadata jsonb);
      CREATE UNIQUE INDEX activities_unique ON player_scheduled_activities(linked_gig_id,profile_id) WHERE linked_gig_id IS NOT NULL AND status<>'cancelled';
      CREATE TABLE test_preferences(band_id uuid, single_gigs_enabled boolean, tour_enabled boolean);
      CREATE FUNCTION can_manage_band_gigs(b uuid,u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE(b=u,false) $$;
      -- Isolate the caller's choice of eligibility mode; the shared matcher has separate coverage.
      CREATE FUNCTION find_available_support_bands(uuid,uuid,timestamptz,timestamptz,boolean,integer)
      RETURNS TABLE(band_id uuid) LANGUAGE sql AS $$ SELECT band_id FROM test_preferences WHERE CASE WHEN $5 THEN tour_enabled ELSE single_gigs_enabled END $$;
      INSERT INTO profiles VALUES ('${id(1)}','${id(1)}'),('${id(2)}','${id(2)}');
      INSERT INTO bands(id,leader_id) VALUES ('${id(1)}','${id(1)}'),('${id(2)}','${id(2)}');
      INSERT INTO venues VALUES ('${id(3)}','${id(4)}',500,'Test venue');
      INSERT INTO gigs VALUES ('${id(5)}','${id(1)}','${id(3)}',now()+interval '2 days',now()+interval '2 days 3 hours','scheduled','${id(9)}'),
        ('${id(6)}','${id(1)}','${id(3)}',now()+interval '4 days',now()+interval '4 days 3 hours','scheduled',null),
        ('${id(7)}','${id(1)}','${id(3)}',now()+interval '6 days',now()+interval '6 days 3 hours','scheduled','${id(9)}');
      INSERT INTO test_preferences VALUES ('${id(2)}',false,true);
    `);
    const files = await readdir(new URL('../../supabase/migrations/',import.meta.url));
    const migration = files.find(name=>name.endsWith('_tour_support_offer_eligibility.sql'));
    assert.ok(migration);
    await db.exec(await readFile(new URL(`../../supabase/migrations/${migration}`,import.meta.url),'utf8'));
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(1)}';`);
    const offer = async (gig,request) => (await db.query('SELECT * FROM create_gig_support_offer($1,$2,$3)',[id(gig),id(2),id(request)])).rows[0];
    const tourOffer=await offer(5,10);
    assert.equal(tourOffer.status,'pending');
    await assert.rejects(offer(6,11),/support_offer_band_unavailable/);
    await db.exec(`SET test.actor='${id(2)}';`);
    assert.equal((await db.query("SELECT * FROM respond_to_gig_support_offer($1,'accept',null)",[tourOffer.id])).rows[0].status,'accepted');
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,1);
    await db.exec('UPDATE test_preferences SET single_gigs_enabled=true,tour_enabled=false');
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(1)}';`);
    await assert.rejects(offer(7,12),/support_offer_band_unavailable/);
    const singleOffer=await offer(6,13);
    await db.exec(`SET test.actor='${id(2)}';`);
    assert.equal((await db.query("SELECT * FROM respond_to_gig_support_offer($1,'accept',null)",[singleOffer.id])).rows[0].status,'accepted');
    // Changes between invitation and acceptance must be revalidated.
    await db.exec('RESET ROLE; UPDATE test_preferences SET tour_enabled=true');
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(1)}';`);
    const changedOffer=await offer(7,14);
    await db.exec('RESET ROLE; UPDATE test_preferences SET tour_enabled=false');
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(2)}';`);
    await assert.rejects(db.query("SELECT * FROM respond_to_gig_support_offer($1,'accept',null)",[changedOffer.id]),/support_offer_band_unavailable/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT status FROM gig_support_slots WHERE id=$1',[changedOffer.id])).rows[0].status,'pending');
    assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,2);
  } finally { await db.close(); }
});
