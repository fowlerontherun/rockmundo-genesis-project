import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;

test('grouped tour offers are authorized, idempotent and atomic', async () => {
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
    await db.exec(`CREATE FUNCTION find_tour_support_show_candidates(uuid,uuid)
      RETURNS TABLE(gig_id uuid,support_band_id uuid,travel_feasible boolean) LANGUAGE sql AS $$
      SELECT g.id,p.band_id,true FROM gigs g CROSS JOIN test_preferences p WHERE g.band_id=$1 AND g.tour_id=$2 AND p.tour_enabled $$;`);
    await db.exec(await readFile(new URL('../../supabase/migrations/20261107153611_grouped_tour_support_offers.sql',import.meta.url),'utf8'));
    const send = ids => db.query('SELECT create_tour_support_offers($1,$2,$3,$4,$5)',[id(1),id(9),id(2),ids.map(id),id(20)]);
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(2)}'`);
    await assert.rejects(send([5,7]),/tour_support_forbidden/);
    await db.exec(`SET test.actor='${id(1)}'`);
    await assert.rejects(send([5,6]),/tour_support_gig_mismatch/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT * FROM gig_support_slots')).rows.length,0);
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(1)}'`);
    await assert.rejects(send([5,5]),/tour_support_dates_invalid/);
    await send([5,7]); await send([5,7]);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT * FROM gig_support_slots')).rows.length,2);
    const snapshots=(await db.query(`SELECT s.id AS slot_id,s.gig_id,g.tour_id,g.scheduled_date,g.scheduled_end,g.venue_id,s.revenue_share
      FROM gig_support_slots s JOIN gigs g ON g.id=s.gig_id ORDER BY g.id`)).rows;
    const respond = (offers,action='accept') => db.query('SELECT respond_to_tour_support_offers($1,$2)',[JSON.stringify(offers),action]);
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(1)}'`);
    await assert.rejects(respond(snapshots),/tour_support_forbidden/);
    await db.exec(`SET test.actor='${id(2)}'`);
    await assert.rejects(respond([snapshots[0],{...snapshots[1],revenue_share:0.9}]),/tour_support_itinerary_changed/);
    await db.exec('RESET ROLE');
    assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='accepted'")).rows.length,0);
    // Make the later show fail after the first has been processed, proving transaction rollback.
    await db.exec(`UPDATE gig_support_slots SET id=CASE WHEN gig_id='${id(5)}' THEN '${id(30)}'::uuid ELSE '${id(31)}'::uuid END;
      UPDATE gigs SET status='cancelled' WHERE id='${id(7)}'`);
    snapshots[0].slot_id=id(30); snapshots[1].slot_id=id(31);
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(2)}'`);
    await assert.rejects(respond(snapshots));
    await db.exec('RESET ROLE');
    assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='accepted'")).rows.length,0);
    assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,0);
    await db.exec(`UPDATE gigs SET status='scheduled' WHERE id='${id(7)}'; SET ROLE authenticated; SET test.actor='${id(2)}'`);
    await respond(snapshots,'decline');
    await db.exec('RESET ROLE');
    assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='declined'")).rows.length,2);
    assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,0);
    await db.exec(`UPDATE gig_support_slots SET status='pending'; SET ROLE authenticated; SET test.actor='${id(2)}'`);
    await respond(snapshots); await respond(snapshots);
    await db.exec('RESET ROLE');
    assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='accepted'")).rows.length,2);
    assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,2);
  } finally { await db.close(); }
});
