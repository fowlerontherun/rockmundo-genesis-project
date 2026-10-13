import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const worker=readFileSync(fileURLToPath(new URL("../../../supabase/functions/complete-recording-sessions/index.ts",import.meta.url)),"utf8");
describe("recording completion checkpoint",()=>{
 it("does not set terminal status before song update",()=>{
  expect(worker.indexOf("status: 'completed'")).toBeGreaterThan(worker.indexOf("if (songUpdateError) throw songUpdateError"));
  expect(worker).toContain("if (createError) throw createError");
 });
});