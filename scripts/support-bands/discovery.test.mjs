import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const a = '00000000-0000-0000-0000-000000000001';
const b = '00000000-0000-0000-0000-000000000002';
const c = '00000000-0000-0000-0000-000000000003';
const d = '00000000-0000-0000-0000-000000000004';
test('shortlist ownership, idempotency and active labelmate discovery', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      CREATE TABLE public.bands(id uuid PRIMARY KEY);
      CREATE FUNCTION public.can_manage_band_gigs(b uuid, u uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT b=u $$;
      CREATE TABLE public.artist_label_contracts(band_id uuid, label_id uuid, status text, start_date date, end_date date);
      INSERT INTO bands VALUES ('${a}'),('${b}'),('${c}'),('${d}');
      INSERT INTO artist_label_contracts VALUES
        ('${a}','${a}','active',null,null), ('${b}','${a}','active',null,null),
        ('${c}','${a}','active',null,current_date-1), ('${d}','${a}','active',current_date+1,null);
    `);
    await db.exec(await readFile(new URL('../../supabase/migrations/20261106070014_play_together_discovery.sql', import.meta.url), 'utf8'));
    await db.exec(`SET ROLE authenticated; SET test.actor='${a}';`);
    await db.query('SELECT set_band_shortlisted($1,$2,true)', [a,c]);
    await db.query('SELECT set_band_shortlisted($1,$2,true)', [a,c]);
    assert.equal((await db.query('SELECT * FROM band_touring_shortlist')).rows.length, 1);
    const relations = (await db.query('SELECT * FROM get_band_discovery_context($1) ORDER BY band_id', [a])).rows;
    assert.deepEqual(relations, [{band_id:b,shortlisted:false,labelmate:true},{band_id:c,shortlisted:true,labelmate:false}]);
    await assert.rejects(db.query('SELECT set_band_shortlisted($1,$2,true)', [b,c]), /band_discovery_forbidden/);
    await assert.rejects(db.query('SELECT * FROM get_band_discovery_context($1)', [b]), /band_discovery_forbidden/);
    await assert.rejects(db.query('SELECT set_band_shortlisted($1,$2,true)', [a,a]), /check constraint/);
    await assert.rejects(db.query('INSERT INTO band_touring_shortlist VALUES ($1,$2,now())', [b,c]), /row-level security/);
    await db.exec(`SET test.actor='${b}';`);
    assert.equal((await db.query('SELECT * FROM band_touring_shortlist')).rows.length,0);
    await db.query('DELETE FROM band_touring_shortlist WHERE band_id=$1', [a]);
    await db.exec(`SET test.actor='${a}';`);
    assert.equal((await db.query('SELECT * FROM band_touring_shortlist')).rows.length,1);
    await db.query('SELECT set_band_shortlisted($1,$2,false)',[a,c]);
    assert.equal((await db.query('SELECT * FROM band_touring_shortlist')).rows.length,0);
    await db.exec('SET ROLE anon;');
    await assert.rejects(db.query('SELECT * FROM get_band_discovery_context($1)',[a]), /permission denied/);
    await assert.rejects(db.query('SELECT * FROM band_touring_shortlist'), /permission denied/);
  } finally { await db.close(); }
});
