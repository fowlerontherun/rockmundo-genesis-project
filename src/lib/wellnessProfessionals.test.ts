import { describe, expect, it } from "vitest";
import { calculateProfessionalReputation, calculateProfessionalXp, calculateServiceOutcome, canListService, deriveQualificationTier, validateAppointmentRequest } from "./wellnessProfessionals";

describe("wellness professional qualification and listing", () => {
  it("derives qualification tiers from role skills, work history, reputation and reliability", () => {
    expect(deriveQualificationTier({ role: "physiotherapist", skills: { physiotherapy: 82, medical_care: 75, empathy: 70, reliability: 90 }, completedServices: 120, reputation: 75, reliability: 90 })).toBe("expert");
    expect(deriveQualificationTier({ role: "physiotherapist", skills: { physiotherapy: 20, medical_care: 75, empathy: 70, reliability: 90 }, completedServices: 120, reputation: 75, reliability: 90 })).toBeNull();
  });

  it("prevents unqualified or mispriced restricted service listings", () => {
    expect(canListService({ role: "therapist", service: "therapy_session", qualification: "trainee", priceCents: 9000 })).toEqual({ ok: false, reason: "qualification_required" });
    expect(canListService({ role: "therapist", service: "therapy_session", qualification: "qualified", priceCents: 100000 })).toEqual({ ok: false, reason: "price_out_of_bounds" });
    expect(canListService({ role: "therapist", service: "therapy_session", qualification: "qualified", priceCents: 9000 })).toEqual({ ok: true });
  });
});

describe("wellness professional booking and outcomes", () => {
  it("rejects self booking, schedule conflicts and invalid remote/location combinations", () => {
    expect(validateAppointmentRequest({ clientId: "p1", providerId: "p1", providerKind: "player", service: "massage_session", role: "massage_therapist", qualification: "trainee", priceCents: 6500, clientAvailable: true, providerAvailable: true, remote: false, locationTags: ["hotel"] })).toEqual({ ok: false, reason: "self_booking" });
    expect(validateAppointmentRequest({ clientId: "p1", providerId: "p2", providerKind: "player", service: "massage_session", role: "massage_therapist", qualification: "trainee", priceCents: 6500, clientAvailable: true, providerAvailable: false, remote: false, locationTags: ["hotel"] })).toEqual({ ok: false, reason: "schedule_conflict" });
    expect(validateAppointmentRequest({ clientId: "p1", providerId: "p2", providerKind: "player", service: "massage_session", role: "massage_therapist", qualification: "trainee", priceCents: 6500, clientAvailable: true, providerAvailable: true, remote: true })).toEqual({ ok: false, reason: "remote_not_allowed" });
  });

  it("caps skilled real-player advantage and severe condition recovery", () => {
    const player = calculateServiceOutcome({ providerKind: "player", role: "physiotherapist", service: "physiotherapy_treatment", qualification: "experienced", relevantSkillAverage: 88, providerWellness: { fatigue: 20, burnout_risk: 5 }, providerReliability: 100, clientConditionSeverity: 90, conditionCompatible: true, locationQuality: 100, familiarityCount: 20, randomFactor: 1.06 });
    const npc = calculateServiceOutcome({ providerKind: "npc", role: "physiotherapist", service: "physiotherapy_treatment", qualification: "experienced", relevantSkillAverage: 88, providerWellness: { fatigue: 20, burnout_risk: 5 }, providerReliability: 100, clientConditionSeverity: 90, conditionCompatible: true, locationQuality: 100, familiarityCount: 20, randomFactor: 1.06 });
    expect(player.quality).toBeLessThanOrEqual(1.18);
    expect(player.quality).toBeGreaterThanOrEqual(npc.quality);
    expect(Math.abs(player.effects.strain as number)).toBeLessThanOrEqual(12);
  });

  it("reduces quality for incompatible care and poor provider wellness", () => {
    const good = calculateServiceOutcome({ providerKind: "player", role: "therapist", service: "therapy_session", qualification: "expert", relevantSkillAverage: 80, providerWellness: { fatigue: 25, burnout_risk: 20 }, providerReliability: 92, conditionCompatible: true });
    const poor = calculateServiceOutcome({ providerKind: "player", role: "therapist", service: "therapy_session", qualification: "expert", relevantSkillAverage: 80, providerWellness: { fatigue: 95, burnout_risk: 95 }, providerReliability: 92, conditionCompatible: false });
    expect(poor.quality).toBeLessThan(good.quality);
    expect(Math.abs(poor.effects.stress as number)).toBeLessThan(Math.abs(good.effects.stress as number));
  });
});

describe("wellness professional progression, reputation and abuse controls", () => {
  it("applies repeated-pair diminishing returns, caps and refunded-service exclusion", () => {
    expect(calculateProfessionalXp({ durationMinutes: 60, outcomeQuality: 1, eligiblePaymentCents: 8000, refunded: true }).xp).toBe(0);
    const normal = calculateProfessionalXp({ durationMinutes: 60, outcomeQuality: 1, eligiblePaymentCents: 8000, pairCompletedThisWeek: 0 });
    const repeated = calculateProfessionalXp({ durationMinutes: 60, outcomeQuality: 1, eligiblePaymentCents: 8000, pairCompletedThisWeek: 6 });
    expect(repeated.xp).toBeLessThan(normal.xp);
    expect(calculateProfessionalXp({ durationMinutes: 240, outcomeQuality: 1.2, eligiblePaymentCents: 50000, dailyAwarded: 88 }).xp).toBeLessThanOrEqual(2);
  });

  it("weights reliability, reviews, outcomes and disputes into professional reputation", () => {
    const respected = calculateProfessionalReputation({ completedAppointments: 130, reliability: 96, averageRating: 4.8, outcomeConsistency: 90, cancellations: 1, disputes: 0 });
    const risky = calculateProfessionalReputation({ completedAppointments: 130, reliability: 55, averageRating: 2.5, outcomeConsistency: 40, cancellations: 10, disputes: 3 });
    expect(respected.score).toBeGreaterThan(risky.score);
    expect(respected.state).not.toBe("New");
  });
});
