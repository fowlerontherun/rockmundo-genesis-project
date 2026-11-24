import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
test('label recommendations enforce roster, privacy, independent consent and retry safety', async () => {
 const db = new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
   CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
   GRANT USAGE ON SCHEMA auth TO authenticated,anon;
   CREATE TABLE profiles(id uuid PRIMARY KEY,user_id uuid);
   CREATE TABLE companies(id uuid PRIMARY KEY,owner_id uuid);
   CREATE TABLE labels(id uuid PRIMARY KEY,name text,owner_id uuid,company_id uuid);
   CREATE TABLE bands(id uuid PRIMARY KEY,name text,status text DEFAULT 'active');
   CREATE TABLE artist_label_contracts(label_id uuid,band_id uuid,status text,start_date date,end_date date);
   CREATE FUNCTION can_manage_band_gigs(b uuid,u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT b=u $$;
   INSERT INTO profiles VALUES ('${id(10)}','${id(11)}'),('${id(20)}','${id(21)}');
   INSERT INTO companies VALUES ('${id(22)}','${id(20)}');
   INSERT INTO labels VALUES ('${id(30)}','Direct label','${id(10)}',null),('${id(31)}','Company label',null,'${id(22)}');
   INSERT INTO bands(id,name) VALUES ('${id(1)}','Headliner'),('${id(2)}','Support'),('${id(3)}','Expired'),('${id(4)}','Future');
   INSERT INTO artist_label_contracts VALUES ('${id(30)}','${id(1)}','active',null,null),('${id(30)}','${id(2)}','active',null,null),
    ('${id(30)}','${id(3)}','active',null,current_date-1),('${id(30)}','${id(4)}','active',current_date+1,null),
    ('${id(31)}','${id(1)}','active',null,null),('${id(31)}','${id(2)}','active',null,null);`);
  const finance=await readFile(new URL('../../supabase/migrations/20260922114500_label_campaign_strategy_finance_integrity.sql',import.meta.url),'utf8');
  await db.exec(finance.slice(finance.indexOf('create or replace function public._can_manage_label'),finance.indexOf('revoke all on function public._can_manage_label')));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261106070014_play_together_discovery.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20261107232830_label_play_together_suggestions.sql',import.meta.url),'utf8'));
  for (const signature of ['get_label_play_together_roster(uuid)','suggest_label_play_together(uuid,uuid,uuid,text)','respond_to_label_play_together(uuid,uuid,text)','list_label_play_together(uuid,uuid)']) {
   assert.equal((await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') AS allowed",[signature])).rows[0].allowed,false);
  }
  const actor=async n=>db.exec(`SET ROLE authenticated; SET test.actor='${id(n)}'`);
  const suggest=async (label=30,h=1,s=2,note='Good fit')=>(await db.query('SELECT suggest_label_play_together($1,$2,$3,$4) AS id',[id(label),id(h),id(s),note])).rows[0].id;
  const list=async(label=null,band=null)=>(await db.query('SELECT list_label_play_together($1,$2) AS data',[label&&id(label),band&&id(band)])).rows[0].data;
  const respond=(suggestion,band,response)=>db.query('SELECT respond_to_label_play_together($1,$2,$3)',[suggestion,id(band),response]);
  await actor(99);
  await assert.rejects(suggest(),/label_suggestion_forbidden/);
  await assert.rejects(list(30),/label_suggestion_forbidden/);
  await actor(11);
  assert.equal((await db.query('SELECT get_label_play_together_roster($1) AS data',[id(30)])).rows[0].data.length,2);
  await assert.rejects(suggest(30,1,3),/roster_changed/);
  await assert.rejects(suggest(30,1,4),/roster_changed/);
  await assert.rejects(suggest(30,1,1),/invalid/);
  await assert.rejects(suggest(30,1,2,'x'.repeat(501)),/invalid/);
  const suggestion=await suggest();
  assert.equal(await suggest(),suggestion);
  assert.equal(await suggest(30,2,1),suggestion);
  await assert.rejects(respond(suggestion,1,'interested'),/forbidden/);
  await actor(21); await suggest(31);
  await actor(99);
  assert.equal((await db.query('SELECT * FROM label_play_together_suggestions')).rows.length,0);
  await assert.rejects(list(null,1),/forbidden/);
  await assert.rejects(list(30,1),/forbidden/);
  await actor(1);
  await assert.rejects(db.query("UPDATE label_play_together_suggestions SET support_response='interested'"),/permission denied/);
  await respond(suggestion,1,'interested'); await respond(suggestion,1,'interested');
  let row=(await list(null,1)).find(s=>s.id===suggestion);
  assert.equal(row.headliner_response,'interested'); assert.equal(row.support_response,'pending');
  assert.equal((await db.query('SELECT * FROM band_touring_shortlist')).rows.length,1);
  await actor(2); await respond(suggestion,2,'declined');
  await actor(11); assert.equal(await suggest(),suggestion);
  assert.equal((await list(30))[0].support_response,'declined');
  await db.exec(`RESET ROLE; UPDATE artist_label_contracts SET end_date=current_date-1 WHERE label_id='${id(30)}' AND band_id='${id(2)}'`);
  await actor(2); await assert.rejects(respond(suggestion,2,'interested'),/roster_changed/);
  assert.equal((await list(null,2)).find(s=>s.id===suggestion).roster_current,false);
  await respond(suggestion,2,'declined');
  await db.exec(`RESET ROLE; UPDATE artist_label_contracts SET end_date=null WHERE label_id='${id(30)}'`);
  await actor(2); await respond(suggestion,2,'interested');
  assert.equal((await list(null,2)).find(s=>s.id===suggestion).headliner_response,'interested');
  await db.exec('SET ROLE anon');
  await assert.rejects(list(30),/permission denied/);
  await assert.rejects(db.query('SELECT * FROM label_play_together_suggestions'),/permission denied/);
 } finally { await db.close(); }
});
