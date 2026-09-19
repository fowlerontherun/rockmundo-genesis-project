import { describe, expect, it } from "vitest";
import {
  isWithinTotpSafeArea,
  totpSafeAreaInsets,
  totpSafeAreaPercent,
  totpSafeAreaStyle,
  TOTP_PROGRAMME_FRAME,
} from "./broadcastSafeArea";

describe("Top of the Pops safe areas", () => {
  it("authors the programme at 1080p", () => {
    expect(TOTP_PROGRAMME_FRAME).toEqual({ width: 1920, height: 1080 });
  });

  it("uses 93% action safe and 90% title safe insets", () => {
    expect(totpSafeAreaInsets("action")).toEqual({ top: 38, right: 67, bottom: 38, left: 67 });
    expect(totpSafeAreaInsets("title")).toEqual({ top: 54, right: 96, bottom: 54, left: 96 });
  });

  it("exposes resolution-independent percentages", () => {
    expect(totpSafeAreaPercent("title").left).toBeCloseTo(5, 3);
    expect(totpSafeAreaStyle("action").top).toBe("3.5%");
  });

  it("detects overlays that break the title safe box", () => {
    expect(isWithinTotpSafeArea({ x: 120, y: 900, width: 700, height: 120 }, "title")).toBe(true);
    expect(isWithinTotpSafeArea({ x: 20, y: 900, width: 700, height: 120 }, "title")).toBe(false);
  });
});
