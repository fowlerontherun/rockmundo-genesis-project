import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { lifecycleFixture, id } from './helpers/lifecycle-fixture.mjs';
async function authoritySql() {
 const files=await readdir(new URL('../../supabase/migrations/',import.meta.url));
 const file=files.find(f=>f.endsWith('_tour_proposal_response_authority.sql'));
 assert.ok(file);
 return readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8');
}
const actor=(db,n)=>db.exec(`SET ROLE authenticated; SET test.actor='${id(n)}'`);
async function openTouring(db) { await actor(db,2); await db.query("SELECT set_support_touring_scope($1,'worldwide','{}',null,null,true,1000)",[id(2)]); }
const send=async(db,request)=>(await db.query('SELECT create_support_tour_proposal($1,$2,$3,$4,$5,$6) AS id',[id(1),id(9),id(2),[id(5),id(7)],id(request),'Join'])).rows[0].id;
const answer=(db,proposal,action)=>db.query('SELECT respond_support_tour_proposal($1,$2) AS state',[proposal,action]);
const snapshots=async(db,proposal)=>(await db.query('SELECT itinerary FROM support_tour_proposals WHERE id=$1',[proposal])).rows[0].itinerary;

test('saved proposals cannot bypass their deadline or route through public legacy APIs',async()=>{
 const db=await lifecycleFixture();
 try {
  await db.exec(await authoritySql()); await openTouring(db); await actor(db,1);
  const expired=await send(db,50); const itinerary=await snapshots(db,expired); const slot=itinerary[0].slot_id;
  await db.exec('RESET ROLE'); await db.query("UPDATE support_tour_proposals SET expires_at=now()-interval '1 minute' WHERE id=$1",[expired]);
  await actor(db,2);
  for(const action of ['accept','decline']) {
   await assert.rejects(db.query('SELECT respond_to_gig_support_offer($1,$2,null)',[slot,action]),/proposal_response_required/);
   await assert.rejects(db.query('SELECT respond_to_tour_support_offers($1,$2)',[JSON.stringify(itinerary),action]),/proposal_response_required/);
  }
  // Notification suppression is not a capability to bypass proposal authority.
  await db.exec("SET app.support_proposal='1'");
  await assert.rejects(db.query("SELECT respond_to_gig_support_offer($1,'accept',null)",[slot]),/proposal_response_required/);
  await assert.rejects(db.query("SELECT private.respond_to_gig_support_offer($1,'accept',null)",[slot]),/permission denied/);
  await assert.rejects(db.query("SELECT private.respond_to_tour_support_offers($1,'accept')",[JSON.stringify(itinerary)]),/permission denied/);
  await db.exec("SET app.support_proposal=''");
  await actor(db,1); assert.equal((await answer(db,expired,'withdraw')).rows[0].state,'expired');
  await actor(db,2); assert.equal((await answer(db,expired,'accept')).rows[0].state,'expired');
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='accepted'")).rows.length,0);
  await actor(db,1); const current=await send(db,51); const currentDates=await snapshots(db,current);
  await db.exec(`RESET ROLE; INSERT INTO auth.users VALUES('${id(3)}'); INSERT INTO profiles(id,user_id) VALUES('${id(3)}','${id(3)}'); INSERT INTO bands(id,leader_id) VALUES('${id(3)}','${id(3)}');
   INSERT INTO tours VALUES('${id(10)}','Other tour','${id(3)}','scheduled',current_date+1,current_date+14);
   INSERT INTO gigs VALUES ('${id(90)}','${id(3)}','${id(3)}',now()+interval '2 days',now()+interval '2 days 3 hours','scheduled','${id(10)}',null),('${id(91)}','${id(3)}','${id(3)}',now()+interval '12 days',now()+interval '12 days 3 hours','scheduled','${id(10)}',null);`);
  await actor(db,3);
  const conflict=(await db.query('SELECT create_support_tour_proposal($1,$2,$3,$4,$5,$6) AS id',[id(3),id(10),id(2),[id(90),id(91)],id(95),'Other tour'])).rows[0].id;
  await actor(db,2);
  await assert.rejects(db.query("SELECT respond_to_gig_support_offer($1,'accept',null)",[currentDates[0].slot_id]),/proposal_response_required/);
  await db.exec(`RESET ROLE; UPDATE profiles SET current_city_id=null WHERE id='${id(2)}'`); await actor(db,2);
  await assert.rejects(answer(db,current,'accept'),/route_location_unknown/);
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='accepted'")).rows.length,0);
  await db.exec(`RESET ROLE; UPDATE profiles SET current_city_id='${id(4)}' WHERE id='${id(2)}'`); await actor(db,2);
  assert.equal((await answer(db,current,'accept')).rows[0].state,'accepted'); await answer(db,current,'accept');
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='accepted'")).rows.length,2);
  assert.equal((await db.query('SELECT status FROM support_tour_proposals WHERE id=$1',[conflict])).rows[0].status,'changed');
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE gig_id=ANY($1) AND status='pending'",[[id(90),id(91)]])).rows.length,0);
  await db.exec('RESET ROLE'); assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,2);
  // Ordinary non-tour invitations still use the legacy per-show response.
  await db.exec(`INSERT INTO band_support_availability(band_id,city_id,status,available_from,available_until) VALUES('${id(2)}','${id(4)}','active',current_date,current_date+10)`);
  await actor(db,1); const legacy=(await db.query('SELECT * FROM create_gig_support_offer($1,$2,$3)',[id(6),id(2),id(60)])).rows[0];
  await actor(db,2); assert.equal((await db.query("SELECT * FROM respond_to_gig_support_offer($1,'accept',null)",[legacy.id])).rows[0].status,'accepted');
  await db.exec(`RESET ROLE; INSERT INTO gigs VALUES ('${id(80)}','${id(1)}','${id(3)}',now()+interval '8 days',now()+interval '8 days 3 hours','scheduled','${id(9)}',null),('${id(81)}','${id(1)}','${id(3)}',now()+interval '10 days',now()+interval '10 days 3 hours','scheduled','${id(9)}',null)`);
  await actor(db,1); await db.query('SELECT create_tour_support_offers($1,$2,$3,$4,$5)',[id(1),id(9),id(2),[id(80),id(81)],id(82)]);
  await db.exec('RESET ROLE');
  const legacyDates=(await db.query(`SELECT s.id slot_id,s.gig_id,g.tour_id,g.scheduled_date,g.scheduled_end,g.venue_id,s.revenue_share FROM gig_support_slots s JOIN gigs g ON g.id=s.gig_id WHERE g.id=ANY($1)`,[[id(80),id(81)]])).rows;
  await actor(db,2);
  await assert.rejects(db.query("SELECT respond_to_tour_support_offers($1,'accept')",[JSON.stringify([legacyDates[0],currentDates[0]])]),/proposal_response_required/);
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE gig_id=ANY($1) AND status='pending'",[[id(80),id(81)]])).rows.length,2);
  await db.query("SELECT respond_to_tour_support_offers($1,'accept')",[JSON.stringify(legacyDates)]);
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE gig_id=ANY($1) AND status='accepted'",[[id(80),id(81)]])).rows.length,2);
  await db.exec('RESET ROLE');
  for(const signature of ['private.respond_to_gig_support_offer(uuid,text,text)','private.respond_to_tour_support_offers(jsonb,text)','private.close_changed_support_proposal(uuid)']) {
   assert.equal((await db.query("SELECT has_function_privilege('authenticated',$1,'EXECUTE') AS allowed",[signature])).rows[0].allowed,false);
  }
 } finally { await db.close(); }
});

test('pending date removal releases the itinerary, repairs old changed proposals and allows replacements',async()=>{
 const db=await lifecycleFixture();
 try {
  await openTouring(db); await actor(db,1);
  const old=await send(db,50); const oldDates=await snapshots(db,old);
  await db.query('SELECT cancel_gig_support_offer($1)',[oldDates[0].slot_id]);
  await actor(db,2); assert.equal((await answer(db,old,'accept')).rows[0].state,'changed');
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='pending'")).rows.length,1);
  await db.exec('RESET ROLE'); await db.exec(await authoritySql());
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='pending'")).rows.length,0);
  await actor(db,1); const next=await send(db,51); const nextDates=await snapshots(db,next);
  await db.query('SELECT cancel_gig_support_offer($1)',[nextDates[0].slot_id]);
  assert.equal((await db.query('SELECT status FROM support_tour_proposals WHERE id=$1',[next])).rows[0].status,'changed');
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='pending'")).rows.length,0);
  await actor(db,2); assert.equal((await answer(db,next,'accept')).rows[0].state,'changed');
  await actor(db,1); const declined=await send(db,52); await actor(db,2);
  assert.equal((await answer(db,declined,'decline')).rows[0].state,'declined');
  await actor(db,1); const withdrawn=await send(db,53);
  assert.equal((await answer(db,withdrawn,'withdraw')).rows[0].state,'withdrawn');
  const timedOut=await send(db,56);
  await db.exec('RESET ROLE');
  const noticeCount=(await db.query('SELECT count(*)::integer AS n FROM player_inbox')).rows[0].n;
  await db.query("UPDATE support_tour_proposals SET expires_at=now()-interval '1 minute' WHERE id=$1",[timedOut]);
  await db.query('SELECT expire_support_tour_proposals()');
  assert.equal((await db.query('SELECT status FROM support_tour_proposals WHERE id=$1',[timedOut])).rows[0].status,'expired');
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM player_inbox")).rows[0].n,noticeCount+2);
  await actor(db,1);
  // Simulate an administrative removal that bypassed the status trigger: fallback must also release dates.
  const missing=await send(db,54); const missingDates=await snapshots(db,missing);
  await db.exec('RESET ROLE'); await db.query('DELETE FROM gig_support_slots WHERE id=$1',[missingDates[0].slot_id]);
  await actor(db,2); assert.equal((await answer(db,missing,'accept')).rows[0].state,'changed');
  assert.equal((await db.query("SELECT * FROM gig_support_slots WHERE status='pending'")).rows.length,0);
  await actor(db,1); const replacement=await send(db,55);
  await actor(db,2); assert.equal((await answer(db,replacement,'accept')).rows[0].state,'accepted');
  const listed=(await db.query('SELECT list_support_tour_proposals($1) AS data',[id(2)])).rows[0].data;
  const listedNext=listed.find(p=>p.id===next);
  assert.equal(listedNext.slot_statuses[nextDates[0].slot_id],'cancelled');
  assert.equal(listedNext.slot_statuses[nextDates[1].slot_id],'expired');
  await db.exec('RESET ROLE'); assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,2);
 } finally { await db.close(); }
});

test('repairing an old partial proposal preserves its confirmed date and member schedule',async()=>{
 const db=await lifecycleFixture();
 try {
  await openTouring(db); await actor(db,1); const old=await send(db,50); const dates=await snapshots(db,old);
  await actor(db,2);
  // Reproduce the pre-fix per-show bypass, then the old changed-proposal response.
  await db.query("SELECT respond_to_gig_support_offer($1,'accept',null)",[dates[0].slot_id]);
  assert.equal((await answer(db,old,'accept')).rows[0].state,'changed');
  await db.exec('RESET ROLE');
  const before=(await db.query('SELECT * FROM player_scheduled_activities')).rows;
  await db.exec(await authoritySql());
  assert.equal((await db.query('SELECT status FROM gig_support_slots WHERE id=$1',[dates[0].slot_id])).rows[0].status,'accepted');
  assert.equal((await db.query('SELECT status FROM gig_support_slots WHERE id=$1',[dates[1].slot_id])).rows[0].status,'expired');
  assert.deepEqual((await db.query('SELECT * FROM player_scheduled_activities')).rows,before);
  await actor(db,1);
  const replacement=(await db.query('SELECT create_support_tour_proposal($1,$2,$3,$4,$5,$6) AS id',[id(1),id(9),id(2),[id(7)],id(51),'Remaining date'])).rows[0].id;
  await actor(db,2); assert.equal((await answer(db,replacement,'accept')).rows[0].state,'accepted');
  await db.exec('RESET ROLE'); assert.equal((await db.query('SELECT * FROM player_scheduled_activities')).rows.length,2);
 } finally { await db.close(); }
});
