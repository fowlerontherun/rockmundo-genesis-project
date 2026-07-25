import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const required = (object, keys, label) => {
  if (!object || typeof object !== 'object') throw new Error(`${label} must be an object`);
  for (const key of keys) if (!(key in object)) throw new Error(`${label} missing ${key}`);
};

export function validateConcurrencySummary(summary) {
  required(summary, ['status', 'runId', 'timestamps', 'responses', 'database', 'cleanup', 'assertions'], 'summary');
  if (typeof summary.runId !== 'string' || !summary.runId.trim()) throw new Error('runId must be non-empty');
  required(summary.timestamps, ['firstRequestStartedAt', 'pauseReachedAt', 'secondRequestStartedAt', 'releaseRequestedAt', 'firstRequestCompletedAt', 'secondRequestCompletedAt'], 'timestamps');
  required(summary.responses, ['sameCompanyId', 'sameFestivalCompanyId', 'sameTransactionId', 'originalSuccessCount', 'idempotentReplayCount'], 'responses');
  required(summary.database, ['companyCount', 'festivalCompanyCount', 'shareholderCount', 'foundingRequestCount', 'transactionCount', 'ledgerEntryCount', 'signedLedgerTotal', 'debitCount'], 'database');
  required(summary.cleanup, ['firstRunSucceeded', 'firstRunRemovedRows', 'secondRunSucceeded', 'secondRunRemovedRows', 'remainingRows'], 'cleanup');
  required(summary.assertions, ['total', 'passed', 'failed'], 'assertions');
  if (summary.status !== 'passed') throw new Error(`concurrency status must be passed, got ${summary.status}`);
  const dates = Object.fromEntries(Object.entries(summary.timestamps).map(([key, value]) => {
    const epoch = typeof value === 'string' ? Date.parse(value) : NaN;
    if (!Number.isFinite(epoch)) throw new Error(`invalid timestamp ${key}`);
    return [key, epoch];
  }));
  const t = dates;
  if (!(t.firstRequestStartedAt <= t.pauseReachedAt && t.pauseReachedAt <= t.secondRequestStartedAt &&
        t.secondRequestStartedAt < t.releaseRequestedAt &&
        t.firstRequestCompletedAt > t.secondRequestStartedAt && t.secondRequestCompletedAt > t.secondRequestStartedAt))
    throw new Error('timestamp ordering does not prove request overlap');
  for (const key of ['sameCompanyId', 'sameFestivalCompanyId', 'sameTransactionId'])
    if (summary.responses[key] !== true) throw new Error(`${key} must be true`);
  const expected = { originalSuccessCount: 1, idempotentReplayCount: 1, companyCount: 1,
    festivalCompanyCount: 1, shareholderCount: 1, foundingRequestCount: 1, transactionCount: 1,
    ledgerEntryCount: 2, signedLedgerTotal: 0, debitCount: 1 };
  for (const [key, value] of Object.entries(expected)) {
    const actual = key in summary.responses ? summary.responses[key] : summary.database[key];
    if (actual !== value) throw new Error(`${key} must be ${value}, got ${actual}`);
  }
  if (!summary.cleanup.firstRunSucceeded || !summary.cleanup.secondRunSucceeded ||
      !Number.isInteger(summary.cleanup.firstRunRemovedRows) || summary.cleanup.firstRunRemovedRows < 0 ||
      !Number.isInteger(summary.cleanup.secondRunRemovedRows) || summary.cleanup.secondRunRemovedRows < 0 ||
      summary.cleanup.remainingRows !== 0) throw new Error('cleanup evidence did not pass');
  if (!(summary.assertions.total > 0) || summary.assertions.failed !== 0 || summary.assertions.passed !== summary.assertions.total)
    throw new Error('assertion accounting did not pass');
  if (/(postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@|password\s*[=:]|supabase_db_url|trusted[_-]?token)/i.test(JSON.stringify(summary)))
    throw new Error('summary contains credential-like text');
  return summary;
}

export function validateConcurrencySummaryFile(inputPath) {
  let summary;
  try { summary = JSON.parse(readFileSync(inputPath, 'utf8')); }
  catch (error) { throw new Error(`concurrency summary is missing or malformed: ${error.message}`); }
  return validateConcurrencySummary(summary);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('usage: validate-concurrency-summary.mjs <summary-json>');
  validateConcurrencySummaryFile(inputPath);
  console.log(`validated festival concurrency summary: ${inputPath}`);
}
