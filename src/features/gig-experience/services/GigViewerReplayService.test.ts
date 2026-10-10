import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { normalizeReplayRow, normalizeReplayVersion, selectReplayRow } from "./GigViewerReplayService";
import { isSupportedReplayVersion } from "../events/schema";

const row = (id: string, viewer: unknown, status: string, schema: unknown = 2) =>
  normalizeReplayRow({
    id, gig_id: "3c8af5b7-9c60-4a2a-b9fe-b55a60ef124d", gig_outcome_id: "o", viewer_version: viewer,
    event_schema_version: schema, simulation_seed: "s", duration_ms: 180000, event_payload: { events: [] },
    generated_at: "2026-10-09T00:00:00Z", generation_status: status as any, checksum: null,
  });

describe("replay version normalization", () => {
  it("treats stored text \"2\" and numeric 2 identically", () => {
    expect(normalizeReplayVersion("2")).toBe(2);
    expect(normalizeReplayVersion(2)).toBe(2);
    expect(isSupportedReplayVersion(row("a", "2", "ready").viewer_version, 2)).toBe(true);
  });

  it("still rejects genuinely unsupported versions", () => {
    for (const v of ["3", 3, "2.5", "v2", "", null, undefined, "0", -2]) {
      const r = row("x", v, "ready");
      expect(isSupportedReplayVersion(r.viewer_version, r.event_schema_version)).toBe(false);
    }
  });

  it("prefers a ready compatible row over a newer pending retry", () => {
    const rows = [row("pending", "2", "generating"), row("failed", "2", "failed"), row("ready", "2", "ready")];
    expect(selectReplayRow(rows)?.id).toBe("ready");
  });

  it("prefers ready current-version over ready legacy and ignores unsupported ready rows", () => {
    const rows = [row("bad", "9", "ready"), row("legacy", "1", "ready", "1"), row("current", "2", "ready")];
    expect(selectReplayRow(rows)?.id).toBe("current");
  });

  it("falls back to the pending row when nothing is ready", () => {
    expect(selectReplayRow([row("pending", "2", "generating")])?.generation_status).toBe("generating");
  });
});
