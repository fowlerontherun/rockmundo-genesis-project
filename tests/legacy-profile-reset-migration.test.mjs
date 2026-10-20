import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const migrationPath = fileURLToPath(new URL('../supabase/migrations/20250920191743_reset_profile_data.sql', import.meta.url));
const sql = readFileSync(migrationPath, 'utf8');

describe('retired profile reset cannot erase user data on normal migrations', () => {
  it('requires an explicit opt-in and returns before every destructive statement', () => {
    const guard = sql.indexOf("current_setting('rockmundo.allow_profile_data_reset', true) IS DISTINCT FROM 'on'");
    const safeReturn = sql.indexOf('RETURN;', guard);
    const firstTruncate = sql.indexOf('TRUNCATE TABLE');
    assert.ok(guard >= 0, 'operator-controlled off-by-default guard must exist');
    assert.ok(safeReturn > guard && safeReturn < firstTruncate, 'normal migrations must return before truncation');
    assert.equal((sql.match(/TRUNCATE TABLE/g) ?? []).length, 2);
  });

  it('fails closed when the obsolete schema does not contain every required table', () => {
    const preflight = sql.indexOf('to_regclass(required.name) IS NULL');
    const failure = sql.indexOf('RAISE EXCEPTION', preflight);
    const truncate = sql.indexOf('TRUNCATE TABLE');
    assert.ok(preflight >= 0 && failure > preflight && failure < truncate,
      'all historical dependencies must be checked before any data deletion');
    assert.match(sql, /'public.profile_attributes'/);
    assert.match(sql, /'public.profiles'/);
  });

  it('keeps destructive statements in a single guarded PL/pgSQL block', () => {
    assert.match(sql, /^DO \$legacy_reset\$/m);
    assert.match(sql, /END;\s*\$legacy_reset\$;/);
    assert.doesNotMatch(sql, /^TRUNCATE TABLE/m);
  });
});
