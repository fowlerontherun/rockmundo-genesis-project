import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const source=readFileSync(fileURLToPath(new URL("../../../supabase/migrations/20261012232200_atomic_underworld_transactions.sql",import.meta.url)),"utf8");
describe("underworld atomic migration integrity",()=>{
 it("uses a complete numeric CASE condition for timed boosts",()=>{
  expect(source).toContain("THEN value::numeric > 0 ELSE false END");
  expect(source).not.toContain("value ~ '^[0-9]+([.][0-9]+)?\n");
 });
 it("ends after function permissions, not a dangling duplicate SQL fragment",()=>{
  expect(source.trimEnd().endsWith("TO authenticated;")).toBe(true);
 });
});