export const GIG_OUTCOME_BALANCE_VERSION = "gig_live_outcome_v1";

export type ScoreMap = Record<string, number | undefined>;

export interface GigPerformerInput {
  profileId: string;
  role: string;
  accepted?: boolean;
  attended?: boolean;
  compatibleRoles?: string[];
  skills: ScoreMap;
  attributes: ScoreMap;
  health?: number | null;
  energy?: number | null;
  stress?: number | null;
  fatigue?: number | null;
  equipmentQuality?: number | null;
  equipmentSuitability?: number | null;
  equipmentMissing?: boolean;
  isSubstitute?: boolean;
}

export interface GigSongInput {
  id: string;
  title?: string | null;
  durationSeconds?: number | null;
  difficulty?: number | null;
  arrangementComplexity?: number | null;
  familiarityByProfile?: ScoreMap;
  rehearsalReadiness?: number | null;
  crowdFit?: number | null;
  tempo?: number | null;
  mood?: string | null;
  isEncore?: boolean;
}

export interface GigOutcomeInput {
  gigId: string;
  bandId: string;
  venueId?: string | null;
  participantAssignments: GigPerformerInput[];
  requiredRoles?: string[];
  songs: GigSongInput[];
  slotDurationSeconds?: number | null;
  bandCohesion?: number | null;
  chemistry?: number | null;
  rehearsalReadiness?: number | null;
  crewReadiness?: number | null;
  stageSetupQuality?: number | null;
  stageSetupComplexity?: number | null;
  venueQuality?: number | null;
  venueGenreFit?: number | null;
  audienceSize?: number | null;
  venueCapacity?: number | null;
  fame?: number | null;
  ticketPrice?: number | null;
  localPopularity?: number | null;
  seed: string;
  balanceVersion?: string;
  existingOutcome?: GigOutcomeResult | null;
}

export interface MemberExecutionBreakdown {
  profileId: string;
  role: string;
  score: number;
  primarySkill: string;
  primary: number;
  supporting: number;
  familiarity: number;
  rehearsal: number;
  attributes: number;
  condition: number;
  equipment: number;
  accepted: boolean;
  attended: boolean;
  warnings: string[];
}

export interface SongPerformanceBreakdown {
  songId: string;
  title?: string | null;
  position: number;
  technicalScore: number;
  stageScore: number;
  audienceResponse: number;
  crowdState: string;
  momentumBefore: number;
  momentumAfter: number;
  fatiguePenalty: number;
  variance: number;
  events: string[];
  memberExecutions: MemberExecutionBreakdown[];
}

export interface GigOutcomeResult {
  balanceVersion: string;
  technicalScore: number;
  ensembleScore: number;
  setlistFlowScore: number;
  stagePerformanceScore: number;
  audienceResponseScore: number;
  crowdSatisfaction: number;
  fanGrowth: { localFans: number; broaderFans: number };
  reputationChange: number;
  fatigueImpact: Array<{ profileId: string; healthDelta: number; energyDelta: number; fatigueDelta: number }>;
  xpAwards: Array<{ profileId: string; skill: string; amount: number; reason: string }>;
  appliedVariance: number;
  readinessStatus: "Not Ready" | "Risky" | "Prepared" | "Strong" | "Tour Ready";
  warnings: string[];
  strengths: string[];
  weaknesses: string[];
  notableEvents: string[];
  memberExecutions: MemberExecutionBreakdown[];
  songPerformances: SongPerformanceBreakdown[];
  breakdown: Record<string, unknown>;
}

const ROLE_MAP: Record<string, { primary: string; supporting: string[]; technicalAttributes: string[]; stageRole?: boolean; exclusive?: boolean; intensity: number }> = {
  lead_vocals: { primary: "vocals", supporting: ["performance", "music_theory"], technicalAttributes: ["vocal_talent", "musicality", "mental_focus"], stageRole: true, exclusive: true, intensity: 1.05 },
  backing_vocals: { primary: "vocals", supporting: ["harmony", "performance"], technicalAttributes: ["vocal_talent", "musicality", "mental_focus"], stageRole: true, intensity: .8 },
  lead_guitar: { primary: "guitar", supporting: ["performance", "music_theory"], technicalAttributes: ["musical_ability", "musicality", "mental_focus"], exclusive: true, intensity: .95 },
  rhythm_guitar: { primary: "guitar", supporting: ["rhythm", "performance"], technicalAttributes: ["rhythm_sense", "musical_ability", "mental_focus"], exclusive: true, intensity: .9 },
  bass: { primary: "bass", supporting: ["rhythm", "performance"], technicalAttributes: ["rhythm_sense", "musical_ability", "mental_focus"], exclusive: true, intensity: .9 },
  drums: { primary: "drums", supporting: ["rhythm", "performance"], technicalAttributes: ["rhythm_sense", "physical_endurance", "mental_focus"], exclusive: true, intensity: 1.18 },
  keyboards: { primary: "piano", supporting: ["music_theory", "performance"], technicalAttributes: ["musical_ability", "musicality", "mental_focus"], exclusive: true, intensity: .82 },
  dj: { primary: "dj", supporting: ["production", "performance"], technicalAttributes: ["technical_mastery", "rhythm_sense", "mental_focus"], exclusive: true, intensity: .86 },
};
const aliases: Record<string, string> = { vocals: "lead_vocals", singer: "lead_vocals", "lead vocals": "lead_vocals", guitar: "lead_guitar", drummer: "drums", keyboard: "keyboards", keys: "keyboards" };
const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));
const avg = (xs: number[], fallback = 0) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : fallback;
const norm = (s: string) => aliases[s.toLowerCase().trim()] ?? s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const level = (m: ScoreMap | undefined, k: string) => clamp(Number(m?.[k] ?? 0));
function seededUnit(seed: string) { let h = 2166136261; for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619); return ((h >>> 0) % 10000) / 10000; }
export function seededVariance(seed: string, width = 0.04) { return (seededUnit(seed) * 2 - 1) * width; }
function roleCfg(role: string) { return ROLE_MAP[norm(role)] ?? { primary: norm(role), supporting: ["performance"], technicalAttributes: ["musical_ability", "mental_focus"], intensity: .9 }; }

export function calculateMemberExecution(p: GigPerformerInput, roleFamiliarity: number, rehearsal: number, progressiveFatigue: number): MemberExecutionBreakdown {
  const cfg = roleCfg(p.role);
  const accepted = p.accepted !== false;
  const attended = p.attended !== false;
  const warnings: string[] = [];
  if (!accepted || !attended) warnings.push(`Unaccepted or absent performer excluded: ${p.profileId}`);
  if (p.compatibleRoles?.length && !p.compatibleRoles.map(norm).includes(norm(p.role))) warnings.push(`Performer ${p.profileId} is assigned to an incompatible role: ${norm(p.role)}`);
  if (p.equipmentMissing) warnings.push(`Missing equipment for ${p.profileId} (${norm(p.role)})`);
  const primary = level(p.skills, cfg.primary);
  const supporting = avg(cfg.supporting.map((s) => level(p.skills, s)), primary * .35);
  const attrs = avg(cfg.technicalAttributes.map((a) => level(p.attributes, a)), 50);
  const condition = clamp(avg([Number(p.health ?? 85), Number(p.energy ?? 85), 100 - Number(p.stress ?? 20), 100 - Number(p.fatigue ?? 15)], 75) - progressiveFatigue);
  const equipment = p.equipmentMissing ? 18 : clamp(avg([Number(p.equipmentQuality ?? 55), Number(p.equipmentSuitability ?? 60)], 58));
  const score = (!accepted || !attended) ? 0 : clamp(primary * .56 + supporting * .12 + clamp(roleFamiliarity) * .12 + clamp(rehearsal) * .07 + attrs * .07 + condition * .04 + equipment * .02);
  return { profileId: p.profileId, role: norm(p.role), score, primarySkill: cfg.primary, primary, supporting, familiarity: clamp(roleFamiliarity), rehearsal: clamp(rehearsal), attributes: attrs, condition, equipment, accepted, attended, warnings };
}

function setlistFlow(songs: GigSongInput[], slot = 3600) {
  if (!songs.length) return { score: 0, warnings: ["A locked setlist with at least one song is required."], details: {} };
  const total = songs.reduce((s, x) => s + (x.durationSeconds ?? 0), 0);
  const warnings: string[] = [];
  if (songs.some((s) => !s.durationSeconds || s.durationSeconds <= 0)) warnings.push("Every setlist song needs a valid duration.");
  const ratio = total / Math.max(1, slot);
  if (ratio > 1.08) warnings.push("Set exceeds the booked duration and will hurt satisfaction.");
  if (ratio < .75) warnings.push("Set is much shorter than the booked slot.");
  const opener = clamp(100 - Math.abs(70 - (songs[0].crowdFit ?? 55)) * .8);
  const closer = clamp(100 - Math.abs(78 - (songs[songs.length - 1].crowdFit ?? 55)) * .75);
  let variety = 75;
  for (let i = 1; i < songs.length; i++) if (Math.abs((songs[i].tempo ?? 100) - (songs[i - 1].tempo ?? 100)) < 6 && songs[i].mood === songs[i - 1].mood) variety -= 8;
  const durationFit = clamp(100 - Math.abs(1 - ratio) * 150);
  return { score: clamp(opener * .24 + closer * .24 + variety * .22 + durationFit * .30), warnings, details: { totalDurationSeconds: total, slotDurationSeconds: slot, opener, closer, variety, durationFit } };
}

export function calculateGigOutcome(input: GigOutcomeInput): GigOutcomeResult {
  if (input.existingOutcome) return input.existingOutcome;
  const required = Array.from(new Set((input.requiredRoles?.length ? input.requiredRoles : ["lead_vocals", "lead_guitar", "bass", "drums"]).map(norm)));
  const warnings: string[] = [];
  const active = input.participantAssignments.filter((p) => p.accepted !== false && p.attended !== false);
  for (const role of required) {
    const count = active.filter((p) => norm(p.role) === role).length;
    if (!count) warnings.push(`Missing required role: ${role}`);
    if (ROLE_MAP[role]?.exclusive && count > 1) warnings.push(`Duplicate exclusive assignment: ${role}`);
  }
  input.participantAssignments.filter((p) => p.accepted === false || p.attended === false).forEach((p) => warnings.push(`Unaccepted or absent performer excluded: ${p.profileId}`));
  input.participantAssignments.filter((p) => p.compatibleRoles?.length && !p.compatibleRoles.map(norm).includes(norm(p.role))).forEach((p) => warnings.push(`Incompatible role assignment: ${p.profileId} as ${norm(p.role)}`));
  input.participantAssignments.filter((p) => p.equipmentMissing).forEach((p) => warnings.push(`Equipment missing for assigned role: ${p.profileId}`));
  const flow = setlistFlow(input.songs, input.slotDurationSeconds ?? 3600); warnings.push(...flow.warnings);

  let momentum = 0;
  const cumulativeFatigue: Record<string, number> = {};
  const songPerformances = input.songs.map((song, index) => {
    const songMemberExecutions = active.map((p) => {
      const cfg = roleCfg(p.role);
      const durationMin = (song.durationSeconds ?? 180) / 60;
      const endurance = level(p.attributes, "physical_endurance") || 50;
      cumulativeFatigue[p.profileId] = (cumulativeFatigue[p.profileId] ?? 0) + durationMin * cfg.intensity * (1 - endurance / 180);
      return calculateMemberExecution(p, Number(song.familiarityByProfile?.[p.profileId] ?? 35), Number(song.rehearsalReadiness ?? input.rehearsalReadiness ?? 35), cumulativeFatigue[p.profileId]);
    });
    const roleScores = required.map((r) => songMemberExecutions.filter((m) => m.role === r).sort((a,b) => b.score-a.score)[0]?.score ?? 15);
    const memberExecution = avg(roleScores, 25);
    const cohesion = clamp(avg([Number(input.bandCohesion ?? 50), Number(input.chemistry ?? 50)]));
    const crew = clamp(Number(input.crewReadiness ?? 50));
    const venue = clamp(Number(input.venueQuality ?? 55));
    const difficultyPenalty = (clamp(Number(song.difficulty ?? 45)) + clamp(Number(song.arrangementComplexity ?? 45))) / 28;
    const varianceWidth = .045 * (1 - clamp((cohesion + Number(input.rehearsalReadiness ?? 45)) / 500, 0, .25)) + Math.max(0, Number(input.stageSetupComplexity ?? 50) - crew) / 2500;
    const variance = seededVariance(`${input.seed}:${song.id}:${index}`, varianceWidth);
    const technicalScore = clamp((memberExecution * .58 + clamp(Number(song.rehearsalReadiness ?? input.rehearsalReadiness ?? 35)) * .11 + avg(songMemberExecutions.map((m) => m.familiarity), 35) * .12 + crew * .05 + venue * .04 + cohesion * .10) * (1 + variance) - difficultyPenalty);
    const stageAttrs = avg(active.map((p) => avg([level(p.attributes, "stage_presence"), level(p.attributes, "crowd_engagement"), level(p.attributes, "charisma")], 45)), 45);
    const frontperson = avg(active.filter((p) => roleCfg(p.role).stageRole).map((p) => avg([level(p.attributes, "stage_presence"), level(p.attributes, "crowd_engagement"), level(p.attributes, "charisma")], 45)), stageAttrs);
    const stageScore = clamp(stageAttrs * .38 + frontperson * .24 + clamp(Number(input.stageSetupQuality ?? 50)) * .14 + flow.score * .12 + momentum * .04 + crew * .08);
    const expectation = clamp(42 + Math.log10(1 + Math.max(0, Number(input.fame ?? 0))) * 12 + Math.max(0, Number(input.ticketPrice ?? 0) - 15) * .7 + (Number(input.venueCapacity ?? 0) > 800 ? 6 : 0));
    const expectationPerf = clamp(60 + ((technicalScore * .55 + stageScore * .45) - expectation) * .55);
    const audienceResponse = clamp(technicalScore * .40 + stageScore * .25 + flow.score * .13 + avg([Number(input.venueGenreFit ?? 55), Number(song.crowdFit ?? 55), Number(input.localPopularity ?? 35)], 50) * .10 + expectationPerf * .08 + (momentum + 100) * .02);
    const before = momentum;
    momentum = clamp(momentum + (audienceResponse - 58) * .8 + (index === 0 ? (audienceResponse - 55) * .2 : 0) + (song.isEncore ? 6 : 0), -100, 100);
    const events = [technicalScore < 35 && "missed cue", stageScore > 80 && "excellent crowd interaction", technicalScore > 82 && cohesion > 70 && "smooth recovery", songMemberExecutions.some((m) => m.equipment < 30) && "equipment fault"].filter(Boolean) as string[];
    return { songId: song.id, title: song.title, position: index, technicalScore: Math.round(technicalScore), stageScore: Math.round(stageScore), audienceResponse: Math.round(audienceResponse), crowdState: audienceResponse >= 88 ? "ecstatic" : audienceResponse >= 76 ? "jumping" : audienceResponse >= 66 ? "hands up" : audienceResponse >= 54 ? "engaged" : audienceResponse >= 42 ? "attentive" : "bored", momentumBefore: Math.round(before), momentumAfter: Math.round(momentum), fatiguePenalty: Number(avg(songMemberExecutions.map((m) => 100 - m.condition), 0).toFixed(2)), variance: Number(variance.toFixed(4)), events, memberExecutions: songMemberExecutions };
  });
  const memberExecutions = active.map((p) => calculateMemberExecution(p, avg(input.songs.map((s) => Number(s.familiarityByProfile?.[p.profileId] ?? 35)), 35), Number(input.rehearsalReadiness ?? 35), cumulativeFatigue[p.profileId] ?? 0));
  const technicalScore = Math.round(avg(songPerformances.map((s) => s.technicalScore), 0));
  const stagePerformanceScore = Math.round(avg(songPerformances.map((s) => s.stageScore), 0));
  const audienceResponseScore = Math.round(avg(songPerformances.map((s) => s.audienceResponse), 0));
  const ensembleScore = Math.round(clamp(avg([technicalScore, Number(input.bandCohesion ?? 50), Number(input.chemistry ?? 50), Number(input.rehearsalReadiness ?? 40)])));
  const audienceSize = Math.max(0, Math.round(Number(input.audienceSize ?? Math.min(Number(input.venueCapacity ?? 100), 100))));
  const expectationExceeded = audienceResponseScore - (42 + Math.log10(1 + Math.max(0, Number(input.fame ?? 0))) * 12);
  const localFans = Math.max(-Math.round(audienceSize * .08), Math.round(audienceSize * clamp((audienceResponseScore - 50) / 100, -.08, .22) * (expectationExceeded > 0 ? 1.15 : .85)));
  const broaderFans = Math.max(0, Math.round(localFans * clamp(Math.log10(10 + audienceSize) / 12, 0, .35)));
  const reputationChange = Math.round(clamp((audienceResponseScore - 58) / 6 + expectationExceeded / 10, -12, 14));
  const readinessComposite = clamp(avg([technicalScore, flow.score, Number(input.rehearsalReadiness ?? 35), avg(memberExecutions.map((m) => m.familiarity), 35)]));
  const readinessStatus = readinessComposite >= 90 ? "Tour Ready" : readinessComposite >= 76 ? "Strong" : readinessComposite >= 58 ? "Prepared" : readinessComposite >= 38 ? "Risky" : "Not Ready";
  const xpAwards = memberExecutions.filter((m) => m.score > 0).map((m) => ({ profileId: m.profileId, skill: roleCfg(m.role).primary, amount: Math.max(5, Math.round(input.songs.length * (6 + m.score / 18))), reason: `Completed live gig as ${m.role}` }));
  const fatigueImpact = memberExecutions.map((m) => ({ profileId: m.profileId, healthDelta: -Math.round((cumulativeFatigue[m.profileId] ?? 0) / 8), energyDelta: -Math.round((cumulativeFatigue[m.profileId] ?? 0) / 2), fatigueDelta: Math.round(cumulativeFatigue[m.profileId] ?? 0) }));
  const strengths = [technicalScore >= 75 && "Strong technical performance", stagePerformanceScore >= 75 && "Commanding stage performance", flow.score >= 75 && "Well-paced setlist", audienceResponseScore >= 75 && "Audience expectations were exceeded"].filter(Boolean) as string[];
  const weaknesses = [technicalScore < 45 && "Role execution held songs back", flow.score < 45 && "Setlist flow or duration hurt momentum", stagePerformanceScore < 45 && "Stagecraft limited audience response", warnings.length > 0 && "Preparation warnings affected the show"].filter(Boolean) as string[];
  const appliedVariance = Number(avg(songPerformances.map((s) => s.variance), 0).toFixed(4));
  return { balanceVersion: input.balanceVersion ?? GIG_OUTCOME_BALANCE_VERSION, technicalScore, ensembleScore, setlistFlowScore: Math.round(flow.score), stagePerformanceScore, audienceResponseScore, crowdSatisfaction: audienceResponseScore, fanGrowth: { localFans, broaderFans }, reputationChange, fatigueImpact, xpAwards, appliedVariance, readinessStatus, warnings: [...warnings, ...memberExecutions.flatMap((m) => m.warnings)], strengths, weaknesses, notableEvents: Array.from(new Set(songPerformances.flatMap((s) => s.events))), memberExecutions, songPerformances, breakdown: { weights: { memberExecution: { primaryRoleSkill: .56, supportingSkills: .12, songFamiliarity: .12, rehearsal: .07, attributes: .07, condition: .04, equipment: .02 }, audienceResponse: { technical: .40, stage: .25, setlistFlow: .13, venueAndGenreFit: .10, expectationPerformance: .08, momentum: .04 } }, requiredRoles: required, setlistFlow: flow.details, expectationExceeded, momentumFinal: Math.round(momentum) } };
}
