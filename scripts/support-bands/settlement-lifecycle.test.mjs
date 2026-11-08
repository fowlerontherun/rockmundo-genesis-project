import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;

test('support settlement pays and progresses exactly once across finance retry, records history and finishes schedules', async () => {
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
    await db.exec(`CREATE TABLE financial_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text UNIQUE);
      ALTER TABLE bands ADD COLUMN band_balance integer DEFAULT 0,ADD COLUMN total_fans integer DEFAULT 0;
      CREATE TABLE gig_outcomes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),gig_id uuid UNIQUE,ticket_revenue integer,actual_attendance integer,overall_rating numeric);
      CREATE FUNCTION finance_transfer(text,uuid,text,uuid,bigint,text,text,text,text,uuid,uuid,jsonb) RETURNS uuid LANGUAGE plpgsql AS $$
      DECLARE tx uuid; BEGIN
       IF current_setting('test.finance_failed',true)='true' THEN RAISE EXCEPTION 'finance_unavailable'; END IF;
       INSERT INTO financial_transactions(key) VALUES($8) ON CONFLICT(key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO tx; RETURN tx;
      END $$;
      CREATE FUNCTION support_fan_gain_for_gig(uuid,integer,numeric) RETURNS integer LANGUAGE sql AS $$ SELECT 40 $$;
      CREATE FUNCTION support_gig_demand_multiplier(uuid) RETURNS numeric LANGUAGE sql AS $$ SELECT 1.1 $$;`);
    const economics=await readFile(new URL('../../supabase/migrations/20260825101500_support_band_economics_progression.sql',import.meta.url),'utf8');
    await db.exec(economics.slice(economics.indexOf('CREATE TABLE'),economics.indexOf('ALTER TABLE')));
    await db.exec('ALTER TABLE support_band_gig_settlements ADD COLUMN progression_applied_at timestamptz');
    await db.exec(await readFile(new URL('./fixtures/settlement-live-20261107.sql',import.meta.url),'utf8'));
    // Existing history/reputation integration uses the real settlement receipt.
    await db.exec(await readFile(new URL('../../supabase/migrations/20260825103000_support_band_history_reputation_relationships.sql',import.meta.url),'utf8'));
    // Restore the guarded summary added by the completion migration.
    const lifecycle=await readFile(new URL('../../supabase/migrations/20261107235708_play_together_complete_lifecycle.sql',import.meta.url),'utf8');
    await db.exec(lifecycle.slice(lifecycle.indexOf('CREATE OR REPLACE FUNCTION public.get_band_support_summary')));
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(2)}'; SELECT set_support_touring_scope('${id(2)}','worldwide','{}',null,null,true,1000);
      SET test.actor='${id(1)}'`);
    const proposal=(await db.query('SELECT create_support_tour_proposal($1,$2,$3,$4,$5,$6) AS id',[id(1),id(9),id(2),[id(5)],id(50),'Join'])).rows[0].id;
    await db.exec(`SET test.actor='${id(2)}'`);
    await db.query("SELECT respond_support_tour_proposal($1,'accept')",[proposal]);
    await db.exec(`RESET ROLE; UPDATE bands SET band_balance=10000 WHERE id='${id(1)}';
      INSERT INTO gig_outcomes(gig_id,ticket_revenue,actual_attendance,overall_rating) VALUES('${id(5)}',10000,1000,18);
      UPDATE gigs SET status='completed',completed_at=now() WHERE id='${id(5)}'; SET test.finance_failed='true';`);
    await db.query('SELECT settle_support_band_gig($1)',[id(5)]);
    assert.equal((await db.query('SELECT status FROM support_band_gig_settlements')).rows[0].status,'pending_finance');
    const afterFirst=(await db.query('SELECT id,fame,total_fans,popularity FROM bands ORDER BY id')).rows;
    assert.equal((await db.query('SELECT * FROM band_support_history')).rows.length,1);
    assert.equal((await db.query("SELECT * FROM player_scheduled_activities WHERE status='completed'")).rows.length,1);
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(2)}'`);
    let report=(await db.query('SELECT get_band_support_summary($1) AS report',[id(2)])).rows[0].report;
    assert.equal(report.supportHistory[0].finance_status,'pending_finance');
    await db.exec(`SET test.actor='${id(99)}'`);
    await assert.rejects(db.query('SELECT get_band_support_summary($1)',[id(2)]),/forbidden/);
    await db.exec("RESET ROLE; SET test.finance_failed='false'");
    await db.query('SELECT settle_support_band_gig($1)',[id(5)]); await db.query('SELECT settle_support_band_gig($1)',[id(5)]);
    assert.deepEqual((await db.query('SELECT id,fame,total_fans,popularity FROM bands ORDER BY id')).rows,afterFirst);
    assert.equal((await db.query('SELECT * FROM financial_transactions')).rows.length,1);
    assert.equal((await db.query('SELECT * FROM experience_ledger')).rows.length,1);
    assert.ok((await db.query('SELECT xp_amount FROM experience_ledger')).rows[0].xp_amount>0);
    assert.equal((await db.query('SELECT * FROM support_member_xp_receipts')).rows.length,1);
    assert.equal((await db.query('SELECT * FROM band_support_history')).rows.length,1);
    assert.deepEqual((await db.query('SELECT band_balance FROM bands ORDER BY id')).rows.map(b=>b.band_balance),[8000,2000]);
    await db.exec(`SET ROLE authenticated; SET test.actor='${id(2)}'`);
    report=(await db.query('SELECT get_band_support_summary($1) AS report',[id(2)])).rows[0].report;
    assert.equal(report.supportHistory[0].finance_status,'settled');
  } finally { await db.close(); }
});
