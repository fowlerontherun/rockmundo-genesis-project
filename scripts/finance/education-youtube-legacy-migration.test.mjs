import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const readMigration = (name) =>
  readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');

const curatedMigration = readMigration('20250921115854_create_education_youtube_tables.sql');
const compatibilityMigration = readMigration('20250926075937_ead404e2-8dc0-425d-a244-06f4099f9a4c.sql');
const seedMigration = readMigration('20251218065831_f27d3412-2594-49b0-b812-040c8639bdc3.sql');

function statement(sql, pattern, label) {
  const match = sql.match(pattern);
  assert.ok(match, `Missing ${label} statement`);
  return match[0];
}

test('historical YouTube video seeds coexist with curated playlists on clean Postgres replay', async () => {
  const createTable = statement(
    curatedMigration,
    /CREATE TABLE IF NOT EXISTS public\.education_youtube_resources\s*\([\s\S]*?\n\);/,
    'September curated resource table',
  );
  const addCompatibilityColumns = statement(
    compatibilityMigration,
    /ALTER TABLE public\.education_youtube_resources\s+ADD COLUMN IF NOT EXISTS title[\s\S]*?;/,
    'September compatibility columns',
  );
  const videoSeed = statement(
    seedMigration,
    /INSERT INTO public\.education_youtube_resources\s*\([\s\S]*?ON CONFLICT DO NOTHING;/,
    'December video seed',
  );
  const seededCount = (videoSeed.match(/^\('/gm) || []).length;
  assert.ok(seededCount > 40, 'Do not silently remove the historic video seed catalogue');

  const db = new PGlite();
  try {
    await db.exec(createTable);
    await db.exec(`INSERT INTO public.education_youtube_resources
      (collection_key, collection_title, resource_name, resource_format,
       resource_focus, resource_summary, resource_url)
      VALUES ('curated', 'Original playlist', 'Original resource', 'video',
              'guitar', 'Keep existing playlist data', 'https://example.invalid/resource')`);
    await db.exec(addCompatibilityColumns);
    await db.exec(addCompatibilityColumns); // Idempotent when rerun or already applied.
    await db.exec(videoSeed);

    const { rows: counts } = await db.query(`SELECT
      COUNT(*) FILTER (WHERE collection_key = 'curated')::integer AS curated_count,
      COUNT(*) FILTER (WHERE collection_key = 'legacy-education-videos')::integer AS video_count
      FROM public.education_youtube_resources`);
    assert.equal(counts[0].curated_count, 1);
    assert.equal(counts[0].video_count, seededCount);

    const { rows: curated } = await db.query(`SELECT collection_title, resource_name, resource_url
      FROM public.education_youtube_resources WHERE collection_key = 'curated'`);
    assert.deepEqual(curated[0], {
      collection_title: 'Original playlist',
      resource_name: 'Original resource',
      resource_url: 'https://example.invalid/resource',
    });

    const { rows: videos } = await db.query(`SELECT title, resource_name, resource_focus,
      resource_format, resource_summary, resource_url, video_url
      FROM public.education_youtube_resources WHERE title = 'Guitar Basics for Beginners'`);
    assert.equal(videos.length, 1);
    assert.equal(videos[0].resource_name, videos[0].title);
    assert.equal(videos[0].resource_focus, 'Guitar');
    assert.equal(videos[0].resource_format, 'video');
    assert.equal(videos[0].resource_url, videos[0].video_url);
    assert.equal(videos[0].resource_summary, 'Learn first chords and strumming.');
  } finally {
    await db.close();
  }
});
