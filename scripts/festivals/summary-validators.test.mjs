import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
const run=(script,input,output) => spawnSync(process.execPath,[join(root,'scripts/festivals',script),input,...(output?[output]:[])],{encoding:'utf8'});
const dir=()=>mkdtempSync(join(tmpdir(),'festival-summary-'));
const concurrency=()=>({status:'passed',runId:'frt-fixture',timestamps:{firstRequestStartedAt:'2026-01-01T00:00:00.000Z',pauseReachedAt:'2026-01-01T00:00:01.000Z',secondRequestStartedAt:'2026-01-01T00:00:02.000Z',releaseRequestedAt:'2026-01-01T00:00:03.000Z',firstRequestCompletedAt:'2026-01-01T00:00:04.000Z',secondRequestCompletedAt:'2026-01-01T00:00:05.000Z'},responses:{sameCompanyId:true,sameFestivalCompanyId:true,sameTransactionId:true,originalSuccessCount:1,idempotentReplayCount:1},database:{companyCount:1,festivalCompanyCount:1,shareholderCount:1,foundingRequestCount:1,transactionCount:1,ledgerEntryCount:2,signedLedgerTotal:0,debitCount:1},cleanup:{firstRunSucceeded:true,firstRunRemovedRows:12,secondRunSucceeded:true,secondRunRemovedRows:0,remainingRows:0},assertions:{total:16,passed:16,failed:0}});
const runtime=()=>({status:'passed',runId:'runtime-fixture',assertionTotals:{ran:35,passed:35,failed:0},balancesBefore:{},balancesAfter:{},runtimeCounts:{successfulCompanyCount:3,successfulFestivalCompanyCount:3,successfulFoundingRequestCount:3,successfulRuntimeTransactionCount:3,successfulRuntimeLedgerEntryCount:6,primaryFoundingTransactionCount:1,signedLedgerTotal:0},idempotencyResult:{sameCompanyId:true,sameFestivalCompanyId:true,sameTransactionId:true,duplicateDebitCount:1},rollbackResult:{postExtension:{failureObserved:true,companyRows:0,festivalCompanyRows:0,shareholderRows:0,foundingRequestRows:0,auditRows:0,transactionRows:0,ledgerRows:0,companyTransactionRows:0,balanceRestored:true,profilesCashRestored:true},postDebit:{failureObserved:true,companyRows:0,festivalCompanyRows:0,shareholderRows:0,foundingRequestRows:0,auditRows:0,transactionRows:0,ledgerRows:0,companyTransactionRows:0,balanceRestored:true,profilesCashRestored:true,retrySucceeded:true,retryTransactionRows:1,retryLedgerRows:2}}});
const cleanup={firstRunSucceeded:true,secondRunSucceeded:true,remainingRows:0,secondRunRemovedRows:0};

describe('festival summary validators',()=>{
 it('accepts valid concurrency and runtime evidence and writes no credentials',()=>{const d=dir(),c=join(d,'c.json'),l=join(d,'r.log'),o=join(d,'out.json');writeFileSync(c,JSON.stringify(concurrency()));writeFileSync(l,`festival_runtime_summary=${JSON.stringify(runtime())}\nfestival_runtime_cleanup=${JSON.stringify(cleanup)}\n`);expect(run('validate-concurrency-summary.mjs',c).status).toBe(0);expect(run('validate-runtime-summary.mjs',l,o).status).toBe(0);expect(readFileSync(o,'utf8')).not.toMatch(/postgresql:\/\/|password|trustedToken/i)});
 it.each([
  ['missing file',null],['malformed','{bad'],['missing property',JSON.stringify({...concurrency(),database:undefined})],
  ['zero assertions',JSON.stringify({...concurrency(),assertions:{total:0,passed:0,failed:0}})],
  ['failed assertions',JSON.stringify({...concurrency(),assertions:{total:1,passed:0,failed:1}})],
  ['non-zero signed ledger',JSON.stringify({...concurrency(),database:{...concurrency().database,signedLedgerTotal:1}})],
  ['incorrect counts',JSON.stringify({...concurrency(),database:{...concurrency().database,transactionCount:2}})],
  ['false cleanup',JSON.stringify({...concurrency(),cleanup:{...concurrency().cleanup,firstRunSucceeded:false}})],
  ['missing timestamp',JSON.stringify({...concurrency(),timestamps:{...concurrency().timestamps,pauseReachedAt:undefined}})],
  ['invalid timestamp',JSON.stringify({...concurrency(),timestamps:{...concurrency().timestamps,pauseReachedAt:'not-a-date'}})],
  ['invalid timestamp ordering',JSON.stringify({...concurrency(),timestamps:{...concurrency().timestamps,releaseRequestedAt:'2025-01-01T00:00:00Z'}})],
  ['mismatched returned IDs',JSON.stringify({...concurrency(),responses:{...concurrency().responses,sameTransactionId:false}})],
  ['duplicate debit',JSON.stringify({...concurrency(),database:{...concurrency().database,debitCount:2}})],
  ['incorrect ledger count',JSON.stringify({...concurrency(),database:{...concurrency().database,ledgerEntryCount:3}})],
 ])('rejects concurrency %s',(_,content)=>{const d=dir(),p=join(d,'input.json');if(content!==null)writeFileSync(p,content);expect(run('validate-concurrency-summary.mjs',p).status).not.toBe(0)});
 it('rejects multiple runtime summaries',()=>{const d=dir(),p=join(d,'r.log'),line=`festival_runtime_summary=${JSON.stringify(runtime())}\n`;writeFileSync(p,line+line+`festival_runtime_cleanup=${JSON.stringify(cleanup)}\n`);expect(run('validate-runtime-summary.mjs',p).status).not.toBe(0)});
 it.each([['malformed','{bad'],['missing property',JSON.stringify({...runtime(),runtimeCounts:undefined})],['zero assertions',JSON.stringify({...runtime(),assertionTotals:{ran:0,passed:0,failed:0}})],['failed assertions',JSON.stringify({...runtime(),assertionTotals:{ran:1,passed:0,failed:1}})],['false rollback',JSON.stringify({...runtime(),rollbackResult:{...runtime().rollbackResult,postExtension:{...runtime().rollbackResult.postExtension,failureObserved:false}}})]])('rejects runtime %s',(_,summary)=>{const d=dir(),p=join(d,'r.log');writeFileSync(p,`festival_runtime_summary=${summary}\nfestival_runtime_cleanup=${JSON.stringify(cleanup)}\n`);expect(run('validate-runtime-summary.mjs',p).status).not.toBe(0)});
 it('rejects missing runtime summary and false cleanup',()=>{const d=dir(),missing=join(d,'missing.log'),bad=join(d,'bad.log');writeFileSync(missing,'ordinary log\n');writeFileSync(bad,`festival_runtime_summary=${JSON.stringify(runtime())}\nfestival_runtime_cleanup=${JSON.stringify({...cleanup,secondRunSucceeded:false})}\n`);expect(run('validate-runtime-summary.mjs',missing).status).not.toBe(0);expect(run('validate-runtime-summary.mjs',bad).status).not.toBe(0)});
});
