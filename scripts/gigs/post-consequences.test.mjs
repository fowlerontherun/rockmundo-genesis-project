import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../../supabase/migrations/20261008193206_idempotent_gig_consequences.sql', import.meta.url), 'utf8');
const legacy = readFileSync(new URL('../../supabase/migrations/20260816125903_32c4cab2-a36b-427c-a3a4-74467010ffb6.sql', import.meta.url), 'utf8');
const planned = readFileSync(new URL('../../supabase/migrations/20260712090000_post_gig_consequences_live_reputation.sql', import.meta.url), 'utf8');
const gig = '00000000-0000-0000-0000-000000000001';
const band = '00000000-0000-0000-0000-000000000002';
const claim = '00000000-0000-0000-0000-000000000003';
const duplicate = '00000000-0000-0000-0000-000000000004';
function table(source, name) {
  const start = source.indexOf(`CREATE TABLE IF NOT EXISTS public.${name} (`);
  return source.slice(start, source.indexOf('\n);', start) + 3);
}
async function setup(variant, existingEvidence = false) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE bands(id uuid PRIMARY KEY, fans integer DEFAULT 700, balance integer DEFAULT 900);
    CREATE TABLE gigs(id uuid PRIMARY KEY, band_id uuid REFERENCES bands(id), status text,
      result_ready_at timestamptz, completed_at timestamptz);
    CREATE TABLE songs(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY, user_id uuid);
    CREATE TABLE gig_outcomes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),gig_id uuid,
      completed_at timestamptz,overall_rating numeric,actual_attendance integer,new_followers integer);
    CREATE TABLE experience_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),activity_type text,xp_amount integer,metadata jsonb);
    CREATE FUNCTION caller_in_band(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
    CREATE FUNCTION caller_in_gig_band(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
    ${table(variant === 'live' ? legacy : planned, 'gig_post_processing')}
    ${table(variant === 'live' ? legacy : planned, 'gig_consequence_snapshots')}
    INSERT INTO bands(id) VALUES('${band}');
    INSERT INTO gigs VALUES('${gig}','${band}','completed',now(),now());
    INSERT INTO gig_outcomes(gig_id,completed_at,overall_rating,actual_attendance,new_followers)
      VALUES('${gig}',now(),20,100,12);
    INSERT INTO experience_ledger(activity_type,xp_amount,metadata)
      VALUES('gig_performance',15,'{"gig_id":"${gig}"}');
    INSERT INTO gig_post_processing(id,gig_id,status,created_at) VALUES('${claim}','${gig}','processing',now()-interval '1 day');
  `);
  if (variant === 'live') {
    await db.exec(`INSERT INTO gig_post_processing(id,gig_id,status) VALUES('${duplicate}','${gig}','processing')`);
  }
  if (existingEvidence) {
    await db.exec(`INSERT INTO gig_consequence_snapshots(gig_id,category,target_type,target_id,consequence_key,status)
      VALUES('${gig}','live_reputation','band','${band}','live_reputation.overall','positive')`);
  }
  await db.exec(migration);
  return db;
}
async function run(db) {
  return (await db.query(`SELECT process_gig_consequences('${gig}') AS result`)).rows[0].result;
}
async function state(db) {
  return (await db.query(`SELECT jsonb_build_object(
    'band',(SELECT to_jsonb(b) FROM bands b),
    'outcome',(SELECT to_jsonb(o) FROM gig_outcomes o),
    'xp',(SELECT jsonb_agg(x) FROM experience_ledger x),
    'rep',(SELECT jsonb_agg(r) FROM band_live_reputation r),
    'media',(SELECT jsonb_agg(m) FROM gig_media_reviews m),
    'snapshots',(SELECT jsonb_agg(s ORDER BY consequence_key) FROM gig_consequence_snapshots s),
    'processing',(SELECT jsonb_agg(p) FROM gig_post_processing p)) AS state`)).rows[0].state;
}
for (const variant of ['live', 'planned']) {
  test(`${variant} schema: reconcile historical claims, repeat worker without rerolling`, async () => {
    const db = await setup(variant);
    try {
      const before = await state(db);
      assert.equal(before.processing.length, 1);
      if (variant === 'live') {
        assert.equal(before.processing[0].id, claim);
        assert.equal(before.processing[0].audit_history[0].rows[0].id, duplicate);
      }
      assert.deepEqual(await run(db), { status: 'completed', alreadyProcessed: false });
      const settled = await state(db);
      assert.equal(settled.snapshots.length, 4);
      assert.equal(settled.rep[0].experience_count, 1);
      assert.equal(settled.rep[0].overall_score, 57.2);
      assert.equal(settled.media.length, 1);
      assert.deepEqual(settled.band, before.band);
      assert.deepEqual(settled.xp, before.xp);
      assert.deepEqual(settled.outcome, before.outcome);
      assert.deepEqual(await run(db), { status: 'completed', alreadyProcessed: true });
      await Promise.all(Array.from({length: 3}, () => db.query('SELECT process_pending_gig_consequences(100)')));
      assert.deepEqual(await state(db), settled);
      assert.equal((await db.query(`SELECT has_function_privilege('authenticated','process_gig_consequences(uuid)','execute') AS allowed`)).rows[0].allowed, false);
    } finally { await db.close(); }
  });
}
test('failure after reputation write rolls all effects back, then retries exactly once', async () => {
  const db = await setup('live');
  try {
    await db.exec(`CREATE FUNCTION reject_review() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'injected_media_failure'; END$$;
      CREATE TRIGGER reject_review BEFORE INSERT ON gig_media_reviews FOR EACH ROW EXECUTE FUNCTION reject_review();`);
    const failed = await run(db);
    assert.equal(failed.status, 'retry_required');
    let actual = await state(db);
    assert.equal(actual.rep, null);
    assert.equal(actual.snapshots, null);
    assert.equal(actual.processing[0].completed_at, null);
    assert.equal(actual.processing[0].error_snapshot.reason, 'injected_media_failure');
    await db.exec('DROP TRIGGER reject_review ON gig_media_reviews');
    await db.query('SELECT process_pending_gig_consequences(100)');
    actual = await state(db);
    assert.equal(actual.rep[0].experience_count, 1);
    assert.equal(actual.processing[0].status, 'completed');
    assert.equal((await run(db)).alreadyProcessed, true);
  } finally { await db.close(); }
});
test('readiness, missing outcome, missing legacy rewards and zero audience remain truthful', async () => {
  const db = await setup('live');
  try {
    await db.exec(`UPDATE gigs SET result_ready_at=NULL`);
    assert.equal((await run(db)).status, 'pending');
    assert.equal((await state(db)).snapshots, null);
    await db.exec(`UPDATE gigs SET result_ready_at=now(); UPDATE gig_outcomes SET overall_rating=NULL`);
    assert.equal((await run(db)).status, 'retry_required');
    await db.exec(`UPDATE gig_outcomes SET overall_rating=0,actual_attendance=0,new_followers=NULL; DELETE FROM experience_ledger`);
    assert.equal((await run(db)).status, 'completed');
    const actual = await state(db);
    assert.equal(actual.media, null);
    for (const key of ['fans.local_delta','performer.progression']) {
      const row=actual.snapshots.find(s=>s.consequence_key===key);
      assert.equal(row.delta_value, null);
      assert.equal(row.metadata.available, false);
    }
    assert.equal(actual.snapshots.find(s=>s.category==='media').metadata.effect, 'not_applicable');
  } finally { await db.close(); }
});
test('unknown partial evidence is retained and never reapplied, even on repeated workers', async () => {
  const db = await setup('live');
  try {
    await db.exec(`INSERT INTO gig_consequence_snapshots(gig_id,processing_id,category,target_type,target_id,consequence_key,status)
      VALUES('${gig}','${claim}','live_reputation','band','${band}','live_reputation.overall','positive')`);
    assert.equal((await run(db)).status, 'partially_failed');
    const before = await state(db);
    await db.query('SELECT process_pending_gig_consequences(100)');
    assert.deepEqual(await state(db), before);
    assert.equal(before.rep, null);
    assert.equal(before.processing[0].completed_at, null);
  } finally { await db.close(); }
});
test('empty completed claims are repaired rather than trusted', async () => {
  const db=await setup('live');
  try {
    await db.exec(`UPDATE gig_post_processing SET status='completed',completed_at=now()`);
    await db.query('SELECT process_pending_gig_consequences(100)');
    assert.equal((await state(db)).processing[0].status,'completed');
    assert.equal((await state(db)).snapshots.length,4);
  } finally { await db.close(); }
});

 test('historical duplicate reconciliation preserves and reparents pre-existing evidence', async () => {
  const db = await setup('live', true);
  try {
    const before=await state(db);
    assert.equal(before.processing.length,1);
    assert.equal(before.snapshots.length,1);
    assert.equal(before.snapshots[0].processing_id,claim);
    assert.equal((await run(db)).status,'partially_failed');
    assert.deepEqual((await state(db)).snapshots,before.snapshots);
    assert.equal((await state(db)).rep,null);
  } finally { await db.close(); }
});
