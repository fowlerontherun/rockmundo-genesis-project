import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDir = 'supabase/migrations';
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const foundation = '20291204090000_create_festival_editions.sql';
const corrective = '20291205090000_harden_festival_editions.sql';
const booking = '20291206090000_festival_booking_contracts.sql';
const hardening = '20291207090000_harden_festival_booking_contracts.sql';
if (!files.includes(foundation)) throw new Error('Historical 2029 festival edition foundation migration is missing');
if (!files.includes(corrective)) throw new Error('Corrective festival edition hardening migration is missing');
if (!files.includes(booking)) throw new Error('Canonical festival booking migration is missing');
if (!files.includes(hardening)) throw new Error('Canonical festival booking hardening migration is missing');
if (!(hardening > booking)) throw new Error('Canonical booking hardening migration must sort after 20291206090000 booking foundation');
if (!(booking > corrective)) throw new Error('Canonical booking migration must sort after 20291205090000 hardening migration');
const correctiveSql = readFileSync(join(migrationsDir, corrective), 'utf8');
const helperIndex = correctiveSql.indexOf('CREATE OR REPLACE FUNCTION public.is_public_festival_edition_status');
const viewIndex = correctiveSql.indexOf('CREATE VIEW public.public_festival_editions');
if (helperIndex < 0 || viewIndex < 0 || helperIndex > viewIndex) {
  throw new Error('Public status helper must be created before public_festival_editions view');
}
const bookingSql = readFileSync(join(migrationsDir, booking), 'utf8');
const hardeningSql = readFileSync(join(migrationsDir, hardening), 'utf8');
if (!/festival_editions/.test(bookingSql) || !/public_festival_editions_read/.test(bookingSql)) {
  throw new Error('Booking migration must reference canonical editions and include public-read correction before booking reads');
}
if (bookingSql.indexOf('public_festival_editions_read') > bookingSql.indexOf('festival_applications')) {
  throw new Error('Public edition read correction must appear before public booking tables');
}
if (!/20291206090000_festival_booking_contracts/.test(hardeningSql) && !/PR #1193|booking foundation/i.test(hardeningSql)) {
  throw new Error('Hardening migration must explicitly reference the booking foundation it corrects');
}
if (!/festival_booking_requests/.test(hardeningSql) || !/festival_stage_slot_reservations/.test(hardeningSql)) {
  throw new Error('Hardening migration must add request idempotency and slot reservations');
}
const dependentBeforeFoundation = files.filter((file) =>
  file < foundation && /festival.*edition|edition.*festival/i.test(file) &&
  file !== foundation
);
if (dependentBeforeFoundation.length > 0) {
  throw new Error(`Festival edition dependent migrations before foundation: ${dependentBeforeFoundation.join(', ')}`);
}
const notes = 'docs/festivals/EDITION_MIGRATION_NOTES.md';
if (!existsSync(notes) || !/20291204090000/.test(readFileSync(notes, 'utf8')) || !/20291206090000/.test(readFileSync(notes, 'utf8')) || !/20291207090000/.test(readFileSync(notes, 'utf8'))) {
  throw new Error('Migration notes must document the 20291204090000 anomaly, booking migration, and hardening correction');
}
console.log('festival edition migration order check passed');
