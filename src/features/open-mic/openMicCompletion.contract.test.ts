import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync("src/pages/PerformOpenMic.tsx", "utf8");
const processSource = readFileSync("supabase/functions/process-open-mic-song/index.ts", "utf8");
const completeSource = readFileSync("supabase/functions/complete-open-mic/index.ts", "utf8");
const configSource = readFileSync("supabase/config.toml", "utf8");

describe("Open Mic completion recovery contract", () => {
  it("derives live progress from persisted timestamps and guards concurrent completion", () => {
    expect(pageSource).toContain("getOpenMicSongStartedAtMs(");
    expect(pageSource).toContain("getOpenMicSongRemainingMs(");
    expect(pageSource).toContain("processingRef.current");
    expect(pageSource).not.toContain("setCurrentSongProgress(prev =>");
  });

  it("authenticates and owns every song-processing request", () => {
    expect(processSource).toContain("authClient.auth.getUser(token)");
    expect(processSource).toContain("performance.user_id !== user.id");
    expect(processSource).toContain('onConflict: "performance_id,position"');
  });

  it("settles the performance through one atomic, idempotent database action", () => {
    expect(completeSource).toContain("authClient.auth.getUser(token)");
    expect(completeSource).toContain('admin.rpc("complete_open_mic_atomic"');
  });

  it("requires a valid user JWT for both player actions", () => {
    expect(configSource).toMatch(/\[functions\.process-open-mic-song\]\s+verify_jwt = true/);
    expect(configSource).toMatch(/\[functions\.complete-open-mic\]\s+verify_jwt = true/);
  });
});
