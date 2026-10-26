import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const sql = readFileSync(resolve(process.cwd(),
 "supabase/migrations/20251125115645_create_brand_sponsorships.sql"),"utf8");
describe("sponsorship enum migration clean replay", () => {
 it("uses PostgreSQL-compatible conditional enum creation", () => {
  expect(sql).toContain("IF NOT EXISTS (");
  expect(sql).toContain("t.typname='brand_wealth_tier'");
  expect(sql).toContain("CREATE TYPE public.brand_wealth_tier AS ENUM");
  expect(sql).not.toContain("CREATE TYPE IF NOT EXISTS brand_wealth_tier");
 });
 it("still defines the sponsor catalogue, offers, contracts and payouts", () => {
  for(const table of ["brand_partners","brand_offers","brand_contracts","brand_contract_history","brand_payouts"]) {
   expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  }
 });
});
