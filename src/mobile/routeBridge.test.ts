import { describe, expect, it } from "vitest";
import { getMobileBridgeTarget, mobileRouteBridge } from "./routeBridge";
describe("mobile route bridge", () => {
  it("bridges supported desktop functions to focused mobile screens", () => {
    expect(getMobileBridgeTarget("/schedule")).toBe("/mobile");
    expect(getMobileBridgeTarget("/booking/work")).toBe("/mobile?view=book");
    expect(getMobileBridgeTarget("/inbox")).toBe("/mobile/inbox");
    expect(getMobileBridgeTarget("/social/chat")).toBe("/mobile/chat");
    expect(getMobileBridgeTarget("/skills")).toBe("/mobile/progression");
  });
  it("contains everything else at the schedule screen", () => {
    expect(getMobileBridgeTarget("/travel")).toBe("/mobile");
    expect(getMobileBridgeTarget("/twaater")).toBe("/mobile");
    expect(getMobileBridgeTarget("/career")).toBe("/mobile");
  });
  it("does not bridge mobile or public routes", () => {
    expect(getMobileBridgeTarget("/mobile/chat")).toBeNull();
    expect(getMobileBridgeTarget("/")).toBeNull();
    expect(getMobileBridgeTarget("/auth")).toBeNull();
  });
  it("only targets mobile routes", () => { for (const [, target] of mobileRouteBridge) expect(target.startsWith("/mobile")).toBe(true); });
});