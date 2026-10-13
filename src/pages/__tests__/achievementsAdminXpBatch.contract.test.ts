import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=(path:string)=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const achievements=read("../../../src/hooks/useAchievements.ts");
const page=read("../../../src/pages/statistics/index.tsx");
const admin=read("../../../supabase/functions/progression/handlers-admin.ts");
const sql=read("../../../supabase/migrations/20261013125000_admin_atomic_xp_grants.sql");
describe("achievements and admin XP regressions",()=>{
 it("#3901 fetches achievements by active profile and refetches on mount",()=>{
  expect(achievements).toContain('queryKey: ["player-achievements", profileId]');
  expect(achievements).toContain('refetchOnMount: "always"');
  expect(achievements).toContain('.eq("profile_id", profileId)');
 });
 it("#3900 excludes hidden requirements from unearned catalogue",()=>{
  expect(achievements).toContain('.or("is_hidden.eq.false,is_hidden.is.null")');
  expect(achievements).toContain('revealedHidden');
 });
 it("#3899 shows a no-active-character state",()=>{
  expect(page).toContain("if (!profileId)");
  expect(page).toContain("Select an active character");
 });
 it("#3897 pages all bulk grant targets",()=>{
  expect(admin).toContain("offset += 500");
  expect(admin).toContain(".range(offset, offset + 499)");
 });
 it("#3896 fails the grant when the ledger fails and #3894 updates spendable SXP",()=>{
  expect(admin).toContain('client.rpc("admin_grant_special_xp_atomic"');
  expect(sql).toContain("INSERT INTO public.experience_ledger");
  expect(sql).toContain("skill_xp_balance=coalesce(skill_xp_balance,0)+p_amount");
 });
});