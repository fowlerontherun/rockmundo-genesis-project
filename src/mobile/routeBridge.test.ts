import { describe, expect, it } from "vitest";
import { getMobileBridgeTarget, mobileRouteBridge } from "./routeBridge";

describe("mobile route bridge", () => {
  it("forwards desktop gameplay paths to supported mobile screens", () => {
    expect(getMobileBridgeTarget("/stage-practice")).toBe("/mobile/career/practice");
    expect(getMobileBridgeTarget("/schedule/current")).toBe("/mobile/career/schedule");
    expect(getMobileBridgeTarget("/gigs/perform/example-gig")).toBe("/mobile/career/gigs");
    expect(getMobileBridgeTarget("/wellness")).toBe("/mobile/me/wellness");
    expect(getMobileBridgeTarget("/travel")).toBe("/mobile/world/travel");
    expect(getMobileBridgeTarget("/inbox")).toBe("/mobile/social/mail");
  });

  it("preserves a direct player-profile deep link inside mobile Social", () => {
    expect(getMobileBridgeTarget("/player/example-player")).toBe("/mobile/social/profile/example-player");
    expect(getMobileBridgeTarget("/players/example-player")).toBe("/mobile/social/profile/example-player");
  });

  it("never bridges paths that are already mobile or explicitly public", () => {
    expect(getMobileBridgeTarget("/mobile/career/practice")).toBeNull();
    expect(getMobileBridgeTarget("/")).toBeNull();
    expect(getMobileBridgeTarget("/auth")).toBeNull();
    expect(getMobileBridgeTarget("/about")).toBeNull();
    expect(getMobileBridgeTarget("/song/example-song")).toBeNull();
  });

  it("contains an otherwise unmapped authenticated desktop route", () => {
    expect(getMobileBridgeTarget("/underworld")).toBe("/mobile");
    expect(getMobileBridgeTarget("/some-new-desktop-page")).toBe("/mobile");
  });

  it("only targets mobile routes", () => {
    for (const [, target] of mobileRouteBridge) expect(target.startsWith("/mobile")).toBe(true);
  });
});
