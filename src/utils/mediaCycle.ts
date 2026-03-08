/**
 * Media Cycle System (v1.0.936)
 * Media attention follows predictable cycles: hype → peak → decline → dormant.
 * Bands can ride or fall victim to media cycles.
 * Different actions trigger different media responses.
 */

export interface MediaCycleState {
  phase: "dormant" | "building" | "peak" | "declining" | "oversaturated";
  intensity: number;          // 0-100
  coverageMultiplier: number; // 0.2 – 2.0
  fatigueLevel: number;       // 0-100 (media gets tired of covering same band)
  nextPhaseIn: number;        // days until phase shifts
  description: string;
}

interface MediaEvent {
  intensityChange: number;
  fatigueChange: number;
}

export const MEDIA_EVENTS: Record<string, MediaEvent> = {
  // High impact, high fatigue
  album_release:       { intensityChange: 30, fatigueChange: 15 },
  scandal:             { intensityChange: 40, fatigueChange: 20 },
  award_nomination:    { intensityChange: 25, fatigueChange: 10 },
  award_win:           { intensityChange: 35, fatigueChange: 12 },
  
  // Medium impact
  single_release:      { intensityChange: 15, fatigueChange: 8 },
  music_video:         { intensityChange: 12, fatigueChange: 6 },
  festival_headline:   { intensityChange: 20, fatigueChange: 10 },
  tv_appearance:       { intensityChange: 18, fatigueChange: 12 },
  interview:           { intensityChange: 10, fatigueChange: 8 },
  
  // Low impact, low fatigue
  social_media_post:   { intensityChange: 3,  fatigueChange: 2 },
  fan_event:           { intensityChange: 5,  fatigueChange: 3 },
  gig:                 { intensityChange: 5,  fatigueChange: 2 },
  collaboration:       { intensityChange: 12, fatigueChange: 5 },
};

function getMediaPhase(intensity: number, fatigue: number): MediaCycleState["phase"] {
  if (intensity < 10) return "dormant";
  if (fatigue > 80) return "oversaturated";
  if (intensity >= 70) return "peak";
  if (intensity >= 30) return "building";
  return "declining";
}

/**
 * Get current media cycle state.
 */
export function getMediaCycleState(intensity: number, fatigue: number): MediaCycleState {
  const clampedIntensity = Math.max(0, Math.min(100, intensity));
  const clampedFatigue = Math.max(0, Math.min(100, fatigue));
  const phase = getMediaPhase(clampedIntensity, clampedFatigue);

  // Coverage multiplier: high intensity + low fatigue = best coverage
  const effectiveIntensity = clampedIntensity * (1 - clampedFatigue / 200); // fatigue reduces effectiveness
  const coverageMultiplier = parseFloat((0.2 + (effectiveIntensity / 100) * 1.8).toFixed(2));

  const descriptions: Record<MediaCycleState["phase"], string> = {
    dormant: "Under the radar — media isn't covering you",
    building: "Buzz is growing — journalists are starting to notice",
    peak: "Peak media attention — every outlet wants a piece",
    declining: "Coverage waning — you need a new story",
    oversaturated: "Media fatigue — outlets are tired of covering you",
  };

  // Estimate days until phase shifts (simplified)
  let nextPhaseIn = 7;
  if (phase === "peak") nextPhaseIn = Math.ceil((100 - clampedFatigue) / 10);
  else if (phase === "building") nextPhaseIn = Math.ceil((70 - clampedIntensity) / 5);
  else if (phase === "oversaturated") nextPhaseIn = Math.ceil(clampedFatigue / 8);

  return {
    phase,
    intensity: clampedIntensity,
    coverageMultiplier,
    fatigueLevel: clampedFatigue,
    nextPhaseIn: Math.max(1, nextPhaseIn),
    description: descriptions[phase],
  };
}

/**
 * Apply a media event and get new intensity/fatigue.
 */
export function applyMediaEvent(
  currentIntensity: number,
  currentFatigue: number,
  eventKey: string
): { newIntensity: number; newFatigue: number; event: MediaEvent } {
  const event = MEDIA_EVENTS[eventKey] ?? { intensityChange: 0, fatigueChange: 0 };
  
  // Fatigue reduces intensity gain
  const fatigueReduction = currentFatigue > 60 ? 0.5 : currentFatigue > 30 ? 0.75 : 1.0;
  const effectiveIntensityChange = Math.round(event.intensityChange * fatigueReduction);
  
  const newIntensity = Math.max(0, Math.min(100, currentIntensity + effectiveIntensityChange));
  const newFatigue = Math.max(0, Math.min(100, currentFatigue + event.fatigueChange));

  return { newIntensity, newFatigue, event };
}

/**
 * Daily media decay: intensity and fatigue both decrease naturally.
 */
export function dailyMediaDecay(intensity: number, fatigue: number): { intensity: number; fatigue: number } {
  return {
    intensity: Math.max(0, parseFloat((intensity - 3).toFixed(1))),       // -3/day
    fatigue: Math.max(0, parseFloat((fatigue - 1.5).toFixed(1))),         // -1.5/day (slower recovery)
  };
}
