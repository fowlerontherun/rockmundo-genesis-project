import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const sql = readFileSync(new URL(
  '../../supabase/migrations/20260713120001_progression_achievements_canonical.sql',
  import.meta.url,
), 'utf8');

const legacyBackfill = sql.match(/UPDATE public\.achievements\s+SET slug = lower\([\s\S]*?WHERE slug IS NULL;/i)?.[0];
const disambiguation = sql.match(/WITH ranked_slug_collisions AS \([\s\S]*?WHERE a\.id = r\.id AND r\.ordinal > 1;/i)?.[0];
const uniqueIndex = sql.match(/CREATE UNIQUE INDEX IF NOT EXISTS achievements_slug_unique ON public\.achievements\(slug\);/i)?.[0];

test('canonical achievement migration deterministically keeps both Road Warriors', async () => {
  assert.ok(legacyBackfill, 'Source has a real slug backfill');
  assert.ok(disambiguation, 'Source repairs duplicate slugs before enforcing index');
  assert.ok(uniqueIndex, 'Source keeps the unique slug index');
  assert.ok(sql.indexOf('WITH ranked_slug_collisions') < sql.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS achievements_slug_unique'),
    'Disambiguate collisions before creating unique index');

  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.achievements (
        id uuid PRIMARY KEY,
        name text NOT NULL,
        category text,
        description text,
        created_at timestamptz NOT NULL,
        slug text
      );
      INSERT INTO public.achievements(id,name,category,description,created_at)
      VALUES
        ('00000000-0000-4000-8000-000000000001','Road Warrior','touring',
         'Complete your first full tour','2025-09-16T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000002','Road Warrior','performance',
         'Play 25 gigs','2026-03-10T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000003','Road Warrior','performance',
         'Play 100 gigs','2026-04-10T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000004','Guitar Hero','skills',
         'Learn guitar','2025-09-20T00:00:00Z');
    `);
    await db.exec(legacyBackfill);
    await db.exec(disambiguation);
    await db.exec(uniqueIndex);
    const { rows } = await db.query(`
      SELECT id::text,name,slug,description
      FROM public.achievements
      ORDER BY created_at
    `);
    assert.equal(rows.length,4,'Every achievement id must be preserved');
    assert.equal(rows[0].slug,'road-warrior','Preserve the earliest slug');
    assert.ok(rows[1].slug.startsWith('road-warrior-'),'Disambiguate later achievement');
    assert.ok(rows[2].slug.startsWith('road-warrior-'),'Disambiguate further achievement');
    assert.equal(rows[3].slug,'guitar-hero');
    assert.equal(new Set(rows.map(r=>r.slug)).size,4);
    const before = rows.map(r=>({id:r.id,slug:r.slug,description:r.description}));
    await db.exec(disambiguation);
    const { rows: after } = await db.query(`
      SELECT id::text,slug,description
      FROM public.achievements ORDER BY created_at
    `);
    assert.deepEqual(after,before,'Reruns must keep stable links and slugs');

    await assert.rejects(db.exec(`
      INSERT INTO public.achievements(id,name,created_at,slug)
      VALUES ('00000000-0000-4000-8000-000000000005','Road Warrior',now(),'road-warrior')
    `), /unique/i);
  } finally { await db.close(); }
});
