import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const ui = read("src/components/recording/SongGenerationStatus.tsx");
const migration = read("supabase/migrations/20261018065000_song_generation_attempt_rls_hardening.sql");

describe("generation attempt security and explicit retry (#4282)", () => {
  it("revokes all anonymous and authenticated mutation privileges", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Service role can manage generation attempts"');
    expect(migration).toContain("REVOKE ALL PRIVILEGES ON TABLE public.song_generation_attempts");
    expect(migration).toContain("FROM anon, authenticated");
    expect(migration).toContain("GRANT SELECT ON TABLE public.song_generation_attempts TO authenticated");
  });

  it("limits generation history to signed-in owners", () => {
    expect(migration).toContain("FOR SELECT TO authenticated");
    expect(migration).toContain("USING ((SELECT auth.uid()) = user_id)");
    expect(migration).not.toContain("FOR ALL USING (true)");
  });

  it("requires human confirmation before retrying a failed song", () => {
    expect(ui).toContain("Retry failed AI song generation?");
    expect(ui).toContain("onClick={() => setShowReplaceDialog(true)}");
    expect(ui).toContain("onClick={() => void handleRetry(hasAudio)}");
    expect(ui).toContain("retryInFlight.current");
    expect(ui).toContain("No automatic retries will run after a failure.");
  });

  it("provides safe hints for previous length and rate-limit errors", () => {
    expect(ui).toContain("failureHint");
    expect(ui).toContain("RockMundo now targets 60–90 seconds");
    expect(ui).toContain("Avoid repeatedly retrying while provider credit is low");
  });
});
