import { describe, expect, it } from "vitest";
import { resolveTotpRenderFrame } from "./renderSurfaceClock";
import type { TotpRenderPlan } from "./renderSpec";

const plan = {
  items: [
    { index: 0, kind: "opening_titles", label: "Titles", start_ms: 0, duration_ms: 1000, performance_id: null, audio_url: null },
    { index: 1, kind: "performance", label: "Act", start_ms: 1000, duration_ms: 2000, performance_id: "p1", audio_url: "x" },
    { index: 2, kind: "end_credits", label: "Credits", start_ms: 3000, duration_ms: 1000, performance_id: null, audio_url: null },
  ],
  total_duration_ms: 4000,
} as unknown as TotpRenderPlan;

describe("resolveTotpRenderFrame", () => {
  it("uses exact item boundaries instead of elapsed browser time", () => {
    expect(resolveTotpRenderFrame(plan, 999).item.kind).toBe("opening_titles");
    expect(resolveTotpRenderFrame(plan, 1000).item.kind).toBe("performance");
    expect(resolveTotpRenderFrame(plan, 2999).item.kind).toBe("performance");
    expect(resolveTotpRenderFrame(plan, 3000).item.kind).toBe("end_credits");
  });

  it("clamps seeks to the programme and reports deterministic local progress", () => {
    expect(resolveTotpRenderFrame(plan, -99).programmeMs).toBe(0);
    const end = resolveTotpRenderFrame(plan, 99_000);
    expect(end.programmeMs).toBe(3999);
    expect(end.localMs).toBe(999);
  });
});
