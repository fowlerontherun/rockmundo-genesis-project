import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const root = '../supabase/migrations/';
const sql = (name) => readFileSync(fileURLToPath(new URL(root + name, import.meta.url)), 'utf8');
const september = sql('20250919082339_create_public_universities.sql');
const october = sql('20251007090213_b9318898-e8af-43af-8eb9-f208cb95542b.sql');

describe('2025 university schema continuity during clean Supabase replay', () => {
  it('recognises the September course_cost origin and idempotent October CREATE', () => {
    assert.match(september, /course_cost NUMERIC\(12,\s*2\)/i);
    assert.match(september, /CONSTRAINT universities_name_city_unique UNIQUE \(name, city\)/i);
    assert.match(october, /CREATE TABLE IF NOT EXISTS public\.universities/i);
  });

  it('adds the later tuition multiplier and description before referencing them', () => {
    const alter = october.indexOf('ALTER TABLE public.universities\n  ADD COLUMN IF NOT EXISTS course_cost_modifier');
    const courses = october.indexOf('-- Create university_courses table');
    const seed = october.indexOf('INSERT INTO public.universities (');
    assert.ok(alter >= 0 && alter < courses && courses < seed);
    assert.match(october, /ADD COLUMN IF NOT EXISTS course_cost_modifier NUMERIC NOT NULL DEFAULT 1\.0/i);
    assert.match(october, /CHECK \(course_cost_modifier >= 0\.5 AND course_cost_modifier <= 2\.0\)/i);
    assert.match(october, /ADD COLUMN IF NOT EXISTS description TEXT/i);
    assert.match(october, /ADD COLUMN IF NOT EXISTS updated_at/i);
  });

  it('retains original university amounts and does not destroy or reprice existing rows', () => {
    assert.doesNotMatch(october, /(?:DROP TABLE|TRUNCATE TABLE|DROP COLUMN|ALTER COLUMN course_cost|UPDATE public\.universities SET course_cost)/i);
    assert.match(october, /ON CONFLICT \(name, city\) DO UPDATE/);
    assert.match(october, /ALTER TABLE public\.universities ENABLE ROW LEVEL SECURITY/);
  });
});
