import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const canonical = readFileSync(new URL(
  '../../supabase/migrations/20260712193517_create_canonical_skill_catalogue.sql',
  import.meta.url,
), 'utf8');
const expansion = canonical.match(/ALTER TABLE public\.skill_definitions\s+[\s\S]*?;/i)?.[0];
const seededCatalogue = canonical.match(/WITH seed\(slug, display_name,[\s\S]*?ON CONFLICT \(slug\) DO UPDATE SET[\s\S]*?;/i)?.[0];

test('July canonical skill seed bootstraps missing unlock levels before insert', async () => {
  assert.ok(expansion, 'Expected the real canonical skill ALTER');
  assert.match(expansion,
    /ADD COLUMN IF NOT EXISTS default_unlock_level integer NOT NULL DEFAULT 0/i);
  assert.ok(seededCatalogue, 'Expected the historical canonical seed');
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE public.skill_definitions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text NOT NULL UNIQUE,
        display_name text NOT NULL,
        description text,
        tier_caps jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      INSERT INTO public.skill_definitions(slug,display_name,description)
      VALUES ('guitar','Old Guitar','Player progress-compatible legacy row');
    `);
    await db.exec(expansion);
    await db.exec(seededCatalogue);

    const { rows } = await db.query(`
      SELECT count(*)::int AS count,
        count(*) FILTER (WHERE default_unlock_level = 0)::int AS unblocked
      FROM public.skill_definitions
      WHERE slug IN ('guitar','vocals','drums','bass','performance','songwriting','composition','technical')
    `);
    assert.deepEqual(rows[0], {count:8,unblocked:8});
    await db.exec(expansion);
    await db.exec(seededCatalogue);
    const { rows: replayed } = await db.query(`
      SELECT count(*)::int AS count FROM public.skill_definitions
    `);
    assert.equal(replayed[0].count,8,'Rerun must not duplicate canonical skills');
  } finally {
    await db.close();
  }
});

test('September legacy unlock migration uses the canonical field established in July', () => {
  const september = readFileSync(new URL(
    '../../supabase/migrations/20260923110000_normalize_skills.sql',
    import.meta.url,
  ), 'utf8');
  assert.match(september, /sd\.default_unlock_level/);
  assert.match(expansion, /default_unlock_level integer NOT NULL DEFAULT 0/);
});
