import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read=(path:string)=>readFileSync(fileURLToPath(new URL(path,import.meta.url)),"utf8");
const sql=read("../../../supabase/migrations/20261013170000_atomic_retirement_finalization.sql");
const client=read("../../../src/utils/retirement.ts");
describe("retirement is all-or-nothing",()=>{
 it("writes Hall of Fame, generation, profile and skills in the same procedure",()=>{
  for(const x of ["INSERT INTO public.hall_of_fame","INSERT INTO public.character_generations",
    "UPDATE public.profiles","DELETE FROM public.skill_progress","INSERT INTO public.skill_progress"])
    expect(sql).toContain(x);
 });
 it("enforces owning user and checks for transaction errors",()=>{
  expect(sql).toContain("user_id=auth.uid()");
  expect(client).toContain('supabase.rpc("finalize_character_retirement"');
  expect(client).toContain("if (error) throw error");
 });
});