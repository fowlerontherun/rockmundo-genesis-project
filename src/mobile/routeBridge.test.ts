import { describe, expect, it } from "vitest";
import { getMobileBridgeTarget, mobileRouteBridge } from "./routeBridge";

describe("mobile route bridge", () => {
  it("forwards desktop gameplay paths to dedicated mobile screens", () => {
    expect(getMobileBridgeTarget("/stage-practice")).toBe("/mobile/career/practice");
    expect(getMobileBridgeTarget("/wellness")).toBe("/mobile/me/wellness");
    expect(getMobileBridgeTarget("/travel")).toBe("/mobile/world/travel");
    expect(getMobileBridgeTarget("/inbox")).toBe("/mobile/social/mail");
  });

  it("never bridges paths that are already mobile", () => {
    expect(getMobileBridgeTarget("/mobile/career/practice")).toBeNull();
  });

  it("leaves unmapped and public routes alone", () => {
    expect(getMobileBridgeTarget("/")).toBeNull();
    expect(getMobileBridgeTarget("/auth")).toBeNull();
    expect(getMobileBridgeTarget("/underworld")).toBeNull();
  });

  it("only targets mobile routes", () => {
    for (const [, target] of mobileRouteBridge) expect(target.startsWith("/mobile")).toBe(true);
  });
});
