import { readFileSync } from 'node:fs';

const [,, inputPath] = process.argv;
if (!inputPath) throw new Error('usage: validate-concurrency-summary.mjs <summary-json>');
let summary;
try { summary = JSON.parse(readFileSync(inputPath, 'utf8')); }
catch (error) { throw new Error(`concurrency summary is missing or malformed: ${error.message}`); }

const required = (object, keys, label) => {
  if (!object || typeof object !== 'object') throw new Error(`${label} must be an object`);
  for (const key of keys) if (!(key in object)) throw new Error(`${label} missing ${key}`);
};
required(summary, ['status', 'runId', 'timestamps', 'results', 'database', 'cleanup', 'assertions'], 'summary');
required(summary.timestamps, ['firstRequestStartedAt', 'pauseReachedAt', 'secondRequestStartedAt', 'releaseRequestedAt', 'firstRequestCompletedAt', 'secondRequestCompletedAt'], 'timestamps');
required(summary.results, ['sameCompanyId', 'sameFestivalCompanyId', 'sameTransactionId', 'originalSuccessCount', 'idempotentReplayCount'], 'results');
required(summary.database, ['companyCount', 'festivalCompanyCount', 'foundingRequestCount', 'transactionCount', 'ledgerEntryCount', 'signedLedgerTotal', 'debitCount'], 'database');
required(summary.cleanup, ['firstRunSucceeded', 'secondRunSucceeded', 'remainingRows'], 'cleanup');
required(summary.assertions, ['total', 'passed', 'failed'], 'assertions');

if (summary.status !== 'passed') throw new Error(`concurrency status must be passed, got ${summary.status}`);
const dates = Object.fromEntries(Object.entries(summary.timestamps).map(([key, value]) => {
  const epoch = Date.parse(value);
  if (typeof value !== 'string' || !Number.isFinite(epoch)) throw new Error(`invalid timestamp ${key}`);
  return [key, epoch];
}));
const t = dates;
if (!(t.firstRequestStartedAt <= t.pauseReachedAt && t.pauseReachedAt <= t.secondRequestStartedAt &&
      t.secondRequestStartedAt < t.releaseRequestedAt &&
      t.releaseRequestedAt <= Math.max(t.firstRequestCompletedAt, t.secondRequestCompletedAt) &&
      t.firstRequestCompletedAt > t.secondRequestStartedAt && t.secondRequestCompletedAt > t.secondRequestStartedAt)) {
  throw new Error('timestamp ordering does not prove request overlap');
}
for (const key of ['sameCompanyId', 'sameFestivalCompanyId', 'sameTransactionId'])
  if (summary.results[key] !== true) throw new Error(`${key} must be true`);
const expected = {
  originalSuccessCount: 1, idempotentReplayCount: 1, companyCount: 1, festivalCompanyCount: 1,
  foundingRequestCount: 1, transactionCount: 1, ledgerEntryCount: 2, signedLedgerTotal: 0, debitCount: 1,
};
for (const [key, value] of Object.entries(expected)) {
  const actual = key in summary.results ? summary.results[key] : summary.database[key];
  if (actual !== value) throw new Error(`${key} must be ${value}, got ${actual}`);
}
if (!summary.cleanup.firstRunSucceeded || !summary.cleanup.secondRunSucceeded || summary.cleanup.remainingRows !== 0)
  throw new Error('cleanup evidence did not pass');
if (!(summary.assertions.total > 0) || summary.assertions.failed !== 0 || summary.assertions.passed !== summary.assertions.total)
  throw new Error('assertion accounting did not pass');
if (/(postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@|password\s*[=:]|supabase_db_url|trusted[_-]?token)/i.test(JSON.stringify(summary)))
  throw new Error('summary contains credential-like text');
console.log(`validated festival concurrency summary: ${inputPath}`);
