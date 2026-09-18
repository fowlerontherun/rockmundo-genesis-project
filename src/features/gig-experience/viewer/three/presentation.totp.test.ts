import { describe, expect, it } from "vitest";
import type { PerformerPlan } from "../engine/PerformerLifecycle";
import { totpChoreographyState, totpFormation } from "./presentation";

function plan(): PerformerPlan {
  const base = {
    backstagePosition: { x: 0, y: 0 },
    entrancePoint: { x: 0, y: 0 },
    stageSlot: { x: 0, y: 0 },
    stageZone: "mid_center" as const,
    stageDescription: "mid centre",
    counterRadius: 19,
    movementZone: { x: 0, y: 0, width: 0, height: 0, radius: 0 },
    movementSpeed: 1,
    idlePhase: 0,
    label: "",
  };
  return {
    performers: [],
    stage: { x: 0, y: 0, width: 1200, height: 760 },
    audience: { x: 0, y: 0, width: 1200, height: 760 },
    entranceStartMs: 0,
    exitStartMs: null,
    entranceOrder: [],
    exitOrder: [],
    entities: [
      {
        ...base,
        id: "big-fowler",
        profileId: "player",
        displayName: "Big Fowler",
        initials: "BF",
        role: "guitar",
        roleLabel: "Guitar",
        instrument: "Acoustic Guitar / Lead Vocals",
        performerType: "performed",
      },
      {
        ...base,
        id: "sable",
        profileId: null,
        displayName: "Sable Vox the Virtuoso",
        initials: "SV",
        role: "guitar",
        roleLabel: "Guitar",
        instrument: "Guitar",
        performerType: "performed",
      },
      {
        ...base,
        id: "luna",
        profileId: null,
        displayName: "Luna Riot",
        initials: "LR",
        role: "drums",
        roleLabel: "Drums",
        instrument: "Drums",
        performerType: "performed",
      },
    ],
  };
}

describe("Top of the Pops television stage blocking", () => {
  it("puts a singing guitarist front-centre and separates the rest of the band", () => {
    const formation = totpFormation(plan());
    expect(formation.get("big-fowler")).toEqual({ u: .5, v: .82 });
    expect(formation.get("luna")).toEqual({ u: .5, v: .28 });

    const marks = [...formation.values()];
    for (let i = 0; i < marks.length; i += 1) {
      for (let j = i + 1; j < marks.length; j += 1) {
        expect(Math.hypot(marks[i].u - marks[j].u, marks[i].v - marks[j].v)).toBeGreaterThanOrEqual(.24);
      }
    }
  });

  it("keeps singer-instrumentalists planted on the stand microphone", () => {
    const home = { u: .5, v: .82 };
    for (const ms of [0, 4_000, 8_000, 12_000, 16_000]) {
      const state = totpChoreographyState("guitar", "Acoustic Guitar / Lead Vocals", home, ms, 0, true);
      expect(state.mark).toEqual(home);
      expect(state.walking).toBe(false);
    }
  });

  it("uses hold-walk-plant choreography for a roaming lead vocalist", () => {
    const home = { u: .5, v: .82 };
    const hold = totpChoreographyState("vocalist", "Lead Vocals", home, 2_000, 0, true);
    const walkOut = totpChoreographyState("vocalist", "Lead Vocals", home, 6_000, 0, true);
    const planted = totpChoreographyState("vocalist", "Lead Vocals", home, 9_000, 0, true);
    const walkHome = totpChoreographyState("vocalist", "Lead Vocals", home, 13_000, 0, true);

    expect(hold.walking).toBe(false);
    expect(walkOut.walking).toBe(true);
    expect(planted.walking).toBe(false);
    expect(planted.mark).not.toEqual(home);
    expect(walkHome.walking).toBe(true);
  });

  it("lets guitarists move between discrete marks instead of continuously drifting", () => {
    const home = { u: .3, v: .66 };
    const firstHold = totpChoreographyState("guitar", "Electric Guitar", home, 2_000, 0, true);
    const walk = totpChoreographyState("guitar", "Electric Guitar", home, 7_000, 0, true);
    const awayHold = totpChoreographyState("guitar", "Electric Guitar", home, 10_000, 0, true);

    expect(firstHold.mark).toEqual(home);
    expect(firstHold.walking).toBe(false);
    expect(walk.walking).toBe(true);
    expect(awayHold.walking).toBe(false);
    expect(awayHold.mark.u).toBeGreaterThan(home.u);
  });
});
