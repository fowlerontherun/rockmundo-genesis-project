import { describe, expect, it } from "vitest";
import { resolveVenueProfile } from "@/features/gig-demo-3d/venueProfile";
import type { PerformerPlan } from "../engine/PerformerLifecycle";
import { totpChoreographyState, totpFormation, totpSafeStageMark, totpStageWorldPosition } from "./presentation";

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
  it("uses a compact centre-weighted TV formation", () => {
    const formation = totpFormation(plan());
    expect(formation.get("big-fowler")).toEqual({ u: .5, v: .78 });
    expect(formation.get("luna")).toEqual({ u: .5, v: .28 });

    const singer = formation.get("big-fowler")!;
    const drummer = formation.get("luna")!;
    expect(Math.abs(singer.v - drummer.v)).toBeGreaterThan(.42);

    const marks = [...formation.values()];
    for (let i = 0; i < marks.length; i += 1) {
      for (let j = i + 1; j < marks.length; j += 1) {
        expect(Math.hypot(marks[i].u - marks[j].u, marks[i].v - marks[j].v)).toBeGreaterThan(.18);
      }
    }
  });

  it("maps each TOTP stage to its real physical deck centre and height", () => {
    const venue = resolveVenueProfile({ type: "tv_studio", seed: 42 });

    expect(totpStageWorldPosition("main_stage", venue, { u: .5, v: .53 })).toEqual([0, .55, -2.75]);
    expect(totpStageWorldPosition("stage_b", venue, { u: .5, v: .54 })).toEqual([5.4, .22, 2.05]);
    expect(totpStageWorldPosition("rock_stage", venue, { u: .5, v: .53 })).toEqual([-4.5, .28, 4.05]);
    expect(totpStageWorldPosition("studio_floor", venue, { u: .5, v: .53 })).toEqual([1.4, .08, 5.65]);
  });

  it("clamps extreme performer marks away from scenery and stage edges", () => {
    const venue = resolveVenueProfile({ type: "tv_studio", seed: 42 });

    expect(totpSafeStageMark("stage_b", venue, { u: 0, v: 0 })).toEqual({ u: .29, v: .30 });
    expect(totpSafeStageMark("stage_b", venue, { u: 1, v: 1 })).toEqual({ u: .71, v: .78 });

    const leftBack = totpStageWorldPosition("stage_b", venue, { u: 0, v: 0 });
    const rightFront = totpStageWorldPosition("stage_b", venue, { u: 1, v: 1 });
    expect(leftBack[0]).toBeGreaterThan(4.6);
    expect(rightFront[0]).toBeLessThan(6.2);
    expect(leftBack[2]).toBeGreaterThan(1.4);
    expect(rightFront[2]).toBeLessThan(2.7);
  });

  it("keeps singer-instrumentalists planted on the stand microphone", () => {
    const home = { u: .5, v: .78 };
    for (const ms of [0, 4_000, 8_000, 12_000, 16_000]) {
      const state = totpChoreographyState("guitar", "Acoustic Guitar / Lead Vocals", home, ms, 0, true);
      expect(state.mark).toEqual(home);
      expect(state.walking).toBe(false);
    }
  });

  it("uses hold-walk-plant choreography for a roaming lead vocalist", () => {
    const home = { u: .5, v: .78 };
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

  it("lets guitarists move outward between discrete marks instead of drifting into the band", () => {
    const home = { u: .34, v: .64 };
    const firstHold = totpChoreographyState("guitar", "Electric Guitar", home, 2_000, 0, true);
    const walk = totpChoreographyState("guitar", "Electric Guitar", home, 7_000, 0, true);
    const awayHold = totpChoreographyState("guitar", "Electric Guitar", home, 10_000, 0, true);

    expect(firstHold.mark).toEqual(home);
    expect(firstHold.walking).toBe(false);
    expect(walk.walking).toBe(true);
    expect(awayHold.walking).toBe(false);
    expect(awayHold.mark.u).toBeLessThan(home.u);
  });

  it("keeps a roaming lead singer on the centre lane instead of crossing sideways", () => {
    const home = { u: .5, v: .78 };
    const planted = totpChoreographyState("vocalist", "Lead Vocals", home, 9_000, 0, true);
    expect(planted.walking).toBe(false);
    expect(planted.mark.u).toBe(.5);
    expect(planted.mark.v).toBeLessThan(home.v);
  });
});
