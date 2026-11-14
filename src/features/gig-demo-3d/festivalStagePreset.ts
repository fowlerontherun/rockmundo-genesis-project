import { hashSeed } from "@/features/gig-experience/viewer/engine/SeededRandom";
import type { CrowdCueRequest } from "@/features/gig-experience/audio/crowdCueSelection";
import type { ConcertOptions } from "./liveTypes";
import { DEFAULT_SETTINGS, type DemoSettings } from "./config";

const audience = {
  quiet: [.08, 1], building: [.25, 2], busy: [.5, 3],
  very_busy: [.72, 4], near_capacity: [.9, 5], full: [1, 5],
} as const;

export function festivalStagePreset({
  editionId, stageId, stageName, capacity, artist, localHour, crowdBand, reducedMotion,
}: {
  editionId: string; stageId: string; stageName: string; capacity: number;
  artist?: string; localHour?: number; crowdBand?: keyof typeof audience; reducedMotion: boolean;
}) {
  const seed = `${editionId}:${stageId}`;
  const daylight = localHour !== undefined && localHour >= 6 && localHour < 20;
  const [occupancy, intensity] = crowdBand ? audience[crowdBand] : [0, 1];
  const options: ConcertOptions = {
    externalClock: false,
    performers: [],
    venue: { id: stageId, name: stageName, bandName: artist ?? stageName, type: "festival_stage",
      archetype: "festival", capacity, seed: hashSeed(seed) },
    outdoorDaylight: daylight,
  };
  const settings: DemoSettings = {
    ...DEFAULT_SETTINGS, camera: "front", look: daylight ? "amber" : "electric",
    energy: artist ? .55 : .2, crowd: occupancy, quality: "low", haze: false, reducedMotion,
  };
  const crowdCue: CrowdCueRequest | null = crowdBand ? {
    category: "ambient", environment: "festival", intensity, seed, atSeconds: 0,
    crowdSize: capacity * occupancy >= 1500 ? "large" : capacity * occupancy >= 300 ? "medium" : "small",
  } : null;
  return { options, settings, crowdCue };
}
