import type { VenuePreset } from "./VenueLayout";
import type { Point } from "./Viewport";

export interface AudienceActivityPlan {
  surfers: Array<{ start: Point; travel: number; offsetMs: number }>;
  securityLine: Point[];
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic audience-activity plan: crowd surfers and the security line. */
export function buildAudienceActivityPlan({ preset, seed, attendanceRatio, reducedMotion = false }: { preset: VenuePreset; seed: string; attendanceRatio: number; reducedMotion?: boolean }): AudienceActivityPlan {
  const rand = mulberry32(hash(`${seed}:${preset.stageType}`));
  const a = preset.audience;
  const fill = Math.max(0, Math.min(1, attendanceRatio));
  const big = preset.stageType !== "club" && preset.stageType !== "theater";
  const scale = reducedMotion ? 0.5 : 1;

  const surferCount = fill < 0.35 ? 0 : Math.max(1, Math.round((big ? 4 : 2) * fill * scale));
  const surfers = Array.from({ length: surferCount }).map(() => ({
    start: { x: a.x + a.width * (0.12 + rand() * 0.6), y: a.y + a.height * (0.08 + rand() * 0.3) },
    travel: a.width * (0.1 + rand() * 0.2),
    offsetMs: rand() * 6000,
  }));

  const barrier = preset.barriers[0];
  const guards = preset.stageType === "club" ? 5 : preset.stageType === "theater" ? 7 : 14;
  const securityLine: Point[] = barrier
    ? Array.from({ length: guards }).map((_, i) => ({
        x: barrier.x + barrier.width * ((i + 0.5) / guards),
        y: barrier.y + barrier.height + 9,
      }))
    : [];

  return { surfers, securityLine };
}

/** Draws the security pit line and crowd surfers above the crowd layer. */
export function drawAudienceActivity(ctx: CanvasRenderingContext2D, plan: AudienceActivityPlan, { positionMs, energy, reducedMotion }: { positionMs: number; energy: number; reducedMotion: boolean }) {
  const heat = Math.max(0, Math.min(100, energy)) / 100;
  const t = reducedMotion ? 0 : positionMs;

  // Security line facing the crowd, standing in the pit between barrier and stage.
  plan.securityLine.forEach((pt, i) => {
    ctx.fillStyle = "rgba(250, 204, 21, .92)";
    ctx.beginPath();
    ctx.ellipse(pt.x, pt.y, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y - 5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.65)";
    ctx.fillRect(pt.x - 4, pt.y - 1 + (i % 2 === 0 ? 0 : 1), 8, 1);
  });

  // Crowd surfers riding toward the barrier once the room is hot.
  if (heat >= 0.6) {
    plan.surfers.forEach((surfer) => {
      const phase = reducedMotion ? 0.5 : ((t + surfer.offsetMs) % 7000) / 7000;
      const x = surfer.start.x + Math.sin(phase * Math.PI) * surfer.travel;
      const y = surfer.start.y - phase * 10;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(reducedMotion ? 0 : Math.sin(phase * Math.PI * 2) * 0.18);
      ctx.fillStyle = "rgba(248, 250, 252, .95)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(7, -2, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(15,23,42,.8)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}
