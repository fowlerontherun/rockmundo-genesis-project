// #4216: real TWO-CONNECTION test of the production RPC on a disposable local DB.
// Requires psql on PATH and SUPABASE_DB_URL=postgresql://...@localhost/...
// Refuses any remote host. Never run against the live RockMundo economy.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const databaseUrl = process.env.SUPABASE_DB_URL;
assert.ok(databaseUrl, "SUPABASE_DB_URL is required");
const host = new URL(databaseUrl).hostname;
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(host),
  "Only disposable LOCAL Postgres is allowed; never test payouts on production");
const args = [databaseUrl, "-X", "-A", "-t", "-q", "-P", "pager=off", "-v", "ON_ERROR_STOP=1"];

function sql(query) {
  const proc = spawnSync("psql", args, { input: query + "\n", encoding: "utf8", timeout: 30000 });
  if (proc.error || proc.status !== 0) throw new Error(proc.stderr || String(proc.error));
  return proc.stdout.trim();
}
function quote(id) { return "'" + id.replaceAll("'", "''") + "'::uuid"; }
const check = sql("select current_setting('app.allow_test_fixtures',true);");
assert.equal(check, "true", "Set app.allow_test_fixtures=true only on an isolated local fixture database");
const shiftId = randomUUID(), activityId = randomUUID();

// Test fixture uses a real employment/profile on an isolated seed database only.
// Its rows commit so both independent Postgres sessions can observe/lock the same shift.
sql(`BEGIN;
WITH candidate AS (
 SELECT e.id employment_id, e.profile_id, e.job_id
 FROM public.player_employment e JOIN public.profiles p ON p.id=e.profile_id
 WHERE p.user_id IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM public.profile_activity_statuses a WHERE a.profile_id=p.id)
 ORDER BY e.id LIMIT 1
)
INSERT INTO public.shift_history(id,employment_id,profile_id,job_id,shift_date,
 clock_in_time,earnings,xp_earned,status)
SELECT ${quote(shiftId)},employment_id,profile_id,job_id,current_date,
 now()-interval '2 hours',200,25,'in_progress' FROM candidate;
INSERT INTO public.profile_activity_statuses(id,profile_id,activity_type,status,
 started_at,ends_at,metadata)
SELECT ${quote(activityId)},profile_id,'work_shift','active',now()-interval '2 hours',
 now()-interval '1 minute',jsonb_build_object('shift_history_id',id)
FROM public.shift_history WHERE id=${quote(shiftId)};
COMMIT;`);
const baseline = JSON.parse(sql(`select json_build_object(
 'cash',coalesce(p.cash,0),'shifts',coalesce(e.shifts_completed,0),
 'earnings',coalesce(e.total_earnings,0))
 from public.shift_history sh join public.profiles p on p.id=sh.profile_id
 join public.player_employment e on e.id=sh.employment_id
 where sh.id=${quote(shiftId)};`));

// First connection acquires the shift FOR UPDATE lock, settles, then HOLDS the
// transaction. Second connection must wait and eventually see settled:false.
const first = spawn("psql", args, { stdio: ["pipe", "pipe", "pipe"] });
let firstOut = "", firstErr = "";
first.stderr.on("data", b => firstErr += b.toString());
const firstResult = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("first session never produced a receipt")), 15000);
  first.stdout.on("data", b => {
    firstOut += b.toString();
    if (firstOut.includes('"settled": true')) { clearTimeout(timeout); resolve(); }
  });
  first.on("error", reject);
  first.on("exit", code => { if (code !== 0) reject(new Error(firstErr)); });
});
first.stdin.end(`BEGIN;
SELECT public.settle_work_shift_atomic(${quote(activityId)},${quote(shiftId)})::text;
SELECT pg_sleep(3);
COMMIT;
`);
await firstResult;
const second = spawnSync("psql", args, {
 input: `SELECT public.settle_work_shift_atomic(${quote(activityId)},${quote(shiftId)})::text;\n`,
 encoding: "utf8", timeout: 15000,
});
if (second.error || second.status !== 0) throw new Error(second.stderr || String(second.error));
assert.match(firstOut, /"settled": true/);
assert.match(second.stdout, /"settled": false/, "second connection must never pay again");

const outcome = JSON.parse(sql(`SELECT json_build_object(
 'receipts',(SELECT count(*) FROM public.work_shift_settlements WHERE shift_id=sh.id),
 'xp',(SELECT count(*) FROM public.experience_ledger WHERE activity_type='work_shift' AND metadata->>'shift_id'=sh.id::text),
 'tax',(SELECT count(*) FROM public.city_treasury_ledger WHERE type='employment_income_tax' AND reference_id=sh.id),
 'cityTax',(SELECT city_tax FROM public.work_shift_settlements WHERE shift_id=sh.id),
 'net',(SELECT net_earnings FROM public.work_shift_settlements WHERE shift_id=sh.id),
 'cash',p.cash,'shifts',e.shifts_completed,'earnings',e.total_earnings,'status',sh.status)
FROM public.shift_history sh JOIN public.profiles p ON p.id=sh.profile_id
JOIN public.player_employment e ON e.id=sh.employment_id
WHERE sh.id=${quote(shiftId)};`));
assert.equal(outcome.receipts, 1);
assert.equal(outcome.xp, 1);
assert.equal(outcome.tax, outcome.cityTax > 0 ? 1 : 0);
assert.equal(outcome.cash, baseline.cash + outcome.net);
assert.equal(outcome.shifts, baseline.shifts + 1);
assert.equal(outcome.earnings, baseline.earnings + outcome.net);
assert.equal(outcome.status, "completed");
console.log("PASS: independent, overlapping DB connections produced exactly one payroll/XP/tax receipt.");
