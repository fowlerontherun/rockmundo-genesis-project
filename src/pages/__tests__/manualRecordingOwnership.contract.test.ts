import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const dialog=readFileSync(fileURLToPath(new URL("../../../src/components/recording/CompleteRecordingDialog.tsx",import.meta.url)),"utf8");
describe("manual recording completion boundary",()=>{
 it("does not directly mark sessions completed",()=>{
  expect(dialog).not.toMatch(/\.update\(\{\s*status:\s*["']completed/);
  expect(dialog).toContain('status === "completed"');
 });
 it("requires active profile ownership of the session being checked",()=>{
  expect(dialog).toContain('if (!profileId)');
  expect(dialog).toContain('.eq("profile_id", profileId)');
  expect(dialog).toContain("session.profile_id !== profileId");
 });
});