import type { ShowSequenceFrame } from "./ShowSequence";
import type { VenuePreset } from "./VenueLayout";
import type { Point, Size } from "./Viewport";

/**
 * Draws the venue-wide lighting states that surround the performance: the house
 * lights before the band appears, the stage blackout during the encore break,
 * the flown curtains and the crowd's phone lights.
 */
export function drawShowLighting(
  ctx: CanvasRenderingContext2D,
  preset: VenuePreset,
  size: Size,
  frame: ShowSequenceFrame,
) {
  const stage = preset.stage;
  // Stage darkness: dim everything on and just above the deck.
  const darkness = Math.max(0, 1 - frame.stageLight);
  if (darkness > 0.01) {
    const pad = 24;
    const grad = ctx.createLinearGradient(0, stage.y - pad, 0, stage.y + stage.height + pad * 2);
    grad.addColorStop(0, `rgba(2, 6, 23, ${0.9 * darkness})`);
    grad.addColorStop(1, `rgba(2, 6, 23, ${0.55 * darkness})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, Math.max(0, stage.y - pad), size.width, stage.height + pad * 3);
  }

  // House / work lights washing the room between sets.
  if (frame.houseLight > 0.02) {
    ctx.fillStyle = `rgba(248, 250, 252, ${0.09 * frame.houseLight})`;
    ctx.fillRect(0, 0, size.width, size.height);
    const wash = ctx.createRadialGradient(size.width / 2, size.height * 0.72, 20, size.width / 2, size.height * 0.72, size.width * 0.7);
    wash.addColorStop(0, `rgba(253, 230, 138, ${0.14 * frame.houseLight})`);
    wash.addColorStop(1, "rgba(253, 230, 138, 0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size.width, size.height);
  }
}

/** Two curtain panels that fly in from the wings across the stage opening. */
export function drawCurtains(ctx: CanvasRenderingContext2D, preset: VenuePreset, frame: ShowSequenceFrame) {
  const closed = Math.max(0, Math.min(1, frame.curtain));
  if (closed <= 0.005) return;
  const stage = preset.stage;
  const pad = 10;
  const x = stage.x - pad;
  const y = stage.y - pad;
  const width = stage.width + pad * 2;
  const height = stage.height + pad * 2;
  const panel = (width / 2) * closed;

  const paint = (px: number, pw: number, flip: boolean) => {
    const grad = ctx.createLinearGradient(flip ? px + pw : px, 0, flip ? px : px + pw, 0);
    grad.addColorStop(0, "rgba(76, 5, 25, .97)");
    grad.addColorStop(0.6, "rgba(127, 15, 40, .97)");
    grad.addColorStop(1, "rgba(45, 4, 16, .97)");
    ctx.fillStyle = grad;
    ctx.fillRect(px, y, pw, height);
    ctx.strokeStyle = "rgba(15, 23, 42, .45)";
    ctx.lineWidth = 1;
    const folds = Math.max(2, Math.round(pw / 12));
    for (let i = 1; i < folds; i += 1) {
      const fx = px + (pw * i) / folds;
      ctx.beginPath();
      ctx.moveTo(fx, y);
      ctx.lineTo(fx, y + height);
      ctx.stroke();
    }
  };

  paint(x, panel, false);
  paint(x + width - panel, panel, true);

  // Pelmet across the top so the curtain reads as house rigging, not an overlay.
  ctx.fillStyle = "rgba(88, 8, 28, .95)";
  ctx.fillRect(x, y, width, Math.max(4, height * 0.07));
}

/** Phone torches raised across the crowd during the encore break and ballads. */
export function drawPhoneLights(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  intensity: number,
  positionMs: number,
  reducedMotion: boolean,
) {
  const level = Math.max(0, Math.min(1, intensity));
  if (level <= 0.02 || points.length === 0) return;
  const shown = Math.round(points.length * level);
  ctx.save();
  for (let i = 0; i < shown; i += 1) {
    const point = points[i];
    const twinkle = reducedMotion ? 0.85 : 0.6 + Math.abs(Math.sin(positionMs / 420 + i * 1.7)) * 0.4;
    const glow = ctx.createRadialGradient(point.x, point.y - 3, 0.5, point.x, point.y - 3, 7);
    glow.addColorStop(0, `rgba(255, 251, 235, ${0.85 * twinkle * level})`);
    glow.addColorStop(1, "rgba(255, 251, 235, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(point.x, point.y - 3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * twinkle * level})`;
    ctx.fillRect(point.x - 0.8, point.y - 5, 1.6, 3);
  }
  ctx.restore();
}
