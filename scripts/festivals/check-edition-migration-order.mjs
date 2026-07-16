import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDir = 'supabase/migrations';
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const foundation = '20291204090000_create_festival_editions.sql';
const corrective = '20291205090000_harden_festival_editions.sql';
const booking = '20291206090000_festival_booking_contracts.sql';
if (!files.includes(foundation)) throw new Error('Historical 2029 festival edition foundation migration is missing');
if (!files.includes(corrective)) throw new Error('Corrective festival edition hardening migration is missing');
if (!files.includes(booking)) throw new Error('Canonical festival booking migration is missing');
if (!(booking > corrective)) throw new Error('Canonical booking migration must sort after 20291205090000 hardening migration');
const correctiveSql = readFileSync(join(migrationsDir, corrective), 'utf8');
const helperIndex = correctiveSql.indexOf('CREATE OR REPLACE FUNCTION public.is_public_festival_edition_status');
const viewIndex = correctiveSql.indexOf('CREATE VIEW public.public_festival_editions');
if (helperIndex < 0 || viewIndex < 0 || helperIndex > viewIndex) {
  throw new Error('Public status helper must be created before public_festival_editions view');
}
const bookingSql = readFileSync(join(migrationsDir, booking), 'utf8');
if (!/festival_editions/.test(bookingSql) || !/public_festival_editions_read/.test(bookingSql)) {
  throw new Error('Booking migration must reference canonical editions and include public-read correction before booking reads');
}
if (bookingSql.indexOf('public_festival_editions_read') > bookingSql.indexOf('festival_applications')) {
  throw new Error('Public edition read correction must appear before public booking tables');
}
const dependentBeforeFoundation = files.filter((file) =>
  file < foundation && /festival.*edition|edition.*festival/i.test(file) &&
  file !== foundation
);
if (dependentBeforeFoundation.length > 0) {
  throw new Error(`Festival edition dependent migrations before foundation: ${dependentBeforeFoundation.join(', ')}`);
}
const notes = 'docs/festivals/EDITION_MIGRATION_NOTES.md';
if (!existsSync(notes) || !/20291204090000/.test(readFileSync(notes, 'utf8')) || !/20291206090000/.test(readFileSync(notes, 'utf8'))) {
  throw new Error('Migration notes must document the 20291204090000 anomaly and booking dependent migration');
}
console.log('festival edition migration order check passed');
