import { GIG_EVENT_SCHEMA_VERSION, GIG_REPLAY_STATUSES, GIG_VIEWER_EVENT_TYPES, GIG_VIEWER_PHASES, GIG_VIEWER_VERSION } from "./constants";
import type { GigViewerEvent, GigViewerEventType, GigVisualPayload, GigViewerReplay } from "./types";

export interface GigReplayValidationResult { valid: boolean; errors: string[] }

const eventTypes = new Set<string>(GIG_VIEWER_EVENT_TYPES);
const phases = new Set<string>(GIG_VIEWER_PHASES);
const statuses = new Set<string>(GIG_REPLAY_STATUSES);
const eventPayloadTypes: Record<GigViewerEventType, GigVisualPayload["type"][]> = {
  venue_opened: ["venue_open"],
  crowd_arrived: ["crowd_fill"],
  pre_show_started: ["crowd_reaction"],
  performer_entered: ["performer_enter"],
  performer_moved: ["performer_move"],
  song_started: ["song_start"],
  song_crowd_reaction: ["crowd_reaction"],
  song_highlight: ["spotlight", "moment_effect", "performer_move"],
  song_montage: ["song_start", "crowd_reaction"],
  between_song_transition: ["crowd_reaction"],
  encore_decided: ["crowd_reaction", "moment_effect"],
  finale_started: ["moment_effect", "spotlight"],
  band_exited: ["band_exit"],
  result_revealed: ["result_reveal"],
  replay_completed: ["crowd_reaction"],
};

export function isSupportedReplayVersion(viewerVersion: number, eventSchemaVersion: number) {
  return viewerVersion === GIG_VIEWER_VERSION && eventSchemaVersion === GIG_EVENT_SCHEMA_VERSION;
}

export function validateGigViewerReplay(replay: GigViewerReplay): GigReplayValidationResult {
  const errors: string[] = [];
  if (!isSupportedReplayVersion(replay.viewerVersion, replay.eventSchemaVersion)) errors.push("unsupported version");
  if (!statuses.has(replay.status)) errors.push("invalid status");
  if (replay.durationMs <= 0) errors.push("duration must be positive");
  if (!Array.isArray(replay.events)) errors.push("events must be an array");
  if (replay.events.length === 0) errors.push("events are required");
  const seenIds = new Set<string>();
  const seenSequences = new Set<number>();
  let previousOffset = -1;
  let hasResultReveal = false;
  replay.events.forEach((event, index) => {
    validateEvent(event, errors, index);
    if (seenIds.has(event.id)) errors.push(`duplicate event id ${event.id}`);
    seenIds.add(event.id);
    if (seenSequences.has(event.sequence)) errors.push(`duplicate sequence ${event.sequence}`);
    seenSequences.add(event.sequence);
    if (event.sequence !== index) errors.push(`sequence ${event.sequence} must equal array index ${index}`);
    if (event.scheduledOffsetMs < previousOffset) errors.push(`offset out of order at sequence ${event.sequence}`);
    previousOffset = event.scheduledOffsetMs;
    if (event.eventType === "result_revealed") hasResultReveal = true;
  });
  const last = replay.events.at(-1);
  if (!hasResultReveal) errors.push("result reveal event is required");
  if (last?.eventType !== "replay_completed" || last.phase !== "completed") errors.push("completed event must be last");
  return { valid: errors.length === 0, errors };
}

export function validateEvent(event: GigViewerEvent, errors: string[] = [], index = 0): GigReplayValidationResult {
  if (!event.id) errors.push(`event ${index} missing id`);
  if (!event.gigId) errors.push(`event ${index} missing gigId`);
  if (!Number.isInteger(event.sequence) || event.sequence < 0) errors.push(`event ${index} invalid sequence`);
  if (!phases.has(event.phase)) errors.push(`event ${index} invalid phase`);
  if (!eventTypes.has(event.eventType)) errors.push(`event ${index} invalid event type`);
  if (!Number.isFinite(event.scheduledOffsetMs) || event.scheduledOffsetMs < 0) errors.push(`event ${index} invalid offset`);
  if (!Number.isFinite(event.durationMs) || event.durationMs < 0) errors.push(`event ${index} invalid duration`);
  if (!["ambient", "normal", "important", "critical"].includes(event.importance)) errors.push(`event ${index} invalid importance`);
  for (const value of [event.crowdEnergyBefore, event.crowdEnergyAfter]) if (value != null && (value < 0 || value > 100)) errors.push(`event ${index} invalid crowd energy`);
  if (!event.messageKey) errors.push(`event ${index} missing message key`);
  if (!event.messageParams || Object.values(event.messageParams).some((v) => typeof v !== "string" && typeof v !== "number")) errors.push(`event ${index} invalid message params`);
  if (!isPayloadValid(event.visualPayload)) errors.push(`event ${index} invalid payload`);
  const allowed = eventTypes.has(event.eventType) ? eventPayloadTypes[event.eventType] : [];
  if (event.visualPayload && allowed && !allowed.includes(event.visualPayload.type)) errors.push(`event ${index} payload ${event.visualPayload.type} not allowed for ${event.eventType}`);
  return { valid: errors.length === 0, errors };
}

function isPayloadValid(payload: GigVisualPayload | undefined): payload is GigVisualPayload {
  if (!payload || typeof payload !== "object" || !("type" in payload)) return false;
  switch (payload.type) {
    case "venue_open": return Array.isArray(payload.entranceIds) && payload.lightLevel >= 0 && payload.lightLevel <= 1;
    case "crowd_fill": return payload.targetDensity >= 0 && payload.targetDensity <= 1 && Array.isArray(payload.zoneIds) && payload.enteringCount >= 0;
    case "crowd_reaction": return ["still", "bounce", "jump", "wave", "disperse"].includes(payload.reaction) && payload.intensity >= 0 && payload.intensity <= 1;
    case "performer_enter": return !!payload.performerId && !!payload.displayName && !!payload.startPosition;
    case "performer_move": return !!payload.performerId && !!payload.targetPosition && ["walk", "rush", "step_forward"].includes(payload.movementStyle);
    case "song_start": return typeof payload.title === "string" && Number.isInteger(payload.position) && typeof payload.montage === "boolean";
    case "spotlight": return payload.intensity >= 0 && payload.intensity <= 1;
    case "moment_effect": return ["pulse", "ring", "trail", "confetti"].includes(payload.effect) && payload.intensity >= 0 && payload.intensity <= 1;
    case "band_exit": return ["wave", "quick", "encore_bow"].includes(payload.exitStyle) && Array.isArray(payload.performerIds);
    case "result_reveal": return typeof payload.verdictKey === "string";
    default: return false;
  }
}
