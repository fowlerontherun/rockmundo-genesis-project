import { describe, expect, it } from "vitest";
import { selectCrowdCue, type CrowdAudioAsset, type CrowdCueRequest } from "./crowdCueSelection";

const asset = (id: string, overrides: Partial<CrowdAudioAsset> = {}): CrowdAudioAsset => ({
  id, category: "applause", crowd_size: "medium", environments: ["studio"],
  intensity: 3, enabled: true, rights_confirmed: true, ...overrides,
});
const request: CrowdCueRequest = {
  category: "applause", crowdSize: "medium", environment: "studio",
  intensity: 3, seed: "episode:42:cue:1", atSeconds: 90,
};

describe("selectCrowdCue", () => {
  it("excludes unlicensed, disabled, wrong venue and wrong crowd size", () => {
    expect(selectCrowdCue([
      asset("unlicensed", { rights_confirmed: false }),
      asset("disabled", { enabled: false }),
      asset("arena", { environments: ["arena"] }),
      asset("large", { crowd_size: "large" }),
      asset("valid"),
    ], request)?.id).toBe("valid");
  });
  it("avoids repetition during cooldown and allows reuse afterwards", () => {
    const history = [{ assetId: "first", atSeconds: 75 }];
    expect(selectCrowdCue([asset("first"), asset("second")], { ...request, history })?.id).toBe("second");
    expect(selectCrowdCue([asset("first")], { ...request, history })).toBeNull();
    expect(selectCrowdCue([asset("first")], { ...request, history, atSeconds: 106 })?.id).toBe("first");
  });
  it("is deterministic regardless of catalogue row ordering", () => {
    const assets = [asset("z"), asset("a"), asset("m")];
    expect(selectCrowdCue(assets, request)?.id).toBe(selectCrowdCue([...assets].reverse(), request)?.id);
  });
  it("prefers intensity and supports wildcard catalogue entries", () => {
    expect(selectCrowdCue([
      asset("weak", { intensity: 1 }),
      asset("match", { intensity: 5, crowd_size: "any", environments: ["any"] }),
    ], { ...request, intensity: 5 })?.id).toBe("match");
  });
});
