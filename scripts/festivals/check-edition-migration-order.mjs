import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDir = 'supabase/migrations';
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const foundation = '20291204090000_create_festival_editions.sql';
const corrective = '20291205090000_harden_festival_editions.sql';
if (!files.includes(foundation)) throw new Error('Historical 2029 festival edition foundation migration is missing');
if (!files.includes(corrective)) throw new Error('Corrective festival edition hardening migration is missing');
const correctiveSql = readFileSync(join(migrationsDir, corrective), 'utf8');
const helperIndex = correctiveSql.indexOf('CREATE OR REPLACE FUNCTION public.is_public_festival_edition_status');
const viewIndex = correctiveSql.indexOf('CREATE VIEW public.public_festival_editions');
if (helperIndex < 0 || viewIndex < 0 || helperIndex > viewIndex) {
  throw new Error('Public status helper must be created before public_festival_editions view');
}
const dependentBeforeFoundation = files.filter((file) =>
  file < foundation && /festival.*edition|edition.*festival/i.test(file) &&
  file !== foundation
);
if (dependentBeforeFoundation.length > 0) {
  throw new Error(`Festival edition dependent migrations before foundation: ${dependentBeforeFoundation.join(', ')}`);
}
const notes = 'docs/festivals/EDITION_MIGRATION_NOTES.md';
if (!existsSync(notes) || !/20291204090000/.test(readFileSync(notes, 'utf8'))) {
  throw new Error('Migration notes must document the 20291204090000 anomaly');
}
console.log('festival edition migration order check passed');
