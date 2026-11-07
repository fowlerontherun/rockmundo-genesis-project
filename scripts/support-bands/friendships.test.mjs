import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
test('friendships require recipient consent and preserve privacy and request cooldown',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA auth;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA auth TO authenticated;
   CREATE TABLE bands(id uuid PRIMARY KEY,name text,status text);
   CREATE FUNCTION can_manage_band_gigs(b uuid,u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT COALESCE(b=u,false) $$;
   INSERT INTO bands VALUES ('${id(1)}','A','active'),('${id(2)}','B','active'),('${id(3)}','C','active');`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261107152322_band_touring_friendships.sql',import.meta.url),'utf8'));
  const actor=async n=>db.exec(`SET ROLE authenticated; SET test.actor='${id(n)}';`);
  const act=(a,b,action)=>db.query('SELECT change_band_friendship($1,$2,$3)',[id(a),id(b),action]);
  const list=async a=>(await db.query('SELECT * FROM list_band_friendships($1)',[id(a)])).rows;
  await actor(1); await act(1,2,'request'); await act(1,2,'request');
  assert.deepEqual(await list(1),[{band_id:id(2),band_name:'B',status:'pending',incoming:false}]);
  await assert.rejects(act(1,2,'accept'),/recipient_required/);
  await assert.rejects(act(1,1,'request'),/friendship_invalid/);
  await actor(3);
  assert.equal((await db.query('SELECT * FROM band_touring_friendships')).rows.length,0);
  await assert.rejects(list(1),/forbidden/);
  await assert.rejects(act(2,1,'accept'),/forbidden/);
  await assert.rejects(db.query("UPDATE band_touring_friendships SET status='accepted'"),/permission denied/);
  await actor(2); await act(2,1,'request'); // Reciprocal request is not consent.
  assert.equal((await list(2))[0].status,'pending');
  await act(2,1,'accept'); await act(2,1,'accept');
  assert.equal((await list(2))[0].status,'accepted');
  await actor(1); assert.equal((await list(1))[0].status,'accepted');
  await act(1,2,'remove'); assert.equal((await list(1)).length,0);
  await act(1,2,'request');
  await actor(2); await act(2,1,'decline');
  await actor(1); await assert.rejects(act(1,2,'request'),/cooldown/);
  await assert.rejects(act(1,2,'remove'),/not_active/); // Cannot clear the cooldown.
  await db.exec("RESET ROLE; UPDATE band_touring_friendships SET updated_at=now()-interval '8 days'");
  await actor(1); await act(1,2,'request'); await act(1,2,'remove');
  await actor(2); await assert.rejects(act(2,1,'accept'),/not_pending/);
  await db.exec('SET ROLE anon'); await assert.rejects(list(1),/permission denied/);
 } finally { await db.close(); }
});
