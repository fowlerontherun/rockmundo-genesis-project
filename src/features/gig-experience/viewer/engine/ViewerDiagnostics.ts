import type { GigViewerReplay } from "../../events/types";
import type { GigExperienceDTO } from "../../types";
import type { GigViewerCameraMode } from "./CameraDirector";
import { resolveGigEnvironment } from "./EnvironmentRegistry";
import { representativeCrowdCount } from "./RepresentativeCrowd";
import { generateVenueScene } from "./VenueSceneRegistry";
import { replayResultAttendance, resolvePresentationAttendance, type PresentationAttendanceResolution } from "./AuthoritativeMetric";

export type PerformanceTier = "low" | "standard" | "high";
export type ActivityEvidenceMode = "ambient" | "aggregate" | "event_replay";

export interface PerformanceBudget {
  representativeCounters: number;
  ambienceVoices: number;
  particles: number;
  backgroundMovers: number;
}

/** Phase 0 budgets are contracts only; renderer degradation is intentionally deferred to Phase 6. */
export const PERFORMANCE_BUDGETS: Readonly<Record<PerformanceTier, PerformanceBudget>> = Object.freeze({
  low: { representativeCounters: 48, ambienceVoices: 1, particles: 24, backgroundMovers: 2 },
  standard: { representativeCounters: 96, ambienceVoices: 2, particles: 64, backgroundMovers: 5 },
  high: { representativeCounters: 160, ambienceVoices: 3, particles: 120, backgroundMovers: 8 },
});

export const PERFORMANCE_TIER_STORAGE_KEY = "gig-viewer-performance-tier";

export function resolvePerformanceTier(options: {
  preference?: PerformanceTier | null;
  reducedMotion?: boolean;
  hardwareConcurrency?: number | null;
  deviceMemoryGb?: number | null;
} = {}): PerformanceTier {
  if (options.preference && options.preference in PERFORMANCE_BUDGETS) return options.preference;
  if (options.reducedMotion || (options.hardwareConcurrency ?? 8) <= 4 || (options.deviceMemoryGb ?? 8) <= 4) return "low";
  if ((options.hardwareConcurrency ?? 8) >= 12 && (options.deviceMemoryGb ?? 8) >= 8) return "high";
  return "standard";
}

export interface ViewerDiagnostics {
  cameraMode: GigViewerCameraMode;
  venueArchetype: string;
  venueVariation: number;
  environmentKind: string;
  seedFingerprint: string;
  representativeCrowdCount: number;
  attendanceState: PresentationAttendanceResolution["state"];
  attendanceSource: PresentationAttendanceResolution["source"];
  activityEvidenceMode: ActivityEvidenceMode;
  performanceTier: PerformanceTier;
}

export function buildViewerDiagnostics(input: {
  replay: GigViewerReplay;
  experience: GigExperienceDTO | null;
  cameraMode: GigViewerCameraMode;
  reducedMotion: boolean;
  performancePreference?: PerformanceTier | null;
}): ViewerDiagnostics {
  const { replay, experience } = input;
  const scene = generateVenueScene({ gigId: experience?.gig.id ?? replay.id, venueId: experience?.gig.venue.id, venueName: experience?.gig.venue.name, venueType: experience?.gig.venue.type, capacity: experience?.gig.venue.capacity });
  const environment = resolveGigEnvironment({ gigId: experience?.gig.id ?? replay.gigId, scheduledDate: experience?.gig.scheduledDate, venueArchetype: scene.archetype, venue: experience?.gig.venue });
  const attendance = resolvePresentationAttendance(experience?.headline.attendance, replayResultAttendance(replay), experience?.headline.capacity);
  const navigatorCapabilities: { hardwareConcurrency?: number; deviceMemory?: number } =
    typeof navigator === "undefined" ? {} : navigator as Navigator & { deviceMemory?: number };
  const performanceTier = resolvePerformanceTier({ preference: input.performancePreference, reducedMotion: input.reducedMotion, hardwareConcurrency: navigatorCapabilities.hardwareConcurrency, deviceMemoryGb: navigatorCapabilities.deviceMemory });
  return {
    cameraMode: input.cameraMode,
    venueArchetype: scene.archetype,
    venueVariation: scene.variation,
    environmentKind: environment.profile.kind,
    seedFingerprint: fingerprint(`${scene.seed}:layout|${environment.seed}`),
    representativeCrowdCount: representativeCrowdCount({ attendance: attendance.value, capacity: null, archetype: scene.archetype }),
    attendanceState: attendance.state,
    attendanceSource: attendance.source,
    activityEvidenceMode: replay.commerce ? "aggregate" : "ambient",
    performanceTier,
  };
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `scene-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
