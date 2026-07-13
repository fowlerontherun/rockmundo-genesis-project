import { describe, expect, it } from "vitest";
import { calculateTeachingOutcome, TEACHING_BALANCE_VERSION, TEACHING_POLICIES, TEACHABLE_SKILLS } from "./teachingOutcomeCalculator";

const baseInput = { teacherProfileId: "teacher", studentProfileId: "student", skillId: "guitar", sessionType: "one_off_lesson" as const, durationMinutes: 90, price: 120, balanceVersion: TEACHING_BALANCE_VERSION };
const baseState = { teacherSkillLevel: 35, studentSkillLevel: 12, teachingSkillLevel: 8, teacherAttributes: { mental_focus: 650, charisma: 420 }, studentLearningModifier: 1.08, priorPairSessions: 0, teacherAvailable: true, studentAvailable: true, paymentReserved: true, activityCompleted: true };

describe("teachingOutcomeCalculator", () => {
  it("allows a qualified teacher and calculates bounded server-side rewards", () => {
    const outcome = calculateTeachingOutcome(baseInput, baseState);
    expect(outcome.eligible).toBe(true);
    expect(outcome.studentTargetXp).toBeGreaterThan(0);
    expect(outcome.studentTargetXp).toBeLessThanOrEqual(260 * 2);
    expect(outcome.teacherTeachingXp).toBeGreaterThan(0);
    expect(outcome.teachingQuality).toBeGreaterThan(0.45);
    expect(outcome.balanceVersion).toBe(TEACHING_BALANCE_VERSION);
  });

  it("blocks under-level teachers and insufficient skill advantage", () => {
    const outcome = calculateTeachingOutcome(baseInput, { ...baseState, teacherSkillLevel: 13, studentSkillLevel: 12 });
    expect(outcome.eligible).toBe(false);
    expect(outcome.blockedReasons).toContain("teacher_level_too_low");
    expect(outcome.blockedReasons).toContain("insufficient_teacher_advantage");
  });

  it("enforces teaching skill and mastery requirements", () => {
    expect(calculateTeachingOutcome(baseInput, { ...baseState, teachingSkillLevel: 0 }).blockedReasons).toContain("teaching_skill_too_low");
    const mastery = calculateTeachingOutcome({ ...baseInput, sessionType: "professional_coaching", skillId: "production", price: 800 }, { ...baseState, teacherSkillLevel: 90, studentSkillLevel: 70, teachingSkillLevel: 20, masteryRank: 0 });
    expect(mastery.eligible).toBe(true);
    const required = calculateTeachingOutcome({ ...baseInput, sessionType: "one_off_lesson", skillId: "production", price: 800 }, { ...baseState, teacherSkillLevel: 90, studentSkillLevel: 70, teachingSkillLevel: 20, masteryRank: 0 });
    expect(required.blockedReasons).not.toContain("mastery_required");
  });

  it("applies repetition penalties per teacher/student/skill without making mentors useless", () => {
    const first = calculateTeachingOutcome(baseInput, baseState);
    const repeated = calculateTeachingOutcome(baseInput, { ...baseState, priorPairSessions: 3 });
    expect(repeated.repetitionModifier).toBeLessThan(first.repetitionModifier);
    expect(repeated.studentTargetXp).toBeLessThan(first.studentTargetXp);
    expect(repeated.studentTargetXp).toBeGreaterThan(0);
    expect(repeated.telemetryEvents).toContain("repetition_penalty_applied");
  });

  it("requires band membership for bandmate coaching and caps group workshops", () => {
    const band = calculateTeachingOutcome({ ...baseInput, sessionType: "bandmate_coaching", price: 0, durationMinutes: 60 }, { ...baseState, isBandmate: false });
    expect(band.blockedReasons).toContain("band_membership_required");
    const workshop = calculateTeachingOutcome({ ...baseInput, sessionType: "group_workshop", studentCount: TEACHING_POLICIES.group_workshop.maximumStudents + 1, price: 80, durationMinutes: 120 }, { ...baseState, teacherSkillLevel: 45, teachingSkillLevel: 10 });
    expect(workshop.blockedReasons).toContain("student_capacity_exceeded");
  });

  it("keeps hidden or inactive skills out of the public teachable catalogue", () => {
    expect(TEACHABLE_SKILLS.filter((s) => s.is_hidden).every((s) => !s.is_teachable)).toBe(true);
  });
});
