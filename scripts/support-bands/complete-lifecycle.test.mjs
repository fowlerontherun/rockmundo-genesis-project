import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;

test('complete lifecycle: broad opt-in, proposals, travel, notification, changes and expiry', async () => {
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
    await db.exec(`DROP FUNCTION find_available_support_bands(uuid,uuid,timestamptz,timestamptz,boolean,integer);
      CREATE ROLE service_role; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES ('${id(1)}'),('${id(2)}');
      ALTER TABLE profiles ADD COLUMN current_city_id uuid DEFAULT '${id(4)}';
      ALTER TABLE bands ADD COLUMN name text DEFAULT 'Band',ADD COLUMN fame integer DEFAULT 100,ADD COLUMN popularity integer DEFAULT 10;
      ALTER TABLE gigs ADD COLUMN completed_at timestamptz;
      ALTER TABLE gig_support_slots ADD COLUMN invited_at timestamptz DEFAULT now(),ADD COLUMN completed_at timestamptz;
      ALTER TABLE player_scheduled_activities ADD COLUMN updated_at timestamptz DEFAULT now();
      CREATE TABLE cities(id uuid PRIMARY KEY,name text,country text,latitude numeric,longitude numeric);
      INSERT INTO cities VALUES ('${id(4)}','Portsmouth','UK',50.8,-1.1),('${id(40)}','London','UK',51.5,0),('${id(41)}','Paris','France',48.8,2.3);
      CREATE TABLE tours(id uuid PRIMARY KEY,name text,band_id uuid,status text,start_date date,end_date date);
      INSERT INTO tours VALUES ('${id(9)}','Tour','${id(1)}','scheduled',current_date+1,current_date+10);
      CREATE TABLE labels(id uuid PRIMARY KEY,name text);
      CREATE TABLE artist_label_contracts(label_id uuid,band_id uuid,status text,start_date date,end_date date);
      CREATE FUNCTION _can_manage_label(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid()=$1 $$;
      CREATE TABLE experience_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,profile_id uuid,activity_type text,xp_amount integer,metadata jsonb);
      CREATE TABLE player_inbox(id uuid DEFAULT gen_random_uuid(),user_id uuid,category text,priority text,title text,message text,metadata jsonb,action_type text,action_data jsonb,related_entity_type text,related_entity_id uuid);
      CREATE TABLE band_support_preferences(band_id uuid PRIMARY KEY,enabled boolean DEFAULT false,single_gigs_enabled boolean DEFAULT true,tour_enabled boolean DEFAULT true,travel_enabled boolean DEFAULT true,max_travel_minutes integer,minimum_headliner_fame integer DEFAULT 0,minimum_venue_capacity integer DEFAULT 0,preferred_genres text[] DEFAULT '{}',updated_at timestamptz DEFAULT now());
      INSERT INTO band_support_preferences(band_id,enabled) VALUES ('${id(2)}',true);
      CREATE TABLE band_support_availability(id uuid DEFAULT gen_random_uuid(),band_id uuid,city_id uuid,status text,available_from date,available_until date);
      CREATE FUNCTION cancel_gig_support_offer(uuid) RETURNS void LANGUAGE plpgsql AS $$ BEGIN UPDATE gig_support_slots SET status='cancelled',updated_at=now() WHERE id=$1; END $$;
    `);
    for (const file of ['20261106070014_play_together_discovery.sql','20261107152322_band_touring_friendships.sql','20261107232830_label_play_together_suggestions.sql','20261107075018_tour_support_offer_eligibility.sql','20261107153611_grouped_tour_support_offers.sql','20261107235708_play_together_complete_lifecycle.sql','20260825101501_support_band_tour_matching.sql']) {
      await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
    }
    const repairs=await readdir(new URL('../../supabase/migrations/',import.meta.url));
    const lock=repairs.find(name=>name.endsWith('_play_together_slot_authority_repair.sql'));
    assert.ok(lock); await db.exec(await readFile(new URL('../../supabase/migrations/'+lock,import.meta.url),'utf8'));
    const actor=async n=>db.exec(`SET ROLE authenticated; SET test.actor='${id(n)}'`);
    const scope=(kind,countries=[],from=null,until=null)=>db.query('SELECT set_support_touring_scope($1,$2,$3,$4,$5,true,1000)',[id(2),kind,countries,from,until]);
    const candidates=async city=>(await db.query("SELECT * FROM find_available_support_bands($1,$2,now()+interval '2 days',now()+interval '2 days 3 hours',true,500)",[id(1),id(city)])).rows;
    await actor(1); await assert.rejects(scope('worldwide'),/forbidden/);
    await assert.rejects(db.query("UPDATE gig_support_slots SET status='accepted'"),/permission denied/);
    await assert.rejects(db.query("INSERT INTO gig_support_slots(gig_id,status) VALUES($1,'accepted')",[id(5)]),/permission denied/);
    await actor(2); await scope('countries',['UK']);
    assert.equal((await candidates(4)).length,1); assert.equal((await candidates(41)).length,0);
    await scope('worldwide'); assert.equal((await candidates(41)).length,1);
    await assert.rejects(scope('countries',['Missing']),/invalid/);
    const send=async(request=50)=>(await db.query('SELECT create_support_tour_proposal($1,$2,$3,$4,$5,$6) AS id',[id(1),id(9),id(2),[id(5),id(7)],id(request),'Join us'])).rows[0].id;
    const answer=(proposal,action)=>db.query('SELECT respond_support_tour_proposal($1,$2) AS state',[proposal,action]);
    await actor(1); const proposal=await send(); assert.equal(await send(),proposal);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT * FROM gig_support_slots')).rows.length,2);
    const notices=(await db.query('SELECT * FROM player_inbox')).rows;
    assert.equal(notices.length,2);
    assert.ok(notices.every(n=>n.action_data.route.startsWith('/gig-booking?tab=play-together&section=offers&bandId=')));
    assert.equal(new Set(notices.map(n=>n.user_id)).size,2);
    await actor(1); await assert.rejects(answer(proposal,'accept'),/forbidden/);
    await actor(2); assert.equal((await answer(proposal,'accept')).rows[0].state,'accepted');
    await answer(proposal,'accept');
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,2);
    assert.equal((await db.query('SELECT * FROM player_inbox')).rows.length,4);
    await actor(1);
    await db.query('SELECT change_band_friendship($1,$2,$3)',[id(1),id(2),'request']);
    await actor(2); await db.query('SELECT change_band_friendship($1,$2,$3)',[id(2),id(1),'accept']);
    await db.query('SELECT change_band_friendship($1,$2,$3)',[id(2),id(1),'accept']);
    await db.exec(`RESET ROLE; INSERT INTO labels VALUES ('${id(30)}','Label'); INSERT INTO artist_label_contracts VALUES ('${id(30)}','${id(1)}','active',null,null),('${id(30)}','${id(2)}','active',null,null);`);
    await actor(30);
    const linked=(await db.query('SELECT suggest_label_pairing_for_booking($1,$2,$3,$4,$5,null) AS id',[id(30),id(1),id(2),'Join tour',id(9)])).rows[0].id;
    await actor(1); await db.query('SELECT respond_to_label_play_together($1,$2,$3)',[linked,id(1),'interested']);
    await actor(30);
    const labelList=(await db.query('SELECT list_label_play_together($1) AS data',[id(30)])).rows[0].data;
    assert.equal(labelList[0].confirmed_dates,2); assert.equal(labelList[0].tour_id,id(9));
    await assert.rejects(db.query('SELECT suggest_label_pairing_for_booking($1,$2,$3,$4,null,null)',[id(30),id(1),id(2),'Changed']),/already_reviewed/);
    await db.exec('RESET ROLE');
    await db.exec(`UPDATE gigs SET scheduled_date=scheduled_date+interval '1 day',scheduled_end=scheduled_end+interval '1 day' WHERE id='${id(5)}'`);
    assert.equal((await db.query('SELECT status FROM support_tour_proposals WHERE id=$1',[proposal])).rows[0].status,'changed');
    assert.equal((await db.query("SELECT * FROM player_scheduled_activities WHERE status='scheduled'")).rows.length,1);
    assert.equal((await db.query("SELECT status FROM gig_support_slots WHERE gig_id=$1",[id(5)])).rows[0].status,'cancelled');
    // Free the other confirmed slot so a replacement proposal can cover both saved dates.
    await db.exec(`UPDATE gig_support_slots SET status='cancelled' WHERE gig_id='${id(7)}'; UPDATE player_scheduled_activities SET status='cancelled';`);
    await actor(1); const replacement=await send(51);
    await db.exec('RESET ROLE');
    await db.query("UPDATE support_tour_proposals SET expires_at=now()-interval '1 minute' WHERE id=$1",[replacement]);
    await db.query('SELECT expire_support_tour_proposals()');
    assert.equal((await db.query('SELECT status FROM support_tour_proposals WHERE id=$1',[replacement])).rows[0].status,'expired');
    assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='pending'")).rows.length,0);
    // Route must reject an impossible cross-city gap, including from the members' current city.
    await db.exec(`UPDATE gigs SET scheduled_date=now()+interval '5 minutes',scheduled_end=now()+interval '3 hours',venue_id='${id(3)}' WHERE id='${id(5)}'; UPDATE venues SET city_id='${id(41)}' WHERE id='${id(3)}';`);
    await actor(1); await assert.rejects(send(52),/support_route_arrival_unreachable/);
    await actor(99); await assert.rejects(db.query('SELECT list_support_tour_proposals($1)',[id(2)]),/forbidden/);
    assert.equal((await db.query('SELECT * FROM support_tour_proposals')).rows.length,0);
  } finally { await db.close(); }
});
