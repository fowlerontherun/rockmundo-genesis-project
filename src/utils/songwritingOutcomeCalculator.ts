export const SONGWRITING_BALANCE_VERSION = "songwriting_progression_v2";

export type SongwritingSessionType = "balanced" | "music" | "lyrics" | "arrangement" | "polish";
export type SongwritingMode = "standard" | "commercial" | "experimental" | "acoustic" | "instrumental" | "lyric_focused" | string;

export type SkillMap = Record<string, number | undefined>;
export type AttributeMap = Record<string, number | undefined>;

export interface SongwritingContributorInput {
  profileId: string;
  role?: "composer" | "lyricist" | "arranger" | "producer" | "topline_writer" | "co_writer" | string;
  participationWeight?: number;
  accepted?: boolean;
  attended?: boolean;
  skills: SkillMap;
  attributes: AttributeMap;
}

export interface SongwritingProjectChoices {
  genres?: string[];
  mode?: SongwritingMode | null;
  purpose?: string | null;
  chordDifficulty?: number | null;
  hasInitialLyrics?: boolean;
  instruments?: string[];
}

export interface SongwritingProjectState {
  musicProgress: number;
  lyricsProgress: number;
  arrangementProgress?: number;
  polish?: number;
  consistency?: number;
  totalSessions?: number;
  repeatedSessionCount?: number;
  health?: number;
  energy?: number;
  stress?: number;
}

export interface SongwritingSessionInput {
  sessionType: SongwritingSessionType;
  effortHours: 1 | 2 | 4;
  projectChoices: SongwritingProjectChoices;
  state: SongwritingProjectState;
  contributors: SongwritingContributorInput[];
}

export interface SongwritingSessionResult {
  musicProgressGained: number;
  lyricsProgressGained: number;
  arrangementProgressGained: number;
  polishGained: number;
  consistencyGained: number;
  xpAwards: Record<string, number>;
  breakdown: Record<string, unknown>;
}

export interface SongwritingFinalResult {
  finalScore: number;
  potential: number;
  breakdown: Record<string, unknown>;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const level = (skills: SkillMap, slug: string) => clamp(Number(skills[slug] ?? 0), 0, 100);
const attr = (attributes: AttributeMap, key: string) => clamp(Number(attributes[key] ?? 0), 0, 100);
const weighted = (parts: Array<[number, number]>) => parts.reduce((sum, [value, weight]) => sum + value * weight, 0);

export function genreSkillSlug(genre?: string, tier: "basic" | "professional" | "mastery" = "basic") {
  if (!genre) return null;
  const slug = genre.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return slug ? `genres_${tier}_${slug}` : null;
}

function contributorCraft(c: SongwritingContributorInput, type: SongwritingSessionType, choices: SongwritingProjectChoices) {
  const s = c.skills;
  const genreBasic = choices.genres?.map((g) => level(s, genreSkillSlug(g) ?? "")).reduce((a, b, _, arr) => a + b / arr.length, 0) ?? 0;
  const instrument = Math.max(level(s, "guitar"), level(s, "bass"), level(s, "drums"), level(s, "vocals"));
  const base = type === "lyrics" || choices.mode === "lyric_focused"
    ? weighted([[level(s, "songwriting"), .36], [level(s, "composition"), .16], [level(s, "vocals"), .12], [genreBasic, .20], [instrument, .16]])
    : type === "arrangement" || type === "polish"
      ? weighted([[level(s, "composition"), .34], [level(s, "technical"), .20], [level(s, "songwriting"), .20], [genreBasic, .14], [instrument, .12]])
      : weighted([[level(s, "songwriting"), .34], [level(s, "composition"), .24], [level(s, "technical"), .10], [genreBasic, .17], [instrument, .15]]);
  return clamp(base, 0, 100);
}

function contributorAttributes(c: SongwritingContributorInput, type: SongwritingSessionType) {
  const a = c.attributes;
  return clamp(weighted([
    [attr(a, "creative_insight"), type === "lyrics" ? .30 : .22],
    [attr(a, "musical_ability"), .20],
    [attr(a, "musicality"), .18],
    [attr(a, "mental_focus"), .16],
    [attr(a, "rhythm_sense"), .08],
    [attr(a, "vocal_talent"), type === "lyrics" ? .06 : .03],
    [attr(a, "technical_mastery"), type === "arrangement" || type === "polish" ? .15 : .05],
  ]), 0, 100);
}

export function collaborationModifier(contributors: SongwritingContributorInput[], choices: SongwritingProjectChoices) {
  const active = contributors.filter((c) => c.accepted !== false && c.attended !== false);
  if (active.length <= 1) return { modifier: 1, quality: 0, activeCount: active.length };
  const roles = new Set(active.map((c) => c.role ?? "co_writer"));
  const complement = clamp((roles.size - 1) * 0.035, 0, 0.12);
  const support = active.slice(1).reduce((sum, c, i) => sum + contributorCraft(c, "balanced", choices) * (0.12 / (i + 1)), 0) / 100;
  const coordination = Math.max(0, active.length - 3) * 0.035;
  return { modifier: clamp(1 + complement + support - coordination, 0.9, 1.18), quality: Math.round((complement + support - coordination) * 1000), activeCount: active.length };
}

export function calculateSongwritingSession(input: SongwritingSessionInput): SongwritingSessionResult {
  const active = input.contributors.filter((c) => c.accepted !== false && c.attended !== false);
  const lead = active[0] ?? input.contributors[0];
  if (!lead) throw new Error("At least one active contributor is required");
  const craft = contributorCraft(lead, input.sessionType, input.projectChoices);
  const attributes = contributorAttributes(lead, input.sessionType);
  const duration = ({ 1: 1, 2: 1.9, 4: 3.4 } as const)[input.effortHours];
  const wellness = clamp(((input.state.health ?? 85) / 85) * 0.7 + ((input.state.energy ?? 85) / 85) * 0.25 - ((input.state.stress ?? 20) / 100) * 0.10, 0.72, 1.08);
  const difficulty = clamp(1.08 - ((input.projectChoices.chordDifficulty ?? 3) - 3) * 0.055, 0.82, 1.12);
  const repetition = clamp(1 - (input.state.repeatedSessionCount ?? 0) * 0.08, 0.62, 1);
  const collab = collaborationModifier(active, input.projectChoices);
  const skillEfficiency = 0.72 + craft / 250; // 0.72-1.12
  const attrEfficiency = 0.94 + attributes / 600; // capped support, not replacement
  const base = 170 * duration * skillEfficiency * attrEfficiency * wellness * difficulty * repetition * collab.modifier;
  const completion = Math.min(input.state.musicProgress, input.state.lyricsProgress) / 2000;
  const polishPhase = completion >= 1;
  const polishDiminish = polishPhase ? clamp(1 - ((input.state.totalSessions ?? 0) - 3) * 0.12, 0.20, 0.70) : 1;
  const musicWeight = input.sessionType === "lyrics" ? .35 : input.sessionType === "polish" ? .2 : input.projectChoices.mode === "lyric_focused" ? .45 : .58;
  const lyricsWeight = input.projectChoices.mode === "instrumental" ? .18 : input.sessionType === "music" ? .35 : input.sessionType === "polish" ? .2 : .58;
  const arrangementWeight = input.sessionType === "arrangement" ? .55 : .18;
  const music = polishPhase ? 0 : Math.round(base * musicWeight);
  const lyrics = polishPhase ? 0 : Math.round(base * lyricsWeight);
  const arrangement = Math.round((polishPhase ? base * 0.1 : base * arrangementWeight));
  const polish = Math.round((polishPhase ? base * .45 * polishDiminish : base * .06));
  const consistency = Math.round((craft * .45 + attributes * .25 + collab.quality * .03) * duration / 10);
  const xpBase = Math.max(8, Math.round(input.effortHours * (8 + ((input.projectChoices.chordDifficulty ?? 3) * 1.5)) * repetition));
  const xpAwards: Record<string, number> = { songwriting: xpBase };
  if (input.sessionType !== "lyrics") xpAwards.composition = Math.round(xpBase * .55);
  if (input.sessionType === "lyrics" || input.projectChoices.mode === "lyric_focused") xpAwards.vocals = Math.round(xpBase * .25);
  if (input.sessionType === "arrangement" || input.sessionType === "polish") xpAwards.technical = Math.round(xpBase * .4);
  return { musicProgressGained: music, lyricsProgressGained: lyrics, arrangementProgressGained: arrangement, polishGained: polish, consistencyGained: consistency, xpAwards, breakdown: { balanceVersion: SONGWRITING_BALANCE_VERSION, craft, attributes, durationModifier: duration, wellnessModifier: wellness, projectDifficultyModifier: difficulty, repetitionModifier: repetition, collaborationModifier: collab.modifier, activeContributors: collab.activeCount, skillShare: "~50%", attributeShare: "~20%" } };
}

export function seededVariance(seed: string, width = 0.04) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const unit = ((h >>> 0) % 10000) / 10000;
  return (unit * 2 - 1) * width;
}

export function calculateSongwritingFinal(input: SongwritingSessionInput & { seed: string }): SongwritingFinalResult {
  const active = input.contributors.filter((c) => c.accepted !== false && c.attended !== false);
  const lead = active[0] ?? input.contributors[0];
  if (!lead) throw new Error("At least one active contributor is required");
  const craft = contributorCraft(lead, "balanced", input.projectChoices) * 4.8;
  const attributes = contributorAttributes(lead, "balanced") * 2.0;
  const genreAvg = input.projectChoices.genres?.map((g) => level(lead.skills, genreSkillSlug(g) ?? "")).reduce((a, b, _, arr) => a + b / arr.length, 0) ?? 0;
  const genre = clamp((genreAvg - 20) * 1.25 + 75, 40, 150);
  const mode = input.projectChoices.mode === "experimental" ? 95 : input.projectChoices.mode === "commercial" ? 80 : 70;
  const choice = clamp(mode + ((input.projectChoices.chordDifficulty ?? 3) - 3) * 10, 35, 130);
  const collab = collaborationModifier(active, input.projectChoices);
  const collaboration = clamp(45 + collab.quality * .5, 0, 120);
  const varianceWidth = input.projectChoices.mode === "experimental" ? 0.07 : input.projectChoices.mode === "commercial" ? 0.03 : 0.045;
  const consistencyReduction = clamp((input.state.consistency ?? 0) / 2000, 0, 0.35);
  const variance = seededVariance(input.seed, varianceWidth * (1 - consistencyReduction));
  const rawPotential = craft + attributes + genre + choice + collaboration;
  const potential = Math.round(clamp(rawPotential * (1 + variance), 0, 1000));
  const completion = clamp((Math.min(input.state.musicProgress, input.state.lyricsProgress) / 2000), 0, 1);
  const polish = clamp(0.88 + (input.state.polish ?? 0) / 2500, 0.88, 1.10);
  const consistency = clamp(0.90 + (input.state.consistency ?? 0) / 3000, 0.90, 1.08);
  const ceiling = completion < 1 ? 650 * completion : 1000;
  const finalScore = Math.round(clamp(potential * (0.35 + completion * 0.65) * polish * consistency, 0, ceiling));
  return { finalScore, potential, breakdown: { balanceVersion: SONGWRITING_BALANCE_VERSION, craft: Math.round(craft), attributes: Math.round(attributes), genre: Math.round(genre), project_choices: Math.round(choice), collaboration: Math.round(collaboration), variance: Math.round(variance * 1000) / 1000, raw_score: Math.round(rawPotential), potential, completion_factor: completion, polish_factor: polish, consistency_factor: consistency, final_score: finalScore } };
}
