import { describe, expect, it } from "vitest";
import { buildTotpShotGrammar, chooseTotpStage, TOTP_CLASSIC_BROADCAST_PROFILE } from "./broadcastProfile";

describe("Top of the Pops broadcast profile", () => {
  it("uses a dedicated broadcast viewer mode and disables free camera", () => {
    expect(TOTP_CLASSIC_BROADCAST_PROFILE.viewerMode).toBe("totp");
    expect(TOTP_CLASSIC_BROADCAST_PROFILE.allowFreeCameraDuringBroadcast).toBe(false);
    expect(TOTP_CLASSIC_BROADCAST_PROFILE.camerasVisibleInScene).toBe(true);
  });

  it("routes rock acts to the dedicated rock stage", () => {
    expect(chooseTotpStage({ genre: "Alternative Rock", energy: "high", performerCount: 4 })).toBe("rock_stage");
  });

  it("uses the studio floor for low-energy/acoustic performances", () => {
    expect(chooseTotpStage({ genre: "Acoustic", energy: "low", performerCount: 1 })).toBe("studio_floor");
  });

  it("gives high-energy songs faster television-style coverage", () => {
    const shots = buildTotpShotGrammar({ genre: "Punk", energy: "high", performerCount: 4 });
    expect(shots).toContain("drummer_close");
    expect(shots).toContain("side_tracking");
    expect(shots.at(-1)).toBe("finale_wide");
  });

  it("keeps restrained performances focused on lead and studio framing", () => {
    const shots = buildTotpShotGrammar({ genre: "Ballad", energy: "low", performerCount: 3 });
    expect(shots).toContain("lead_close");
    expect(shots).toContain("studio_master");
    expect(shots).not.toContain("drummer_close");
  });
});
