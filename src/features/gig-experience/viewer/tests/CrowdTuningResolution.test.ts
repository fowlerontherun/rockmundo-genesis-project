import { describe, expect, it } from "vitest";
import { DEFAULT_CROWD_TUNING } from "../engine/CrowdTuning";
import { resolveCrowdTuning } from "../engine/CrowdTuningResolution";

const tuning = (densityMultiplier: number) => ({
  ...DEFAULT_CROWD_TUNING,
  densityMultiplier,
});

describe("crowd tuning resolution", () => {
  it("keeps explicit overrides above every other source", () => {
    const result = resolveCrowdTuning({
      explicit: tuning(4),
      demoMode: true,
      demo: tuning(3),
      replay: tuning(2.5),
      global: tuning(1.5),
    });
    expect(result.source).toBe("explicit");
    expect(result.tuning?.densityMultiplier).toBe(4);
  });

  it("uses demo settings only on the admin demo route", () => {
    expect(resolveCrowdTuning({ demoMode: true, demo: tuning(3), replay: tuning(2.5), global: tuning(1.5) }).source).toBe("demo");
    expect(resolveCrowdTuning({ demoMode: false, demo: tuning(3), replay: tuning(2.5), global: tuning(1.5) }).source).toBe("replay");
  });

  it("prefers a replay snapshot over a later global revision", () => {
    const result = resolveCrowdTuning({
      demoMode: false,
      replay: tuning(2.25),
      global: tuning(4),
    });
    expect(result.source).toBe("replay");
    expect(result.tuning?.densityMultiplier).toBe(2.25);
  });

  it("uses the active global setting for unsnapshotted replays", () => {
    const result = resolveCrowdTuning({ demoMode: false, global: tuning(3.5) });
    expect(result.source).toBe("global");
    expect(result.tuning?.densityMultiplier).toBe(3.5);
  });

  it("falls back to the built-in production plan when settings are unavailable", () => {
    expect(resolveCrowdTuning({ demoMode: false })).toEqual({ tuning: null, source: "built_in" });
  });
});
