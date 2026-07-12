export const RECORDING_BALANCE_VERSION = "recording_outcome_v1";

export type RecordingSessionMode = "professional" | "chilled" | "party" | string;
export type SkillMap = Record<string, number | undefined>;
export type AttributeMap = Record<string, number | undefined>;

export interface RecordingPerformerInput {
  profileId: string;
  role: string;
  accepted?: boolean;
  attended?: boolean;
  isSessionMusician?: boolean;
  skills: SkillMap;
  attributes: AttributeMap;
  songFamiliarity?: number | null;
  rehearsalReadiness?: number | null;
  health?: number | null;
  energy?: number | null;
  focus?: number | null;
  equipmentQuality?: number | null;
  equipmentSuitability?: number | null;
}

export interface RecordingStaffInput {
  id?: string | null;
  kind?: "npc" | "player" | "studio_default";
  rating?: number | null;
  skills?: SkillMap;
  attributes?: AttributeMap;
  genreFit?: number | null;
  studioFamiliarity?: number | null;
}

export interface RecordingStudioInput {
  id?: string | null;
  quality?: number | null;
  equipment?: number | null;
  roomAcoustics?: number | null;
  microphoneQuality?: number | null;
  monitoring?: number | null;
  maintenance?: number | null;
}

export interface RecordingOutcomeInput {
  sessionId: string;
  songId: string;
  sourceSongQuality: number;
  genre?: string | null;
  requiredRoles: string[];
  performers: RecordingPerformerInput[];
  studio?: RecordingStudioInput | null;
  producer?: RecordingStaffInput | null;
  engineer?: RecordingStaffInput | null;
  sessionMode?: RecordingSessionMode | null;
  effortHours: number;
  bandCohesion?: number | null;
  chemistry?: number | null;
  seed: string;
  existingOutcome?: RecordingOutcomeResult | null;
  balanceVersion?: string;
}

export interface RecordingOutcomeResult {
  balanceVersion: string;
  finalMasterQuality: number;
  sourceSongQuality: number;
  appliedVariance: number;
  qualityImprovement: number;
  breakdown: Record<string, unknown>;
  xpAwards: Array<{ profileId: string; skill: string; amount: number; reason: string }>;
  warnings: string[];
  strengths: string[];
  weaknesses: string[];
}

const ROLE_SKILLS: Record<string, { primary: string; supporting: string[]; attributes: string[]; exclusive?: boolean }> = {
  lead_vocals: { primary: "vocals", supporting: ["performance", "music_theory"], attributes: ["vocal_talent", "musicality", "mental_focus"], exclusive: true },
  backing_vocals: { primary: "vocals", supporting: ["performance", "harmony"], attributes: ["vocal_talent", "musicality", "mental_focus"] },
  lead_guitar: { primary: "guitar", supporting: ["performance", "music_theory"], attributes: ["musical_ability", "musicality", "mental_focus"], exclusive: true },
  rhythm_guitar: { primary: "guitar", supporting: ["rhythm", "performance"], attributes: ["rhythm_sense", "musical_ability", "mental_focus"], exclusive: true },
  bass: { primary: "bass", supporting: ["rhythm", "performance"], attributes: ["rhythm_sense", "musical_ability", "mental_focus"], exclusive: true },
  drums: { primary: "drums", supporting: ["rhythm", "performance"], attributes: ["rhythm_sense", "physical_endurance", "mental_focus"], exclusive: true },
  keyboards: { primary: "piano", supporting: ["music_theory", "composition"], attributes: ["musical_ability", "musicality", "mental_focus"], exclusive: true },
  electronic_production: { primary: "production", supporting: ["technical", "composition"], attributes: ["technical_mastery", "creative_insight", "mental_focus"], exclusive: true },
};

const aliases: Record<string, string> = { vocals: "lead_vocals", singer: "lead_vocals", guitar: "lead_guitar", drummer: "drums", keyboard: "keyboards", keys: "keyboards", producer: "electronic_production" };
const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));
const avg = (xs: number[], fallback = 0) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback;
const level = (m: Record<string, number | undefined> | undefined, k: string) => clamp(Number(m?.[k] ?? 0));
const normRole = (role: string) => aliases[role.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")] ?? role.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function seededVariance(seed: string, width = 0.035) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const unit = ((h >>> 0) % 10000) / 10000;
  return (unit * 2 - 1) * width;
}

function staffScore(staff: RecordingStaffInput | null | undefined, fallback: number, primary: string) {
  if (!staff?.id && staff?.kind !== "studio_default") return fallback;
  const skill = Math.max(level(staff.skills, primary), level(staff.skills, "technical"), level(staff.skills, "production"));
  const attrs = avg([level(staff.attributes, "technical_mastery"), level(staff.attributes, "creative_insight"), level(staff.attributes, "mental_focus")], 50);
  const rating = clamp(Number(staff.rating ?? fallback));
  const fit = clamp(Number(staff.genreFit ?? 55));
  const familiarity = clamp(Number(staff.studioFamiliarity ?? 50));
  return clamp(rating * .38 + skill * .28 + attrs * .18 + fit * .10 + familiarity * .06);
}

function roleSkill(role: string) { return ROLE_SKILLS[normRole(role)] ?? { primary: normRole(role), supporting: ["performance"], attributes: ["musical_ability", "mental_focus"] }; }

function performerScore(p: RecordingPerformerInput, durationFatigue: number) {
  const map = roleSkill(p.role);
  const primary = level(p.skills, map.primary);
  const supporting = avg(map.supporting.map((s) => level(p.skills, s)), primary * .35);
  const attrs = avg(map.attributes.map((a) => level(p.attributes, a)), 50);
  const familiarity = clamp(Number(p.songFamiliarity ?? 35));
  const rehearsal = clamp(Number(p.rehearsalReadiness ?? 35));
  const condition = clamp(avg([Number(p.health ?? 85), Number(p.energy ?? 85), Number(p.focus ?? p.attributes?.mental_focus ?? 75)]) - durationFatigue);
  const equipment = clamp(avg([Number(p.equipmentQuality ?? 55), Number(p.equipmentSuitability ?? 60)], 58));
  const raw = primary * .54 + supporting * .12 + familiarity * .11 + rehearsal * .06 + attrs * .09 + condition * .05 + equipment * .03;
  const score = clamp(raw);
  return { profileId: p.profileId, role: normRole(p.role), score, primarySkill: map.primary, primary, supporting, attributes: attrs, familiarity, rehearsal, condition, equipment, attended: p.accepted !== false && p.attended !== false, sessionMusician: !!p.isSessionMusician };
}

export function calculateRecordingOutcome(input: RecordingOutcomeInput): RecordingOutcomeResult {
  if (input.existingOutcome) return input.existingOutcome;
  const balanceVersion = input.balanceVersion ?? RECORDING_BALANCE_VERSION;
  const required = Array.from(new Set((input.requiredRoles.length ? input.requiredRoles : ["lead_vocals", "lead_guitar", "bass", "drums"]).map(normRole)));
  const active = input.performers.filter((p) => p.accepted !== false && p.attended !== false);
  const warnings: string[] = [];
  const duplicates = new Set<string>();
  for (const role of required) {
    const cfg = ROLE_SKILLS[role];
    const count = active.filter((p) => normRole(p.role) === role).length;
    if (count === 0) warnings.push(`Missing required role: ${role}`);
    if (cfg?.exclusive && count > 1) duplicates.add(role);
  }
  duplicates.forEach((r) => warnings.push(`Duplicate exclusive assignment: ${r}`));
  input.performers.filter((p) => p.accepted === false || p.attended === false).forEach((p) => warnings.push(`Unaccepted or absent participant excluded: ${p.profileId}`));

  const days = clamp(input.effortHours / 24, 0.25, 7);
  const durationBenefit = clamp(62 + Math.log2(1 + days) * 19, 50, 92);
  const durationFatigue = Math.max(0, days - 3) * 2.5;
  const performerBreakdowns = active.map((p) => performerScore(p, durationFatigue));
  const roleScores = required.map((role) => {
    const candidates = performerBreakdowns.filter((p) => p.role === role).sort((a, b) => b.score - a.score);
    return candidates[0]?.score ?? 18;
  });
  const missingPenalty = clamp(1 - required.filter((r) => !performerBreakdowns.some((p) => p.role === r)).length * .13 - duplicates.size * .06, .45, 1);
  const performerExecution = clamp(avg(roleScores, 35) * missingPenalty);
  const vocalPerformance = avg(roleScores.filter((_, i) => required[i].includes("vocal")), performerExecution);
  const instrumentalPerformance = avg(roleScores.filter((_, i) => !required[i].includes("vocal")), performerExecution);
  const readiness = clamp(avg([Number(input.bandCohesion ?? 50), Number(input.chemistry ?? 50), avg(performerBreakdowns.map((p) => p.familiarity), 35), avg(performerBreakdowns.map((p) => p.rehearsal), 35)]));
  const ensembleTightness = clamp(readiness * .55 + avg(performerBreakdowns.map((p) => p.attributes), 50) * .20 + performerExecution * .25);

  const studio = input.studio ?? {};
  const studioCapture = clamp(avg([Number(studio.quality ?? 55), Number(studio.equipment ?? 55), Number(studio.roomAcoustics ?? studio.quality ?? 55), Number(studio.microphoneQuality ?? studio.equipment ?? 55), Number(studio.monitoring ?? studio.equipment ?? 55), Number(studio.maintenance ?? 70)]));
  const engineer = staffScore(input.engineer, clamp(studioCapture * .72, 35, 70), "engineering");
  const producer = staffScore(input.producer, 48, "production");
  const mode = input.sessionMode ?? "professional";
  const modeCfg = mode === "party" ? { tech: .94, readiness: 1.04, variance: .055, efficiency: .90 } : mode === "chilled" ? { tech: .98, readiness: 1.06, variance: .04, efficiency: .96 } : { tech: 1.04, readiness: .99, variance: .028, efficiency: 1.05 };
  const productionQuality = clamp((producer * .72 + readiness * .18 + durationBenefit * .10) * modeCfg.tech);
  const engineeringQuality = clamp((engineer * .70 + studioCapture * .20 + durationBenefit * .10) * modeCfg.tech);
  const mixQuality = clamp(engineeringQuality * .55 + productionQuality * .30 + studioCapture * .15);
  const sessionEfficiency = clamp(durationBenefit * .45 + avg(performerBreakdowns.map((p) => p.condition), 75) * .25 + producer * .15 + engineer * .15);
  const readinessContribution = clamp(ensembleTightness * modeCfg.readiness);
  const variance = seededVariance(input.seed, modeCfg.variance) * (1 - clamp((producer + engineer + readiness) / 600, 0, .32));
  const preVariance = clamp(input.sourceSongQuality) * .35 + performerExecution * .30 + ((productionQuality + engineeringQuality + mixQuality) / 3) * .20 + studioCapture * .08 + readinessContribution * .07;
  const sourceCeiling = clamp(58 + clamp(input.sourceSongQuality) * .42 + performerExecution * .16 + productionQuality * .12 + studioCapture * .08 - (1 - missingPenalty) * 18, 35, 100);
  const floor = clamp(12 + performerExecution * .18 + engineeringQuality * .10 + studioCapture * .08, 0, 72);
  const finalMasterQuality = Math.round(clamp(preVariance * (1 + variance), floor, sourceCeiling));
  const qualityImprovement = Math.round(finalMasterQuality - clamp(input.sourceSongQuality));
  const strengths = [performerExecution >= 75 && "Strong role execution", studioCapture >= 75 && "High-quality studio capture", producer >= 75 && "Producer elevated consistency", readiness >= 75 && "Rehearsal and cohesion were strong"].filter(Boolean) as string[];
  const weaknesses = [performerExecution < 45 && "Performer execution held the master back", studioCapture < 45 && "Studio capture limited fidelity", readiness < 45 && "Low familiarity or cohesion increased retakes", warnings.length > 0 && "Role coverage or attendance issues reduced the ceiling"].filter(Boolean) as string[];
  const xpAwards = performerBreakdowns.map((p) => ({ profileId: p.profileId, skill: roleSkill(p.role).primary, amount: Math.max(8, Math.round(days * (10 + p.score / 10))), reason: `Recorded ${p.role}` }));
  if (input.producer?.id && input.producer.kind === "player") xpAwards.push({ profileId: input.producer.id, skill: "production", amount: Math.max(8, Math.round(days * (12 + producer / 10))), reason: "Produced recording session" });
  if (input.engineer?.id && input.engineer.kind === "player") xpAwards.push({ profileId: input.engineer.id, skill: "engineering", amount: Math.max(8, Math.round(days * (12 + engineer / 10))), reason: "Engineered recording session" });
  return { balanceVersion, finalMasterQuality, sourceSongQuality: clamp(input.sourceSongQuality), appliedVariance: Number(variance.toFixed(4)), qualityImprovement, warnings, strengths, weaknesses, xpAwards, breakdown: { balanceVersion, weights: { sourceSong: .35, performerExecution: .30, productionEngineeringMix: .20, studioCapture: .08, readinessCohesion: .07 }, songPotential: clamp(input.sourceSongQuality), performerExecution, vocalPerformance, instrumentalPerformance, ensembleTightness, arrangementReadiness: readiness, captureQuality: studioCapture, productionQuality, engineeringQuality, mixQuality, sessionEfficiency, durationBenefit, mode, missingPenalty, sourceCeiling, floor, performerBreakdowns, warnings, strengths, weaknesses } };
}
