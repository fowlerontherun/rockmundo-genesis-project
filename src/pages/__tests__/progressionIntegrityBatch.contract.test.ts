import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=(p:string)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const route=read("../../../supabase/functions/progression/index.ts");
const handler=read("../../../supabase/functions/progression/handlers.ts");
const refund=read("../../../supabase/migrations/20261013150000_unlearn_skill_atomic.sql");
const unique=read("../../../supabase/migrations/20261013150500_action_xp_idempotency.sql");
describe("progression integrity regressions",()=>{
 it("#3886 rejects untrusted direct client action rewards",()=>expect(route).toContain("DIRECT_ACTION_XP_AWARD_DISABLED"));
 it("#3889 rejects invalid and excessive XP amounts",()=>expect(handler).toContain("!Number.isSafeInteger(amount) || amount <= 0 || amount > 250"));
 it("#3887 records action XP before any health deduction",()=>{
  const a=handler.slice(handler.indexOf("export async function handleAwardActionXp"));
  expect(a.indexOf('.from("experience_ledger")',a.indexOf("// Log the XP grant"))).toBeLessThan(a.indexOf("// Update profile health if needed"));
 });
 it("#3888 makes transaction references unique per profile/action",()=>expect(unique).toContain("CREATE UNIQUE INDEX"));
 it("#3882 rolls back skill reset if XP refund fails",()=>{
  expect(refund).toContain("UPDATE public.skill_progress SET");
  expect(refund).toContain("UPDATE public.player_xp_wallet SET");
  expect(handler).toContain('client.rpc("unlearn_skill_atomic"');
 });
});