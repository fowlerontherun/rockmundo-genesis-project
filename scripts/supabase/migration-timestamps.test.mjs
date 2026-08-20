import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const verifier = readFileSync(new URL('./verify-migration-timestamps.mjs', import.meta.url), 'utf8');

test('Festival exception is an exact allowlist rather than a date-prefix regex', () => {
  assert.match(verifier, /new Set\(\[/);
  assert.doesNotMatch(verifier, /\^2029121\[78\]/);
  assert.match(verifier, /festivalRuntimeWorkerContinuation/);
  assert.doesNotMatch(verifier, /20291218_release_finance_consistency\.sql/);
});
