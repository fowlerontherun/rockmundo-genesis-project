import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('finance workflow retains every A4 release check in dependency order', () => {
  const workflow = read('.github/workflows/finance-verification.yml');
  const requiredCommands = [
    'npm run verify:dependency-lock',
    'npm ci',
    'npm run verify:dependencies',
    'supabase start --debug',
    'supabase db reset',
    'supabase db lint',
    'supabase test db',
    'npm run test:finance:db',
    'supabase gen types typescript --local',
    'npm run typecheck',
    'npm run lint:ci',
    'npm run test -- --run',
    'npm run build',
    'npm run test:e2e:finance',
  ];

  let previousIndex = -1;
  for (const command of requiredCommands) {
    const index = workflow.indexOf(command);
    assert.notEqual(index, -1, `Finance workflow is missing: ${command}`);
    assert.ok(index > previousIndex, `${command} must run after the preceding release check`);
    previousIndex = index;
  }

  assert.match(workflow, /if: failure\(\)[\s\S]*playwright-report-finance/);
  assert.match(workflow, /if: always\(\)[\s\S]*supabase stop --no-backup/);
});

test('database gate executes the A1 through A4 harnesses and rejects false assertions', () => {
  const runner = read('scripts/finance/run-db-gate.sh');
  const harnesses = [
    'finance_a1_atomic_bookings_harness.sql',
    'finance_a2_replay_refund_mortgage_harness.sql',
    'finance_a3_treasury_ux_harness.sql',
    'finance_a4_reconciliation_gate.sql',
  ];

  let previousIndex = -1;
  for (const harness of harnesses) {
    const index = runner.indexOf(harness);
    assert.notEqual(index, -1, `Database gate is missing: ${harness}`);
    assert.ok(index > previousIndex, `${harness} must follow its prerequisite harness`);
    previousIndex = index;
  }

  assert.match(runner, /ON_ERROR_STOP=1/);
  assert.match(runner, /grep -qx 'f'/);
});

test('browser gate owns finance routes and captures retry diagnostics', () => {
  const config = read('playwright.finance.config.ts');
  const suite = read('tests/finance/rehearsal-funding.spec.ts');

  assert.match(config, /testDir: '\.\/tests\/finance'/);
  assert.match(config, /retries: process\.env\.CI \? 1 : 0/);
  assert.match(config, /trace: 'retain-on-failure'/);
  assert.match(config, /screenshot: 'only-on-failure'/);
  for (const route of ['/rehearsals', '/recording-studios', '/finance/banking/apply', '/finance/mortgages']) {
    assert.ok(suite.includes(`page.goto('${route}')`), `Browser gate is missing route: ${route}`);
  }
});
