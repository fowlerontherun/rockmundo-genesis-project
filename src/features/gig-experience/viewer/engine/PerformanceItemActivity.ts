import type { GigViewerEvent, PerformanceItemVisualAction } from "../../events/types";
import type { Point, Rect } from "./Viewport";

export interface PerformanceItemActivityFrame {
  action: PerformanceItemVisualAction;
  name: string;
  performerId: string | null;
  progress: number;
  intensity: number;
  focus: Point;
  performerPosition: Point | null;
  hideStagePerformer: boolean;
}

/** Pure reconstruction keeps performance-item choreography stable after seek/resize. */
export function derivePerformanceItemActivity(
  event: GigViewerEvent | null | undefined,
  positionMs: number,
  stage: Rect,
  audience: Rect,
  reducedMotion: boolean,
  performerOrigin?: Point | null,
): PerformanceItemActivityFrame | null {
  if (!event || event.visualPayload.type !== "performance_item") return null;
  const payload = event.visualPayload;
  const rawProgress = (positionMs - event.scheduledOffsetMs) / Math.max(1, event.durationMs);
  if (rawProgress < 0 || rawProgress > 1) return null;
  const progress = reducedMotion ? 0.5 : clamp(rawProgress);
  const stageFront = { x: stage.x + stage.width * 0.5, y: stage.y + stage.height * 0.88 };
  const origin = performerOrigin ?? { x: stage.x + stage.width * 0.5, y: stage.y + stage.height * 0.62 };
  const crowdFront = { x: audience.x + audience.width * 0.5, y: audience.y + audience.height * 0.14 };
  let focus = origin;
  let performerPosition: Point | null = null;
  let hideStagePerformer = false;

  if (payload.action === "stage_dive") {
    focus = crowdFront;
    performerPosition = reducedMotion ? stageFront : quadratic(origin, { x: stageFront.x, y: stageFront.y - stage.height * 0.34 }, crowdFront, ease(progress));
    hideStagePerformer = !!payload.performerId;
  } else if (payload.action === "crowd_surf") {
    const from = { x: audience.x + audience.width * 0.18, y: audience.y + audience.height * 0.2 };
    const to = { x: audience.x + audience.width * 0.82, y: audience.y + audience.height * 0.34 };
    focus = interpolate(from, to, progress);
    performerPosition = focus;
    hideStagePerformer = !!payload.performerId;
  } else if (payload.action === "dance") {
    focus = { x: origin.x + (reducedMotion ? 0 : Math.sin(progress * Math.PI * 4) * stage.width * 0.14), y: origin.y };
  } else if (["mosh_pit", "crowd_wave", "singalong", "phone_lights", "crowd_interaction"].includes(payload.action)) {
    focus = { x: audience.x + audience.width * 0.5, y: audience.y + audience.height * 0.32 };
  }

  return {
    action: payload.action,
    name: payload.name,
    performerId: payload.performerId ?? null,
    progress,
    intensity: clamp(payload.intensity),
    focus,
    performerPosition,
    hideStagePerformer,
  };
}

export function drawPerformanceItemActivity(
  ctx: CanvasRenderingContext2D,
  frame: PerformanceItemActivityFrame | null,
  stage: Rect,
  audience: Rect,
  reducedMotion: boolean,
  performerLabel = "★",
) {
  if (!frame) return;
  const { action, progress, intensity, focus } = frame;
  const pulse = reducedMotion ? 1 : 0.78 + Math.sin(progress * Math.PI * 6) * 0.22;
  ctx.save();

  if (action === "mosh_pit") {
    ctx.strokeStyle = `rgba(251, 146, 60, ${0.55 + intensity * 0.35})`;
    ctx.lineWidth = 3;
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.beginPath();
      ctx.ellipse(focus.x, focus.y, 22 + ring * 13 + pulse * 4, 11 + ring * 7, reducedMotion ? 0 : progress * Math.PI * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (action === "crowd_wave") {
    ctx.strokeStyle = `rgba(96, 165, 250, ${0.5 + intensity * 0.4})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 18; i += 1) {
      const x = audience.x + audience.width * (i / 18);
      const y = audience.y + audience.height * 0.28 - Math.sin(i * 0.8 - progress * Math.PI * 4) * 12 * (reducedMotion ? 0.3 : 1);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (action === "phone_lights") {
    for (let i = 0; i < 28; i += 1) {
      const x = audience.x + audience.width * (((i * 37) % 97) / 97);
      const y = audience.y + audience.height * (((i * 53) % 89) / 89);
      ctx.globalAlpha = reducedMotion ? 0.7 : 0.35 + Math.abs(Math.sin(progress * Math.PI * 5 + i)) * 0.65;
      ctx.fillStyle = "#fef9c3";
      ctx.fillRect(x, y, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
  } else if (action === "singalong" || action === "crowd_interaction") {
    ctx.fillStyle = `rgba(253, 224, 71, ${0.55 + intensity * 0.35})`;
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < 7; i += 1) {
      const x = audience.x + audience.width * ((i + 1) / 8);
      const y = audience.y + audience.height * (0.2 + (i % 3) * 0.16) - (reducedMotion ? 0 : Math.sin(progress * Math.PI * 4 + i) * 5);
      ctx.fillText(action === "singalong" ? "♪" : "!", x, y);
    }
  } else if (action === "mic_trick") {
    const angle = reducedMotion ? -0.5 : progress * Math.PI * 6;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(focus.x, focus.y);
    ctx.lineTo(focus.x + Math.cos(angle) * 32, focus.y + Math.sin(angle) * 32);
    ctx.stroke();
  } else if (action === "instrument_solo") {
    const radius = 30 + pulse * 12;
    const gradient = ctx.createRadialGradient(focus.x, focus.y, 4, focus.x, focus.y, radius);
    gradient.addColorStop(0, `rgba(253, 224, 71, ${0.65 + intensity * 0.3})`);
    gradient.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(focus.x, focus.y, radius, 0, Math.PI * 2); ctx.fill();
  } else if (action === "special_effect") {
    ctx.strokeStyle = `rgba(192, 132, 252, ${0.55 + intensity * 0.4})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i += 1) {
      const angle = (i / 10) * Math.PI * 2;
      const radius = 18 + pulse * 26;
      ctx.beginPath(); ctx.moveTo(focus.x + Math.cos(angle) * 8, focus.y + Math.sin(angle) * 8); ctx.lineTo(focus.x + Math.cos(angle) * radius, focus.y + Math.sin(angle) * radius); ctx.stroke();
    }
  } else if (action === "storytelling") {
    ctx.fillStyle = "rgba(248, 250, 252, .9)";
    ctx.beginPath(); ctx.roundRect(focus.x - 34, focus.y - 46, 68, 28, 8); ctx.fill();
    ctx.fillStyle = "#0f172a"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center"; ctx.fillText("…", focus.x, focus.y - 28);
  } else if (action === "improvisation" || action === "stage_action" || action === "dance") {
    ctx.strokeStyle = `rgba(52, 211, 153, ${0.55 + intensity * 0.4})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 20; i += 1) {
      const x = stage.x + stage.width * (i / 20);
      const y = stage.y + stage.height * 0.82 - Math.sin(i * 0.9 + progress * Math.PI * 5) * (reducedMotion ? 3 : 10);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  if (frame.performerPosition) {
    ctx.save();
    ctx.translate(frame.performerPosition.x, frame.performerPosition.y);
    ctx.rotate(action === "crowd_surf" && !reducedMotion ? -0.15 : 0);
    ctx.fillStyle = "#f8fafc"; ctx.strokeStyle = "#fde047"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, action === "crowd_surf" ? 15 : 10, action === "crowd_surf" ? 6 : 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#0f172a"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(performerLabel, 0, 0);
    ctx.restore();
  }

  const bannerWidth = Math.min(stage.width * 0.8, Math.max(130, frame.name.length * 7.5));
  ctx.fillStyle = "rgba(15, 23, 42, .88)";
  ctx.fillRect(stage.x + (stage.width - bannerWidth) / 2, stage.y + 8, bannerWidth, 24);
  ctx.fillStyle = "#fde047"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(frame.name.slice(0, 42), stage.x + stage.width / 2, stage.y + 20);
  ctx.restore();
}

function clamp(value: number) { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
function ease(value: number) { return 1 - Math.pow(1 - clamp(value), 2); }
function interpolate(a: Point, b: Point, progress: number): Point { const p = clamp(progress); return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p }; }
function quadratic(a: Point, control: Point, b: Point, progress: number): Point { const p = clamp(progress); const inv = 1 - p; return { x: inv * inv * a.x + 2 * inv * p * control.x + p * p * b.x, y: inv * inv * a.y + 2 * inv * p * control.y + p * p * b.y }; }
