import type { GIG_REPLAY_STATUSES, GIG_VIEWER_EVENT_TYPES, GIG_VIEWER_PHASES } from "./constants";

export type GigViewerPhase = (typeof GIG_VIEWER_PHASES)[number];
export type GigViewerEventType = (typeof GIG_VIEWER_EVENT_TYPES)[number];
export type GigReplayStatus = (typeof GIG_REPLAY_STATUSES)[number];
export type GigEventImportance = "ambient" | "normal" | "important" | "critical";

export interface StagePosition { x: number; y: number; zone: "front_left" | "front_center" | "front_right" | "mid_left" | "mid_center" | "mid_right" | "back_left" | "back_center" | "back_right" }

export type GigVisualPayload =
  | { type: "venue_open"; entranceIds: string[]; lightLevel: number }
  | { type: "crowd_fill"; targetDensity: number; zoneIds: string[]; enteringCount: number }
  | { type: "crowd_reaction"; reaction: "still" | "bounce" | "jump" | "wave" | "disperse"; intensity: number; zoneIds?: string[] }
  | { type: "performer_enter"; performerId: string; displayName: string; roleOrInstrument: string; startPosition: StagePosition }
  | { type: "performer_move"; performerId: string; targetPosition: StagePosition; movementStyle: "walk" | "rush" | "step_forward" }
  | { type: "song_start"; songId: string | null; title: string; position: number; montage: boolean }
  | { type: "spotlight"; performerId?: string; stageZone?: string; intensity: number }
  | { type: "moment_effect"; effect: "pulse" | "ring" | "trail" | "confetti"; targetId?: string; intensity: number }
  | { type: "band_exit"; exitStyle: "wave" | "quick" | "encore_bow"; performerIds: string[] }
  | { type: "result_reveal"; overallRating: number | null; attendance: number | null; netProfit: number | null; verdictKey: string };

export interface GigViewerEventBase {
  id: string;
  gigId: string;
  sequence: number;
  phase: GigViewerPhase;
  eventType: GigViewerEventType;
  scheduledOffsetMs: number;
  durationMs: number;
  importance: GigEventImportance;
  songId?: string | null;
  performerProfileId?: string | null;
  crowdEnergyBefore?: number | null;
  crowdEnergyAfter?: number | null;
  messageKey: string;
  messageParams: Record<string, string | number>;
}

export type GigViewerEvent = GigViewerEventBase & { visualPayload: GigVisualPayload };

export interface GigViewerReplay {
  id: string;
  gigId: string;
  gigOutcomeId: string;
  viewerVersion: number;
  eventSchemaVersion: number;
  simulationSeed: string;
  durationMs: number;
  generatedAt: string;
  events: GigViewerEvent[];
  checksum: string | null;
  status: GigReplayStatus;
}

export type GigViewerReplayLoadState = "loading" | "ready" | "unavailable" | "generating" | "failed" | "unsupported_version";
