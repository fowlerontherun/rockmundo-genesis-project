import { CANONICAL_ROLE_LINKS, type SkillRoleKey } from "./skillCatalogue";

export type BandCoverageContext = "general" | "gig" | "recording" | "songwriting";
export type GoalStatus = "draft" | "proposed" | "active" | "blocked" | "completed" | "abandoned" | "archived";
export type BandGoalType = "role_coverage" | "recording_readiness" | "gig_readiness" | "songwriting_capability" | "rehearsal_readiness" | "genre_development" | "professional_skill" | "newcomer_onboarding" | "role_handover" | "custom_guided";
export type TaskStatus = "suggested" | "claimed" | "assigned" | "declined" | "completed" | "blocked";

export interface BandMemberSkill { slug: string; level: number; isHidden?: boolean; isPrivate?: boolean }
export interface BandCoverageMember { profileId: string; displayName?: string; assignedRoles?: SkillRoleKey[]; memberStatus?: "active" | "inactive" | "departed"; skills: BandMemberSkill[] }
export interface ActivityRelevance { sourceType: "gig" | "recording" | "songwriting" | "rehearsal"; sourceId: string; roleKeys?: SkillRoleKey[]; cancelled?: boolean }
export interface RoleCoverageEntry { role: SkillRoleKey; required: boolean; assignedMembers: string[]; readyMembers: string[]; secondaryCoverage: string[]; readinessBand: "missing" | "weak" | "covered" | "strong"; explanation: string }
export interface BandRoleCoverage { bandId: string; context: BandCoverageContext; requiredRoles: SkillRoleKey[]; optionalRoles: SkillRoleKey[]; roles: RoleCoverageEntry[]; missingCoverage: SkillRoleKey[]; weakCoverage: SkillRoleKey[]; duplicateCoverage: Array<{ role: SkillRoleKey; memberIds: string[]; usefulBackup: boolean; explanation: string }>; compositionScore: number; upcomingActivityRelevance: string[]; privacySafeExplanations: string[] }

const CONTEXT_ROLES: Record<BandCoverageContext, { required: SkillRoleKey[]; optional: SkillRoleKey[] }> = {
  general: { required: ["lead_vocalist", "lead_guitarist", "bassist", "drummer"], optional: ["keyboard_player", "songwriter", "producer", "bandleader", "backing_vocalist"] },
  gig: { required: ["lead_vocalist", "lead_guitarist", "bassist", "drummer", "live_frontperson"], optional: ["backing_vocalist", "keyboard_player", "sound_engineer", "bandleader"] },
  recording: { required: ["lead_vocalist", "lead_guitarist", "bassist", "drummer", "producer", "sound_engineer"], optional: ["backing_vocalist", "keyboard_player", "songwriter"] },
  songwriting: { required: ["songwriter"], optional: ["producer", "lead_vocalist", "lead_guitarist", "keyboard_player"] },
};

export function calculateMemberRoleReadiness(member: BandCoverageMember, role: SkillRoleKey): number {
  const links = CANONICAL_ROLE_LINKS.filter((link) => link.role_key === role);
  if (!links.length || member.memberStatus === "departed" || member.memberStatus === "inactive") return 0;
  const weighted = links.reduce((sum, link) => {
    const skill = member.skills.find((s) => s.slug === link.skill_slug && !s.isHidden && !s.isPrivate);
    return sum + Math.min(1, Math.max(0, skill?.level ?? 0) / Math.max(1, link.minimum_recommended_level)) * link.weight;
  }, 0);
  const total = links.reduce((sum, link) => sum + link.weight, 0) || 1;
  return Math.round((weighted / total) * 100);
}

export function getBandRoleCoverage(args: { bandId: string; members: BandCoverageMember[]; context?: BandCoverageContext; upcomingActivities?: ActivityRelevance[] }): BandRoleCoverage {
  const context = args.context ?? "general";
  const roles = CONTEXT_ROLES[context];
  const active = args.members.filter((m) => (m.memberStatus ?? "active") === "active");
  const allRoles = [...roles.required, ...roles.optional];
  const entries = allRoles.map((role): RoleCoverageEntry => {
    const scored = active.map((m) => ({ member: m, score: calculateMemberRoleReadiness(m, role), assigned: m.assignedRoles?.includes(role) ?? false })).filter((s) => s.score > 0 || s.assigned);
    const readyMembers = scored.filter((s) => s.score >= 70).map((s) => s.member.profileId);
    const secondaryCoverage = scored.filter((s) => s.score >= 35 && s.score < 70).map((s) => s.member.profileId);
    const assignedMembers = scored.filter((s) => s.assigned).map((s) => s.member.profileId);
    const best = Math.max(0, ...scored.map((s) => s.score));
    const readinessBand = best === 0 ? "missing" : best < 50 ? "weak" : best < 85 ? "covered" : "strong";
    return { role, required: roles.required.includes(role), assignedMembers, readyMembers, secondaryCoverage, readinessBand, explanation: `${role.replace(/_/g, " ")} is ${readinessBand}; shown as readiness bands only, not private exact XP or attributes.` };
  });
  const missingCoverage = entries.filter((e) => e.required && e.readinessBand === "missing").map((e) => e.role);
  const weakCoverage = entries.filter((e) => e.required && e.readinessBand === "weak").map((e) => e.role);
  const duplicateCoverage = entries.flatMap((e) => {
    const covered = [...e.readyMembers, ...e.secondaryCoverage];
    return covered.length > 1 ? [{ role: e.role, memberIds: covered, usefulBackup: e.required || e.role === "backing_vocalist" || context !== "general", explanation: covered.length > 1 && (e.required || context !== "general") ? "Backup coverage improves resilience." : "Consider broader coverage before more duplication." }] : [];
  });
  const coveredRequired = entries.filter((e) => e.required && ["covered", "strong"].includes(e.readinessBand)).length;
  const secondary = entries.filter((e) => e.secondaryCoverage.length > 0).length;
  const diversity = new Set(entries.flatMap((e) => [...e.readyMembers, ...e.secondaryCoverage].map((id) => `${id}:${e.role}`))).size;
  const compositionScore = Math.min(100, Math.round((coveredRequired / Math.max(1, roles.required.length)) * 70 + Math.min(15, secondary * 3) + Math.min(15, diversity * 2)));
  const upcomingActivityRelevance = (args.upcomingActivities ?? []).filter((a) => !a.cancelled).map((a) => `${a.sourceType}:${a.sourceId} needs ${(a.roleKeys ?? roles.required).map((r) => r.replace(/_/g, " ")).join(", ")}`);
  return { bandId: args.bandId, context, requiredRoles: roles.required, optionalRoles: roles.optional, roles: entries, missingCoverage, weakCoverage, duplicateCoverage, compositionScore, upcomingActivityRelevance, privacySafeExplanations: entries.map((e) => e.explanation) };
}

export const BAND_GOAL_TEMPLATES: Array<{ type: BandGoalType; title: string; requirementTypes: string[]; taskExamples: string[] }> = [
  { type: "gig_readiness", title: "Prepare for first gig", requirementTypes: ["gig_preparation", "role_readiness", "song_familiarity", "accepted_attendance", "rehearsal_count", "equipment_readiness"], taskExamples: ["Confirm attendance", "Improve setlist familiarity", "Schedule full-band rehearsal"] },
  { type: "recording_readiness", title: "Prepare for studio recording", requirementTypes: ["recording_preparation", "role_readiness", "song_familiarity", "accepted_attendance"], taskExamples: ["Assign producer or engineer", "Review recording plan"] },
  { type: "songwriting_capability", title: "Develop a songwriter", requirementTypes: ["skill_level", "teaching_session", "mentoring_goal"], taskExamples: ["Complete one collaboration", "Train composition or lyrics"] },
  { type: "newcomer_onboarding", title: "Onboard a new member", requirementTypes: ["role_readiness", "song_familiarity", "rehearsal_count"], taskExamples: ["Choose provisional role", "Attend first rehearsal"] },
  { type: "role_handover", title: "Plan a role handover", requirementTypes: ["role_readiness", "song_familiarity", "equipment_readiness"], taskExamples: ["Claim replacement coverage", "Rehearse first activity"] },
];

export function validateSynergyReward(args: { goalStatus: GoalStatus; participantProfileIds: string[]; relevantCompletedEventIds: string[]; distinctRoleKeys: SkillRoleKey[]; bonusPercent: number; departedProfileIds?: string[] }) {
  const uniqueParticipants = new Set(args.participantProfileIds.filter((id) => !(args.departedProfileIds ?? []).includes(id)));
  const uniqueEvents = new Set(args.relevantCompletedEventIds);
  const valid = args.goalStatus === "active" && uniqueParticipants.size >= 2 && uniqueEvents.size >= 2 && new Set(args.distinctRoleKeys).size >= 2 && args.bonusPercent > 0 && args.bonusPercent <= 5;
  return { valid, cappedBonusPercent: Math.min(5, Math.max(0, args.bonusPercent)), idempotencyKey: `band-goal-synergy:${[...uniqueEvents].sort().join("+")}` };
}
