import { describe, expect, it } from "vitest";
import {
  TOTP_CHART_POSITIONS,
  TOTP_REUSABLE_VOICE_SCRIPT_GUIDE,
  totpChartPositionScript,
} from "./chartPositionAudio";

describe("Top of the Pops chart-position audio scripts", () => {
  it("covers every chart position from 40 down to 1 in broadcast order", () => {
    expect(TOTP_CHART_POSITIONS).toHaveLength(40);
    expect(TOTP_CHART_POSITIONS[0]).toBe(40);
    expect(TOTP_CHART_POSITIONS.at(-1)).toBe(1);
    expect(new Set(TOTP_CHART_POSITIONS).size).toBe(40);
  });

  it("uses stable spoken wording for the reusable clips", () => {
    expect(totpChartPositionScript(40)).toBe("At number forty.");
    expect(totpChartPositionScript(21)).toBe("At number twenty-one.");
    expect(totpChartPositionScript(10)).toBe("At number ten.");
    expect(totpChartPositionScript(1)).toBe("At number one.");
  });

  it("documents the reusable supporting chart phrases", () => {
    expect(TOTP_REUSABLE_VOICE_SCRIPT_GUIDE.map((line) => line.id)).toEqual([
      "chart-intro",
      "digital-sales-intro",
      "streaming-intro",
      "new-entry",
      "non-mover",
      "moving-up",
      "moving-down",
    ]);
  });

  it("rejects chart positions outside the Top 40", () => {
    expect(() => totpChartPositionScript(0)).toThrow(/Unsupported Top of the Pops chart position/);
    expect(() => totpChartPositionScript(41)).toThrow(/Unsupported Top of the Pops chart position/);
  });
});
