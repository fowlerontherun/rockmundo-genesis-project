import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const read=(p:string)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const migration=read("../../../supabase/migrations/20261013155000_atomic_character_recovery.sql");
const hook=read("../../../src/hooks/useCharacterDeath.ts");
describe("character recovery is database-authoritative",()=>{
 it("#3853 refuses fresh recovery if another living character exists",()=>{
  expect(migration).toContain("IF p_parent_profile_id IS NULL AND v_used>0 THEN");
  expect(migration).toContain("LIVING_CHARACTER_EXISTS");
  expect(migration).not.toContain("cash=0");
 });
 it("#3854 serializes recovery and checks purchased character capacity",()=>{
  expect(migration).toContain("FROM auth.users WHERE id=v_user FOR UPDATE");
  expect(migration).toContain("NO_CHARACTER_SLOTS_AVAILABLE");
  expect(migration).toContain("extra_slots_purchased");
  expect(hook.match(/create_recovery_character_atomic/g)?.length).toBe(2);
 });
 it("#3855 commits child and inherited skills in a single transaction",()=>{
  expect(migration).toContain("INSERT INTO public.skill_progress");
  expect(migration).toContain("RETURN v_new");
  expect(migration).toContain("INVALID_DEAD_PARENT");
 });
});