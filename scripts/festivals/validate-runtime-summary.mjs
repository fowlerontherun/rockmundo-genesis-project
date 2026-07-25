import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const [,, inputPath, outputPath = 'festival-runtime-diagnostics/runtime-summary.json'] = process.argv;
if (!inputPath) throw new Error('usage: validate-runtime-summary.mjs <psql-output> [output-json]');
const text = readFileSync(inputPath, 'utf8');
const parseOne = (name) => {
  const matches=[...text.matchAll(new RegExp(`${name}=({.*})`, 'g'))].map(m=>m[1]);
  if (matches.length !== 1) throw new Error(`expected exactly one ${name} line, got ${matches.length}`);
  try { return JSON.parse(matches[0]); } catch (error) { throw new Error(`${name} is not valid JSON: ${error.message}`); }
};
const summary=parseOne('festival_runtime_summary');
summary.cleanupResult=parseOne('festival_runtime_cleanup');
for (const key of ['status','runId','assertionTotals','balancesBefore','balancesAfter','runtimeCounts','idempotencyResult','rollbackResult','cleanupResult'])
  if (!(key in summary)) throw new Error(`runtime summary missing ${key}`);
if (summary.status !== 'passed') throw new Error(`runtime status must be passed, got ${summary.status}`);
if (!(summary.assertionTotals?.ran > 0) || summary.assertionTotals.failed !== 0 || summary.assertionTotals.passed !== summary.assertionTotals.ran)
  throw new Error('runtime assertion accounting did not pass');
const counts=summary.runtimeCounts;
const expected={successfulCompanyCount:3,successfulFestivalCompanyCount:3,successfulFoundingRequestCount:3,successfulRuntimeTransactionCount:3,successfulRuntimeLedgerEntryCount:6,primaryFoundingTransactionCount:1,signedLedgerTotal:0};
for (const [key,value] of Object.entries(expected)) if (counts?.[key] !== value) throw new Error(`${key} must be ${value}, got ${counts?.[key]}`);
const idem=summary.idempotencyResult;
if (!idem?.sameCompanyId || !idem.sameFestivalCompanyId || !idem.sameTransactionId || idem.duplicateDebitCount !== 1)
  throw new Error('idempotency evidence did not pass');
for (const name of ['postExtension','postDebit']) {
  const proof=summary.rollbackResult?.[name];
  if (!proof?.failureObserved) throw new Error(`${name} failure was not observed`);
  for (const key of ['companyRows','festivalCompanyRows','shareholderRows','foundingRequestRows','auditRows','transactionRows','ledgerRows','companyTransactionRows'])
    if (proof[key] !== 0) throw new Error(`${name}.${key} must be zero, got ${proof[key]}`);
  if (!proof.balanceRestored || !proof.profilesCashRestored) throw new Error(`${name} balances were not restored`);
}
if (!summary.rollbackResult.postDebit.retrySucceeded || summary.rollbackResult.postDebit.retryTransactionRows !== 1 || summary.rollbackResult.postDebit.retryLedgerRows !== 2)
  throw new Error('postDebit successful retry evidence did not pass');
const cleanup=summary.cleanupResult;
if (!cleanup.firstRunSucceeded || !cleanup.secondRunSucceeded || cleanup.remainingRows !== 0 || cleanup.secondRunRemovedRows !== 0)
  throw new Error('cleanup evidence did not pass');
if (/(postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@|password\s*[=:]|supabase_db_url|trusted[_-]?token)/i.test(JSON.stringify(summary)))
  throw new Error('summary contains credential-like text');
mkdirSync(outputPath.split('/').slice(0,-1).join('/') || '.', {recursive:true});
writeFileSync(outputPath, `${JSON.stringify(summary,null,2)}\n`);
console.log(`validated festival runtime summary: ${outputPath}`);
