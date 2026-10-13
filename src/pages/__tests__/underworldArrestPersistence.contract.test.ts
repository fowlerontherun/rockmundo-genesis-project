import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read=(p:string)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const sql=read("../../../supabase/migrations/20261013170000_underworld_purchase_arrest.sql");
const hook=read("../../../src/hooks/useUnderworldStore.ts");
describe("underworld arrest and imprisonment",()=>{
 it("commits arrest, bail and fame effects in the original purchase transaction",()=>{
  expect(sql).toContain("AFTER INSERT ON public.underworld_purchases");
  expect(sql).toContain("INSERT INTO public.player_imprisonments");
  expect(sql).toContain("bail_amount");
  expect(sql).toContain("original_sentence_days");
  expect(sql).toContain("is_imprisoned=true");
  expect(sql).toContain("fame=greatest(0");
 });
 it("uses the stored incarceration rather than rolling in the browser",()=>{
  expect(hook).toContain('.from("player_imprisonments")');
  expect(hook).toContain('arrestResult: imprisonment ?');
  expect(hook).not.toContain("rollForArrest(");
 });
});