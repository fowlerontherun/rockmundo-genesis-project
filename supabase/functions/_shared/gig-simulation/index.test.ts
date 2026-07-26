import { describe, expect, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import { simulateCanonicalFestivalPerformance } from "./index.ts";
import type { FestivalSimulationInput } from "./types.ts";

const input: FestivalSimulationInput = {
  runtimeSessionId: "runtime", dayId: "day", stageId: "stage", performanceId: "performance", seed: "seed",
  canonicalEngineVersion: "canonical-gig-v1", festivalAdapterVersion: "festival-gig-adapter-v2",
  resultSchemaVersion: "festival-performance-result-v1", runtimeFormulaVersion: "festival-runtime-v1",
  formulaVersions: { runtime: "festival-runtime-v1" },
  canonicalGigInput: { gigId: "gig", artistId: "artist", performerSkill: 70, stagePresence: 75,
    readinessScore: 80, setlist: [{ id: "song", title: "Real song", position: 1, quality: 70, popularity: 60, familiarity: 80, rehearsalLevel: 75 }] },
  festivalModifiers: { stageQuality: 60, soundAndLighting: 60, technicalReadiness: 60, rehearsal: 70,
    crewEffectiveness: 60, weather: 50, delayMinutes: 0, crowdMood: 70, crowdDensity: 70,
    equipmentCondition: 70, billingPosition: 100, headlinerExpectation: 80, incidentDisruption: 0, setLengthMinutes: 60 },
  crowdEvidence: { attendance: 800, stageCapacity: 1000 },
};

describe("Festival simulation contract", () => {
  it("is deterministic", () => expect(simulateCanonicalFestivalPerformance(input, "digest")).toEqual(simulateCanonicalFestivalPerformance(input, "digest")));
  it("rejects missing canonical setlists", () => expect(() => simulateCanonicalFestivalPerformance({ ...input, canonicalGigInput: { ...input.canonicalGigInput, setlist: [] } }, "digest")).toThrow("festival_simulation_canonical_input_missing"));
});
