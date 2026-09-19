import type { TotpBroadcastCueType } from "./broadcastTimeline";

/**
 * Deterministic broadcast audio mix for the Top of the Pops programme.
 *
 * One table drives the in-app viewer and any later offline render, so the
 * balance a player hears matches the exported master. Levels are linear gains
 * (0-1) targeted at a -14 LUFS programme loudness with headroom for the
 * audience layer, and the song bed ducks under presenter speech.
 */
export interface TotpMixLevels {
  songBed: number;
  presenter: number;
  audienceAmbience: number;
  audienceHit: number;
  transitionSting: number;
}

export const TOTP_MIX_TARGET = Object.freeze({
  programmeLoudnessLufs: -14,
  truePeakCeilingDbtp: -1,
});

const BASE: TotpMixLevels = { songBed: 0.9, presenter: 0.95, audienceAmbience: 0.045, audienceHit: 0.62, transitionSting: 0.18 };

export function totpMixLevels(cueType: TotpBroadcastCueType | null | undefined, audienceReaction = 0): TotpMixLevels {
  const reaction = Math.max(-10, Math.min(10, Number.isFinite(Number(audienceReaction)) ? Number(audienceReaction) : 0));
  const lift = Math.max(0, reaction) * 0.018;

  switch (cueType) {
    case "presenter":
      // Song bed ducks well under speech so the introduction stays intelligible.
      return { songBed: 0.22, presenter: BASE.presenter, audienceAmbience: 0.03, audienceHit: 0.3, transitionSting: 0.14 };
    case "audience":
      return { songBed: 0.35, presenter: 0.4, audienceAmbience: 0.08 + lift, audienceHit: Math.min(0.92, 0.82 + lift), transitionSting: 0.16 };
    case "graphic":
    case "performance":
    default:
      return {
        songBed: BASE.songBed,
        presenter: 0.35,
        audienceAmbience: Math.min(0.12, BASE.audienceAmbience + lift * 0.5),
        audienceHit: Math.min(0.9, BASE.audienceHit + lift),
        transitionSting: BASE.transitionSting,
      };
  }
}

/** Clamp any computed gain into a safe playback range. */
export function clampTotpGain(value: number, min = 0.02, max = 0.95): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}
