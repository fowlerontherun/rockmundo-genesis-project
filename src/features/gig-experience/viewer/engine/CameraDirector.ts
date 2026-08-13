import type { GigViewerEvent } from "../../events/types";
import { cameraForPlayback, clampCamera, wideVenueCamera, type SceneCamera } from "./SceneLayout";
import type { Point, Rect, Size } from "./Viewport";

export type CameraShot = "wide" | "performer" | "crowd" | "highlight" | "performance_item";

export interface CameraPerformer {
  id: string;
  profileId?: string | null;
  position: Point;
  visible: boolean;
}

export interface CameraFrame {
  camera: SceneCamera;
  shot: CameraShot;
  subjectId: string | null;
  strength: number;
}

export interface CameraTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

/**
 * Pure, timestamp-derived camera direction. It never advances replay state and
 * produces the same frame after seek, resize, reconnect, or a different FPS.
 */
export function deriveCameraFrame(options: {
  event: GigViewerEvent | null | undefined;
  positionMs: number;
  viewport: Size;
  stage: Rect;
  audience: Rect;
  performers?: CameraPerformer[];
  performanceItemFocus?: Point | null;
  reducedMotion: boolean;
}): CameraFrame {
  const wide = wideVenueCamera(options.viewport);
  const event = options.event;
  if (!event || options.reducedMotion || isWideEvent(event)) return wideFrame(wide);

  const progress = (options.positionMs - event.scheduledOffsetMs) / Math.max(1, event.durationMs);
  const strength = cameraShotStrength(progress);
  if (strength <= 0) return wideFrame(wide);

  const direction = requestedDirection(event, options);
  if (!direction) return wideFrame(wide);
  const requested = cameraForPlayback({
    reducedMotion: false,
    songBoundary: false,
    requested: { x: direction.focus.x, y: direction.focus.y, zoom: direction.zoom },
    scene: options.viewport,
  });
  const camera = clampCamera({
    x: interpolate(wide.x, requested.x, strength),
    y: interpolate(wide.y, requested.y, strength),
    zoom: interpolate(1, requested.zoom, strength),
  }, options.viewport);

  return { camera, shot: direction.shot, subjectId: direction.subjectId, strength };
}

/** Ease in and out inside the event so every directed shot returns to wide. */
export function cameraShotStrength(progress: number): number {
  if (!Number.isFinite(progress) || progress <= 0 || progress >= 1) return 0;
  const transition = 0.18;
  if (progress < transition) return smoothstep(progress / transition);
  if (progress > 1 - transition) return smoothstep((1 - progress) / transition);
  return 1;
}

export function cameraTransform(camera: SceneCamera, viewport: Size): CameraTransform {
  const bounded = clampCamera(camera, viewport);
  return {
    scale: bounded.zoom,
    translateX: viewport.width / 2 - bounded.x * bounded.zoom,
    translateY: viewport.height / 2 - bounded.y * bounded.zoom,
  };
}

export function applyCameraTransform(ctx: CanvasRenderingContext2D, camera: SceneCamera, viewport: Size) {
  const transform = cameraTransform(camera, viewport);
  ctx.translate(transform.translateX, transform.translateY);
  ctx.scale(transform.scale, transform.scale);
}

function requestedDirection(
  event: GigViewerEvent,
  options: {
    viewport: Size;
    stage: Rect;
    audience: Rect;
    performers?: CameraPerformer[];
    performanceItemFocus?: Point | null;
  },
): { focus: Point; zoom: number; shot: CameraShot; subjectId: string | null } | null {
  const performers = (options.performers ?? []).filter((performer) => performer.visible);
  const performer = selectPerformer(event, performers);
  const stageFocus = center(options.stage, 0.55);
  const crowdFocus = center(options.audience, 0.34);

  if (event.visualPayload.type === "performance_item") {
    return {
      focus: options.performanceItemFocus ?? performer?.position ?? stageFocus,
      zoom: 1.2,
      shot: "performance_item",
      subjectId: event.performanceItemId ?? event.visualPayload.itemId,
    };
  }
  if (event.eventType === "performer_entered" || event.visualPayload.type === "performer_move") {
    return { focus: performer?.position ?? stageFocus, zoom: 1.14, shot: "performer", subjectId: performer?.id ?? event.performerProfileId ?? null };
  }
  if (event.eventType === "song_highlight") {
    return { focus: performer?.position ?? stageFocus, zoom: 1.17, shot: "highlight", subjectId: event.performanceItemId ?? event.songId ?? performer?.id ?? null };
  }
  if (event.eventType === "encore_decided") {
    return { focus: crowdFocus, zoom: 1.1, shot: "crowd", subjectId: null };
  }
  if (event.eventType === "song_crowd_reaction") {
    const crowdPeak = (event.crowdEnergyAfter ?? 0) >= 78;
    if (crowdPeak) return { focus: crowdFocus, zoom: 1.1, shot: "crowd", subjectId: null };
    return { focus: performer?.position ?? stageFocus, zoom: 1.11, shot: "performer", subjectId: performer?.id ?? null };
  }
  return null;
}

function selectPerformer(event: GigViewerEvent, performers: CameraPerformer[]): CameraPerformer | null {
  if (!performers.length) return null;
  const requestedId = event.performerProfileId
    ?? (event.visualPayload.type === "performance_item" ? event.visualPayload.performerId : null)
    ?? (event.visualPayload.type === "performer_move" || event.visualPayload.type === "performer_enter" ? event.visualPayload.performerId : null);
  if (requestedId) {
    const requested = performers.find((performer) => performer.id === requestedId || performer.profileId === requestedId);
    if (requested) return requested;
  }
  return performers[Math.abs(event.sequence) % performers.length];
}

function isWideEvent(event: GigViewerEvent) {
  return event.visualPayload.type === "song_start"
    || ["venue_opening", "crowd_entry", "pre_show", "between_songs", "finale", "band_exit", "result_reveal", "completed"].includes(event.phase);
}

function center(rect: Rect, relativeY = 0.5): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height * relativeY };
}

function wideFrame(camera: SceneCamera): CameraFrame {
  return { camera, shot: "wide", subjectId: null, strength: 0 };
}

function smoothstep(value: number) {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}
