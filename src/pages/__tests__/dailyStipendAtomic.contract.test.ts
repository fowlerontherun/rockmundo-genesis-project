import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const sql=readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261013113000_atomic_daily_stipend.sql",import.meta.url)),"utf8");
const code=readFileSync(fileURLToPath(new URL("../../../supabase/functions/progression/handlers.ts",import.meta.url)),"utf8");
describe("stipend claim integrity",()=>{
 it("#3877 uses current grant schema",()=>{
  expect(sql).toContain("xp_awarded,metadata");
  expect(sql).not.toContain("attribute_points_amount");
  expect(code).toContain('client.rpc("claim_daily_stipend_atomic"');
 });
 it("#3878 credits wallet in same transaction as unique grant",()=>{
  expect(sql).toContain("INSERT INTO public.profile_daily_xp_grants");
  expect(sql).toContain("UPDATE public.player_xp_wallet SET");
  expect(sql).toContain("DAILY_STIPEND_ALREADY_CLAIMED");
 });
 it("#3879 compares UTC dates instead of local hours",()=>{
  expect(sql).toContain("AT TIME ZONE 'UTC'");
  expect(code).toContain('T00:00:00Z');
  expect(code).not.toContain("d1.setHours");
 });
});