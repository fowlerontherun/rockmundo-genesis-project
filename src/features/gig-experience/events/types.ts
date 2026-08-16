import type { GIG_REPLAY_STATUSES, GIG_VIEWER_EVENT_TYPES, GIG_VIEWER_PHASES } from "./constants";

export type GigViewerPhase = (typeof GIG_VIEWER_PHASES)[number];
export type GigViewerEventType = (typeof GIG_VIEWER_EVENT_TYPES)[number];
export type GigReplayStatus = (typeof GIG_REPLAY_STATUSES)[number];
export type GigEventImportance = "ambient" | "normal" | "important" | "critical";

export interface StagePosition { x: number; y: number; zone: "front_left" | "front_center" | "front_right" | "mid_left" | "mid_center" | "mid_right" | "back_left" | "back_center" | "back_right" }

export interface GigReplayCrowdTuning {
  densityMultiplier: number;
  depthSpread: number;
  lateralSpread: number;
  stagePull: number;
  randomness: number;
  fanScale: number;
  arrivalSpeed: number;
}

export interface GigReplayCommerceSnapshot {
  formulaVersion: string;
  settlementId: string;
  merchandise: { itemsSold: number; grossRevenue: number; cost: number; owner: "band"; lines: Array<{ merchandiseId: string; variantId?: string | null; itemType: string; name: string; quantity: number; unitPrice: number; gross: number }> };
  bar: { drinksServed: number; grossRevenue: number; venueRevenue: number; bandEntitlement: number; owner: "venue" | "shared_by_confirmed_booking"; shareSource: "confirmed_booking" | "venue_fallback" };
  /**
   * Optional timestamped commerce evidence (viewer evidence mode `event_replay`).
   * Written only by the authoritative gig/settlement workflow; the viewer consumes
   * it read-only and never creates, orders, or totals these events itself.
   */
  events?: GigReplayCommerceEvent[] | null;
}

export interface GigReplayCommerceEvent {
  id: string;
  atMs: number;
  service: "bar" | "merchandise";
  quantity: number;
  itemType?: string | null;
}


export type GigReplaySetlistItemType = "song" | "performance_item";
export type PerformanceItemVisualAction =
  | "stage_dive"
  | "crowd_surf"
  | "instrument_solo"
  | "dance"
  | "mic_trick"
  | "crowd_wave"
  | "singalong"
  | "mosh_pit"
  | "phone_lights"
  | "special_effect"
  | "storytelling"
  | "improvisation"
  | "crowd_interaction"
  | "stage_action";

export type GigVisualPayload =
  | { type: "venue_open"; entranceIds: string[]; lightLevel: number }
  | { type: "crowd_fill"; targetDensity: number; zoneIds: string[]; enteringCount: number }
  | { type: "crowd_reaction"; reaction: "still" | "bounce" | "jump" | "wave" | "disperse"; intensity: number; zoneIds?: string[] }
  | { type: "performer_enter"; performerId: string; displayName: string; roleOrInstrument: string; startPosition: StagePosition }
  | { type: "performer_move"; performerId: string; targetPosition: StagePosition; movementStyle: "walk" | "rush" | "step_forward" | "return_to_position" | "hold" }
  | { type: "song_start"; songId: string | null; title: string; position: number; montage: boolean; itemType?: GigReplaySetlistItemType; performanceItemId?: string | null; performanceItemCategory?: string | null }
  | { type: "performance_item"; itemId: string; name: string; category: string; action: PerformanceItemVisualAction; performerId?: string | null; intensity: number }
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
  performanceItemId?: string | null;
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
  /** False only for a local presentation sequence built before an authoritative result exists. */
  resultAvailable?: boolean;
  crowdTuning?: GigReplayCrowdTuning | null;
  crowdTuningRevision?: number | null;
  /** Immutable settlement facts. Absent on legacy replays. */
  commerce?: GigReplayCommerceSnapshot | null;
}

export type GigViewerReplayLoadState = "loading" | "ready" | "unavailable" | "generating" | "failed" | "unsupported_version";
