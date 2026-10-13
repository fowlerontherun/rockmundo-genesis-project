import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read=(p:string)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const worker=read("../../../supabase/functions/complete-recording-sessions/index.ts");
const dialog=read("../../../src/components/recording/CompleteRecordingDialog.tsx");
const hook=read("../../../src/hooks/useAutoRecordingCompletion.ts");
describe("manual recording trust boundary",()=>{
 it("only allows the signed-in player to request an owned due session",()=>{
  expect(worker).toContain("supabase.auth.getUser(bearer)");
  expect(worker).toContain(".eq('profile_id', payload.profileId)");
  expect(worker).toContain(".eq('user_id', auth.user.id)");
  expect(worker).toContain("Date.parse(owned.scheduled_end) > Date.now()");
  expect(worker).toContain("sessionsQuery.eq('id', manuallyRequestedSessionId)");
 });
 it("blocks unauthenticated global processing and browser auto triggers",()=>{
  expect(worker).toContain("Global recording processing requires service authentication");
  expect(hook).not.toContain("functions.invoke('complete-recording-sessions'");
 });
 it("uses authoritative worker and waits for real completed status",()=>{
  expect(dialog).toContain('functions.invoke("complete-recording-sessions"');
  expect(dialog).toContain("body: { sessionId, profileId");
  expect(dialog).toContain('updated.status === "completed"');
  expect(dialog).not.toMatch(/\.update\(\{\s*status:\s*["']completed/);
 });
});