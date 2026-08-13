import type { PerformerPresentationEntity, PresentationRole } from "./PerformerLifecycle";
import type { Point } from "./Viewport";

export type PerformerInstrumentGlyph =
  | "microphone"
  | "guitar"
  | "bass"
  | "drums"
  | "keys"
  | "turntables"
  | "strings"
  | "brass"
  | "percussion"
  | "generic";

type PerformerTrailSubject = Pick<
  PerformerPresentationEntity,
  "id" | "visible" | "lifecycleState" | "activeMoveEventId" | "currentPosition"
>;

export interface PerformerFocusPulse {
  radius: number;
  alpha: number;
}

export function instrumentGlyphForRole(role: PresentationRole): PerformerInstrumentGlyph {
  switch (role) {
    case "vocalist":
    case "backing_vocals":
      return "microphone";
    case "lead_guitar":
    case "rhythm_guitar":
    case "guitar":
      return "guitar";
    case "bass":
      return "bass";
    case "drums":
      return "drums";
    case "keyboard":
    case "piano":
    case "electronic":
      return "keys";
    case "dj":
      return "turntables";
    case "strings":
      return "strings";
    case "brass":
      return "brass";
    case "percussion":
      return "percussion";
    default:
      return "generic";
  }
}

export function performerIsMoving(performer: PerformerTrailSubject): boolean {
  return performer.activeMoveEventId !== null
    || performer.lifecycleState === "entering"
    || performer.lifecycleState === "taking_position"
    || performer.lifecycleState === "exiting";
}

export function buildPerformerTrail({
  performer,
  history,
  reducedMotion,
}: {
  performer: PerformerTrailSubject;
  history: readonly (readonly PerformerTrailSubject[])[];
  reducedMotion: boolean;
}): Point[] {
  if (reducedMotion || !performer.visible || !performerIsMoving(performer)) return [];

  const points = history
    .map((frame) => frame.find((candidate) => candidate.id === performer.id))
    .filter((candidate): candidate is PerformerTrailSubject => !!candidate?.visible)
    .map((candidate) => candidate.currentPosition)
    .concat(performer.currentPosition);
  const compacted: Point[] = [];

  for (const point of points) {
    const previous = compacted.at(-1);
    if (!previous || distance(previous, point) >= 0.75) compacted.push(point);
  }

  if (compacted.length < 2 || distance(compacted[0], compacted.at(-1)!) < 2) return [];
  return compacted;
}

export function derivePerformerFocusPulse(
  positionMs: number,
  focused: boolean,
  reducedMotion: boolean,
  counterRadius = 19,
): PerformerFocusPulse | null {
  if (!focused) return null;
  const baseRadius = counterRadius + 5;
  if (reducedMotion) return { radius: baseRadius, alpha: 0.5 };
  const wave = (Math.sin(positionMs / 180) + 1) / 2;
  return { radius: baseRadius + wave * Math.max(2, counterRadius * .21), alpha: 0.54 - wave * 0.22 };
}

export function drawPerformerCounter(
  ctx: CanvasRenderingContext2D,
  {
    performer,
    focused,
    positionMs,
    reducedMotion,
    trail,
  }: {
    performer: PerformerPresentationEntity;
    focused: boolean;
    positionMs: number;
    reducedMotion: boolean;
    trail: readonly Point[];
  },
) {
  const { x, y } = performer.currentPosition;
  const radius = performer.counterRadius;
  const counterScale = radius / 19;
  ctx.save();

  if (trail.length > 1) {
    ctx.strokeStyle = focused ? "rgba(250, 204, 21, .58)" : "rgba(148, 163, 184, .52)";
    ctx.lineWidth = Math.max(1.25, (focused ? 3 : 2) * counterScale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    trail.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    trail.slice(0, -1).forEach((point, index, samples) => {
      ctx.globalAlpha = 0.18 + ((index + 1) / Math.max(1, samples.length)) * 0.24;
      ctx.fillStyle = focused ? "#fde047" : "#cbd5e1";
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(1.25, (2 + index * .45) * counterScale), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  const pulse = derivePerformerFocusPulse(positionMs, focused, reducedMotion, radius);
  if (pulse) {
    ctx.globalAlpha = pulse.alpha;
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, pulse.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = performer.lifecycleState === "waiting_backstage"
    ? "#cbd5e1"
    : performer.lifecycleState === "exiting"
      ? "#fca5a5"
      : "#f8fafc";
  ctx.strokeStyle = focused ? "#fde047" : "#111827";
  ctx.lineWidth = Math.max(1.5, (focused ? 4 : 2) * counterScale);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.font = `bold ${Math.max(6, Math.min(10, radius * .53))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(performer.initials, x, y - radius * .21);
  ctx.font = `bold ${Math.max(5, Math.min(8, radius * .42))}px sans-serif`;
  ctx.fillText(performer.label, x, y + radius * .42);

  const badgeRadius = Math.max(3.5, 7 * counterScale);
  const badgeOffset = radius * .74;
  drawInstrumentBadge(ctx, instrumentGlyphForRole(performer.role), x + badgeOffset, y - badgeOffset, badgeRadius);
  ctx.restore();
}

function drawInstrumentBadge(
  ctx: CanvasRenderingContext2D,
  glyph: PerformerInstrumentGlyph,
  x: number,
  y: number,
  radius: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(radius / 7, radius / 7);
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#f8fafc";
  ctx.fillStyle = "#f8fafc";
  ctx.lineWidth = 1.15;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (glyph) {
    case "microphone":
      ctx.beginPath();
      ctx.arc(-1, -2, 1.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -0.5); ctx.lineTo(2.8, 3.6);
      ctx.moveTo(1.5, 2.5); ctx.lineTo(-0.2, 4);
      ctx.stroke();
      break;
    case "guitar":
    case "bass":
      ctx.beginPath();
      ctx.arc(-2.4, 2.1, glyph === "bass" ? 2.1 : 1.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-1, 0.8); ctx.lineTo(3.4, -3.6);
      ctx.moveTo(2.4, -2.6); ctx.lineTo(4, -1.1);
      ctx.stroke();
      break;
    case "drums":
      ctx.beginPath();
      ctx.ellipse(0, 1, 3.5, 2.2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-3.5, -3.5); ctx.lineTo(1, 0);
      ctx.moveTo(3.5, -3.5); ctx.lineTo(-1, 0);
      ctx.stroke();
      break;
    case "keys":
      ctx.strokeRect(-4, -2.5, 8, 5);
      ctx.beginPath();
      ctx.moveTo(-2, -2.5); ctx.lineTo(-2, 2.5);
      ctx.moveTo(0, -2.5); ctx.lineTo(0, 2.5);
      ctx.moveTo(2, -2.5); ctx.lineTo(2, 2.5);
      ctx.stroke();
      break;
    case "turntables":
      ctx.beginPath();
      ctx.arc(-2.5, 0, 1.7, 0, Math.PI * 2);
      ctx.arc(2.5, 0, 1.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(-0.6, -3.5, 1.2, 7);
      break;
    case "strings":
      ctx.beginPath();
      ctx.arc(-1.5, 1.2, 2.2, 0, Math.PI * 2);
      ctx.moveTo(-1.5, -1); ctx.lineTo(1.2, -4);
      ctx.moveTo(2.7, -3.5); ctx.lineTo(-3.2, 3.6);
      ctx.stroke();
      break;
    case "brass":
      ctx.beginPath();
      ctx.moveTo(-4, 1.5); ctx.lineTo(1.2, -1.5); ctx.lineTo(1.2, 1.5); ctx.closePath();
      ctx.moveTo(1.2, 0); ctx.lineTo(4, 0);
      ctx.stroke();
      break;
    case "percussion":
      ctx.beginPath();
      ctx.ellipse(-1.5, 0.5, 2.2, 3.2, -0.35, 0, Math.PI * 2);
      ctx.moveTo(1.3, -3.5); ctx.lineTo(3.6, 3.4);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, 1.7, 0, Math.PI * 2);
      ctx.fill();
  }
  ctx.restore();
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
