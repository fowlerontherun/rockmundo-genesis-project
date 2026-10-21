import { describe, expect, it } from "vitest";
import { enqueueAvatarCapture } from "./avatarCaptureQueue";

describe("shared avatar render lane", () => {
  it("never runs simultaneous captures from different UI surfaces", async () => {
    const events: string[] = [];
    let finishFirst: (() => void) | undefined;
    const first = enqueueAvatarCapture(async () => {
      events.push("share:start");
      await new Promise<void>(resolve => { finishFirst = resolve; });
      events.push("share:finish");
      return "share";
    });
    const second = enqueueAvatarCapture(async () => {
      events.push("banner:start");
      return "banner";
    });
    await Promise.resolve();
    expect(events).toEqual(["share:start"]);
    finishFirst?.();
    expect(await first).toBe("share");
    expect(await second).toBe("banner");
    expect(events).toEqual(["share:start", "share:finish", "banner:start"]);
  });

  it("recovers immediately after a failed WebGL capture", async () => {
    await expect(enqueueAvatarCapture(async () => { throw new Error("WebGL unavailable"); })).rejects.toThrow("WebGL unavailable");
    await expect(enqueueAvatarCapture(async () => "next capture")).resolves.toBe("next capture");
  });
});
