import type { TotpBroadcastReplay, TotpInterviewChoice } from "./api";
import { buildTotpShotGrammar, type TotpSongEnergy, type TotpStageKey } from "./broadcastProfile";
import { buildTotpPerformanceTimeline } from "./broadcastTimeline";
import type { TotpIncidentRecoveryChoice, TotpPerformanceStyleChoice } from "./liveTvApi";
import type { TotpPostShowChoice } from "./postShowApi";
import type { TotpTestPreviewPerformance } from "./testPreviewApi";

export type TotpTestPerformanceStyleChoice = Exclude<TotpPerformanceStyleChoice, "house_direction">;
export type TotpTestInterviewChoice = TotpInterviewChoice;
export type TotpTestRecoveryChoice = TotpIncidentRecoveryChoice;
export type TotpTestPostShowChoice = TotpPostShowChoice;

export interface TotpTestEffects {
  reputation: number;
  fan_sentiment: number;
  media_intensity: number;
  audience_reaction: number;
}

export interface TotpTestIncident {
  event_key: "camera_rehearsal" | "fan_chant" | "broken_string" | "late_floor_manager" | "celebrity_green_room" | "mic_check";
  title: string;
  description: string;
  requires_recovery: boolean;
  effects: TotpTestEffects;
}

export interface TotpTestStyleOutcome {
  choice: TotpTestPerformanceStyleChoice;
  fame_multiplier: number;
  effects: TotpTestEffects;
  raw_live_risk: "clean" | "rough" | null;
}

export interface TotpTestRewardPreview {
  rank_base_fame: number;
  style_multiplier: number;
  style_adjusted_rank_base_fame: number;
}

export const TOTP_TEST_INTERVIEW_CHOICES: Array<{
  key: TotpTestInterviewChoice;
  title: string;
  description: string;
}> = [
  { key: "confident", title: "Own the moment", description: "Reputation +1, fan sentiment +0.5, media +2." },
  { key: "humble", title: "Thank the fans", description: "Reputation +0.5, fan sentiment +2, media +0.5." },
  { key: "cheeky", title: "Give them a headline", description: "Media +3, with a small fan-sentiment risk." },
];

export const TOTP_TEST_STYLE_CHOICES: Array<{
  key: TotpTestPerformanceStyleChoice;
  title: string;
  description: string;
}> = [
  { key: "polished", title: "Polished television performance", description: "Controlled and camera-aware. Fame x1.03, audience +1." },
  { key: "crowd_first", title: "Play to the studio audience", description: "Prioritise energy and connection. Fame x1.05, audience +3." },
  { key: "raw_live", title: "Go raw and live", description: "Deterministic high-risk TV direction: either fame x1.08 / audience +4 or fame x0.97 / audience -1." },
];

export const TOTP_TEST_RECOVERY_CHOICES: Array<{
  key: TotpTestRecoveryChoice;
  title: string;
  description: string;
}> = [
  { key: "professional", title: "Keep it professional", description: "Safest recovery with a reputation lift." },
  { key: "improvise", title: "Improvise", description: "Adapt live for a stronger audience response." },
  { key: "showman", title: "Make it part of the show", description: "Turn the problem into a visible television moment." },
];

export const TOTP_TEST_POSTSHOW_CHOICES: Array<{
  key: TotpTestPostShowChoice;
  title: string;
  description: string;
}> = [
  { key: "press", title: "Stay for the press", description: "Reputation +0.5, media +2." },
  { key: "fans", title: "Go meet the fans", description: "Fan sentiment +2, media +0.5." },
  { key: "band", title: "Decompress with the band", description: "Reputation +1, fan sentiment +0.5." },
];

const ZERO_EFFECTS: TotpTestEffects = {
  reputation: 0,
  fan_sentiment: 0,
  media_intensity: 0,
  audience_reaction: 0,
};

const INCIDENTS: TotpTestIncident[] = [
  {
    event_key: "camera_rehearsal",
    title: "Extra camera rehearsal",
    description: "The director gives the band an extra camera-blocking rehearsal before transmission.",
    requires_recovery: false,
    effects: { reputation: 0.5, fan_sentiment: 0, media_intensity: 0, audience_reaction: 1 },
  },
  {
    event_key: "fan_chant",
    title: "Fans start a chant",
    description: "The studio audience starts chanting the band name before the floor manager has even cued applause.",
    requires_recovery: false,
    effects: { reputation: 0, fan_sentiment: 1, media_intensity: 0.5, audience_reaction: 3 },
  },
  {
    event_key: "broken_string",
    title: "Broken string in rehearsal",
    description: "A string snaps during the final rehearsal. The crew gets the instrument swapped before broadcast.",
    requires_recovery: true,
    effects: { reputation: 0.5, fan_sentiment: 0, media_intensity: 0, audience_reaction: -1 },
  },
  {
    event_key: "late_floor_manager",
    title: "Floor-manager scramble",
    description: "A last-second studio timing change has the floor team moving everyone thirty seconds before the cue.",
    requires_recovery: true,
    effects: { reputation: 0, fan_sentiment: 0, media_intensity: 0.5, audience_reaction: -1 },
  },
  {
    event_key: "celebrity_green_room",
    title: "Green-room encounter",
    description: "Another chart act drops by the green room, creating a small burst of backstage buzz.",
    requires_recovery: false,
    effects: { reputation: 0, fan_sentiment: 0, media_intensity: 1, audience_reaction: 1 },
  },
  {
    event_key: "mic_check",
    title: "Perfect mic check",
    description: "The broadcast engineer locks the vocal mix immediately and the studio audience hears the warm-up clearly.",
    requires_recovery: false,
    effects: { reputation: 0.5, fan_sentiment: 0.5, media_intensity: 0, audience_reaction: 2 },
  },
];

const INTERVIEW_PROMPTS = [
  "Alex Rayne: You're about to make your mark on RockMundo television. What do you want viewers to remember about you tonight?",
  "Alex Rayne: Your song has earned a place in the charts. Does that add pressure before you walk onto the studio floor?",
  "Alex Rayne: Fans are already gathering outside the television centre. What do you want to say to them before the performance?",
  "Alex Rayne: This is live television and there are no second chances. How are you feeling right now?",
];

const POSTSHOW_PROMPTS = [
  "The performance is over and the press line is forming outside the green room.",
  "You can hear fans calling for the band at the barrier outside the television centre.",
  "The cameras are down, the adrenaline is still high, and the green room is starting to empty.",
  "A RockMundo Television producer asks if the band can stay for a quick post-show conversation.",
];

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableBucket(value: string, modulo: number): number {
  return stableHash(value) % Math.max(1, modulo);
}

function clampAudience(value: number): number {
  return Math.max(-10, Math.min(10, value));
}

function stageKey(value: string): TotpStageKey {
  if (value === "main_stage" || value === "stage_b" || value === "rock_stage" || value === "studio_floor") return value;
  return "main_stage";
}

function energyForGenre(genre: string): TotpSongEnergy {
  const normalized = genre.toLowerCase();
  if (/metal|punk|rock|grunge|hardcore|dance|electronic/.test(normalized)) return "high";
  if (/acoustic|folk|singer|songwriter|ballad/.test(normalized)) return "low";
  return "medium";
}

function checksumFor(value: string): string {
  const chunk = stableHash(value).toString(16).padStart(8, "0");
  return chunk.repeat(8).slice(0, 64);
}

export function getTotpTestInterviewPrompt(seed: string, performance: TotpTestPreviewPerformance): string {
  return INTERVIEW_PROMPTS[stableBucket(`${seed}:${performance.band_id}:interview`, INTERVIEW_PROMPTS.length)];
}

export function getTotpTestPostShowPrompt(seed: string, performance: TotpTestPreviewPerformance): string {
  return POSTSHOW_PROMPTS[stableBucket(`${seed}:${performance.band_id}:postshow`, POSTSHOW_PROMPTS.length)];
}

export function getTotpTestIncident(seed: string, performance: TotpTestPreviewPerformance): TotpTestIncident {
  return INCIDENTS[stableBucket(`${seed}:${performance.band_id}:${performance.song_id}:live-tv`, INCIDENTS.length)];
}

export function getTotpTestInterviewEffects(choice: TotpTestInterviewChoice | null): TotpTestEffects {
  if (choice === "confident") return { reputation: 1, fan_sentiment: 0.5, media_intensity: 2, audience_reaction: 0 };
  if (choice === "humble") return { reputation: 0.5, fan_sentiment: 2, media_intensity: 0.5, audience_reaction: 0 };
  if (choice === "cheeky") return { reputation: 0, fan_sentiment: -0.5, media_intensity: 3, audience_reaction: 0 };
  return { ...ZERO_EFFECTS };
}

export function getTotpTestRecoveryEffects(eventKey: TotpTestIncident["event_key"], choice: TotpTestRecoveryChoice | null): TotpTestEffects {
  if (!choice || (eventKey !== "broken_string" && eventKey !== "late_floor_manager")) return { ...ZERO_EFFECTS };

  if (eventKey === "broken_string") {
    if (choice === "professional") return { reputation: 1, fan_sentiment: 0, media_intensity: 0, audience_reaction: 1 };
    if (choice === "improvise") return { reputation: 0.5, fan_sentiment: 0.5, media_intensity: 0.5, audience_reaction: 2 };
    return { reputation: 0, fan_sentiment: 0.5, media_intensity: 1.5, audience_reaction: 3 };
  }

  if (choice === "professional") return { reputation: 1, fan_sentiment: 0, media_intensity: 0, audience_reaction: 1 };
  if (choice === "improvise") return { reputation: 0.5, fan_sentiment: 0, media_intensity: 0.5, audience_reaction: 2 };
  return { reputation: 0, fan_sentiment: -0.25, media_intensity: 1.5, audience_reaction: 2 };
}

export function getTotpTestStyleOutcome(
  seed: string,
  performance: TotpTestPreviewPerformance,
  choice: TotpTestPerformanceStyleChoice | null,
): TotpTestStyleOutcome | null {
  if (!choice) return null;
  if (choice === "polished") {
    return {
      choice,
      fame_multiplier: 1.03,
      raw_live_risk: null,
      effects: { reputation: 1, fan_sentiment: 0, media_intensity: 0.5, audience_reaction: 1 },
    };
  }
  if (choice === "crowd_first") {
    return {
      choice,
      fame_multiplier: 1.05,
      raw_live_risk: null,
      effects: { reputation: 0, fan_sentiment: 1.5, media_intensity: 0.5, audience_reaction: 3 },
    };
  }

  const rough = stableBucket(`${seed}:${performance.band_id}:${performance.song_id}:raw-live`, 4) === 0;
  return rough
    ? {
        choice,
        fame_multiplier: 0.97,
        raw_live_risk: "rough",
        effects: { reputation: 0, fan_sentiment: 0, media_intensity: 1, audience_reaction: -1 },
      }
    : {
        choice,
        fame_multiplier: 1.08,
        raw_live_risk: "clean",
        effects: { reputation: 0, fan_sentiment: 0, media_intensity: 2, audience_reaction: 4 },
      };
}

export function getTotpTestPostShowEffects(choice: TotpTestPostShowChoice | null): TotpTestEffects {
  if (choice === "press") return { reputation: 0.5, fan_sentiment: 0, media_intensity: 2, audience_reaction: 0 };
  if (choice === "fans") return { reputation: 0, fan_sentiment: 2, media_intensity: 0.5, audience_reaction: 0 };
  if (choice === "band") return { reputation: 1, fan_sentiment: 0.5, media_intensity: 0, audience_reaction: 0 };
  return { ...ZERO_EFFECTS };
}

export function combineTotpTestEffects(...effects: TotpTestEffects[]): TotpTestEffects {
  return effects.reduce<TotpTestEffects>((total, effect) => ({
    reputation: total.reputation + effect.reputation,
    fan_sentiment: total.fan_sentiment + effect.fan_sentiment,
    media_intensity: total.media_intensity + effect.media_intensity,
    audience_reaction: clampAudience(total.audience_reaction + effect.audience_reaction),
  }), { ...ZERO_EFFECTS });
}

export function totpRawFameForRank(rank: number): number {
  if (rank === 1) return 1000;
  if (rank <= 3) return 800;
  if (rank <= 10) return 600;
  if (rank <= 20) return 400;
  if (rank <= 30) return 250;
  return 150;
}

export function buildTotpTestRewardPreview(rank: number, styleMultiplier: number): TotpTestRewardPreview {
  const base = totpRawFameForRank(rank);
  return {
    rank_base_fame: base,
    style_multiplier: styleMultiplier,
    style_adjusted_rank_base_fame: Math.max(1, Math.round(base * styleMultiplier)),
  };
}

export function buildTotpTestReplay(
  performance: TotpTestPreviewPerformance,
  seed: string,
  generatedAt: string,
  audienceReaction: number,
): TotpBroadcastReplay {
  const stage = stageKey(performance.stage_key);
  const performanceDurationMs = 45_000;
  const totalDurationMs = performanceDurationMs + 11_000;
  const shots = buildTotpShotGrammar({
    genre: performance.genre,
    energy: energyForGenre(performance.genre),
    performerCount: Math.max(1, performance.members?.length ?? 0),
  });
  const cues = buildTotpPerformanceTimeline({
    artistName: performance.band_name,
    songTitle: performance.song_title,
    chartRank: performance.qualifying_rank,
    presenterIntro: performance.presenter_intro,
    stage,
    performanceDurationMs,
    shots,
  });
  const identity = `${seed}:${performance.band_id}:${performance.song_id}:${performance.running_order}`;
  const checksum = checksumFor(identity);
  const testPerformanceId = `totp-test-${stableHash(identity).toString(16)}`;

  return {
    id: `test-replay-${stableHash(`${identity}:replay`).toString(16)}`,
    performance_id: testPerformanceId,
    replay_version: 4,
    stage_key: stage,
    presenter_key: "alex_rayne",
    duration_ms: totalDurationMs,
    checksum,
    generated_at: generatedAt,
    payload: {
      schemaVersion: 4,
      episodeId: "totp-admin-test-episode",
      episodeNumber: 0,
      episodeDate: generatedAt.slice(0, 10),
      broadcastAt: generatedAt,
      performanceId: testPerformanceId,
      runningOrder: performance.running_order,
      presenterKey: "alex_rayne",
      presenterDisplayName: "Alex Rayne",
      showVariant: "regular",
      liveTv: { audienceReaction: clampAudience(audienceReaction) },
      band: {
        id: performance.band_id,
        name: performance.band_name,
        members: (performance.members ?? []).map((member) => ({
          profile_id: member.profile_id,
          display_name: member.display_name,
          role: member.role,
          instrument_role: member.instrument_role,
          vocal_role: member.vocal_role,
        })),
      },
      song: {
        id: performance.song_id,
        title: performance.song_title,
        genre: performance.genre,
        qualifyingRank: performance.qualifying_rank,
      },
      stage,
      performanceDurationMs,
      totalDurationMs,
      cues,
    },
  };
}
