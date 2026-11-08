import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
export const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
export async function lifecycleFixture() {
 const db=new PGlite();
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
      await db.exec(await readFile(new URL('../../../supabase/migrations/'+file,import.meta.url),'utf8'));
    }
    const repairs=await readdir(new URL('../../../supabase/migrations/',import.meta.url));
    const lock=repairs.find(name=>name.endsWith('_play_together_slot_authority_repair.sql'));
    assert.ok(lock); await db.exec(await readFile(new URL('../../../supabase/migrations/'+lock,import.meta.url),'utf8'));
    await db.exec('DROP FUNCTION public.cancel_gig_support_offer(uuid)');
    const workflow=await readFile(new URL('../../../supabase/migrations/20260825093000_support_band_invitation_workflow.sql',import.meta.url),'utf8');
    await db.exec(workflow.slice(workflow.indexOf('CREATE OR REPLACE FUNCTION public.cancel_gig_support_offer'),workflow.indexOf('REVOKE ALL ON FUNCTION public.create_gig_support_offer')));

 return db;
 } catch (error) { await db.close(); throw error; }
}
