import { describe, expect, it } from "vitest";
import { applyRelationshipEvent, calculateBandCohesion, canonicalPair, deriveRelationshipLevel, resolveRelationshipEffects, type RelationshipRecord } from "./relationshipProgression";

const base: RelationshipRecord = { player_low_id: "a", player_high_id: "b", familiarity: 20, trust: 50, creative_chemistry: 20, performance_chemistry: 20, reliability_confidence: 50, social_rapport: 15, conflict: 0, relationship_level: "acquaintances" };

describe("relationship progression foundation", () => {
  it("creates canonical pairs and rejects self relationships", () => {
    expect(canonicalPair("b", "a")).toEqual(["a", "b"]);
    expect(() => canonicalPair("a", "a")).toThrow(/distinct/);
  });

  it("applies shared rehearsal gains to the correct dimensions", () => {
    const result = applyRelationshipEvent(base, { playerAId: "b", playerBId: "a", eventType: "rehearsal_completed", sourceType: "rehearsal", sourceId: "r1" });
    expect(result.idempotencyKey).toBe("rehearsal:r1:rehearsal_completed");
    expect(result.relationship.performance_chemistry).toBeGreaterThan(base.performance_chemistry);
    expect(result.relationship.familiarity).toBeGreaterThan(base.familiarity);
    expect(result.relationship.trust).toBeGreaterThan(base.trust);
  });

  it("distinguishes excused absence from unexcused no-show", () => {
    const excused = applyRelationshipEvent(base, { playerAId: "a", playerBId: "b", eventType: "excused_absence", sourceType: "rehearsal", sourceId: "r2" }).relationship;
    const noShow = applyRelationshipEvent(base, { playerAId: "a", playerBId: "b", eventType: "unexcused_absence", sourceType: "rehearsal", sourceId: "r3" }).relationship;
    expect(noShow.trust).toBeLessThan(excused.trust);
    expect(noShow.conflict).toBeGreaterThan(excused.conflict);
  });

  it("uses diminishing returns for repeated trivial gains", () => {
    const first = applyRelationshipEvent(base, { playerAId: "a", playerBId: "b", eventType: "jam_completed", sourceType: "jam_session", sourceId: "j1" }, 0).relationship;
    const repeated = applyRelationshipEvent(base, { playerAId: "a", playerBId: "b", eventType: "jam_completed", sourceType: "jam_session", sourceId: "j2" }, 5).relationship;
    expect(first.creative_chemistry - base.creative_chemistry).toBeGreaterThan(repeated.creative_chemistry - base.creative_chemistry);
  });

  it("prevents one strong stat from overriding severe conflict", () => {
    expect(deriveRelationshipLevel({ familiarity: 100, trust: 80, creative_chemistry: 100, performance_chemistry: 100, reliability_confidence: 80, social_rapport: 100, conflict: 78 })).toBe("strangers");
  });

  it("calculates band cohesion with a weak-link effect", () => {
    const cohesive = calculateBandCohesion([{ ...base, trust: 80, familiarity: 80, performance_chemistry: 80, creative_chemistry: 80, reliability_confidence: 80, social_rapport: 80 }, { ...base, trust: 82, familiarity: 82, performance_chemistry: 82, creative_chemistry: 82, reliability_confidence: 82, social_rapport: 82 }], 3);
    const weakLink = calculateBandCohesion([{ ...base, trust: 80, familiarity: 80, performance_chemistry: 80, creative_chemistry: 80, reliability_confidence: 80, social_rapport: 80 }, { ...base, trust: 20, reliability_confidence: 20, conflict: 70 }], 3);
    expect(weakLink.cohesion).toBeLessThan(cohesive.cohesion - 20);
  });

  it("caps mechanical modifiers", () => {
    const effects = resolveRelationshipEffects({ familiarity: 100, trust: 100, creative_chemistry: 100, performance_chemistry: 100, reliability_confidence: 100, social_rapport: 100, conflict: 0 });
    expect(effects.rehearsalEfficiency).toBeLessThanOrEqual(0.1);
    expect(effects.performanceConsistency).toBeLessThanOrEqual(0.08);
    expect(effects.recordingEfficiency).toBeLessThanOrEqual(0.08);
    expect(effects.songwritingCollaboration).toBeLessThanOrEqual(0.1);
  });
});
