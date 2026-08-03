import type { VenuePreset } from "./VenueLayout";
import type { Point, Rect } from "./Viewport";

export interface AudienceActivityPlan {
  pitCircles: Array<{ center: Point; radius: number }>;
  surfers: Array<{ start: Point; travel: number; offsetMs: number }>;
  flags: Array<{ base: Point; height: number; colour: string }>;
  banners: Array<{ rect: Rect; colour: string; text: string }>;
  securityLine: Point[];
}

const BANNER_TEXTS = ["WE LOVE YOU", "PLAY THE HITS", "ONE MORE SONG", "FROM PORTSMOUTH", "MARRY ME", "BEST BAND EVER"];
const FLAG_COLOURS = ["#f87171", "#fbbf24", "#34d399", "#60a5fa", "#e879f9", "#22d3ee"];

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

/** Deterministic audience-activity plan: mosh pits, crowd surfers, flags, banners and the security line. */
export function buildAudienceActivityPlan({ preset, seed, attendanceRatio, reducedMotion = false }: { preset: VenuePreset; seed: string; attendanceRatio: number; reducedMotion?: boolean }): AudienceActivityPlan {
  const rand = mulberry32(hash(`${seed}:${preset.stageType}`));
  const a = preset.audience;
  const fill = Math.max(0, Math.min(1, attendanceRatio));
  const big = preset.stageType !== "club" && preset.stageType !== "theater";
  const scale = reducedMotion ? 0.5 : 1;

  const pitCount = fill < 0.25 ? 0 : Math.round((big ? 3 : 1) * scale + fill);
  const pitCircles = Array.from({ length: pitCount }).map((_, i) => ({
    center: { x: a.x + a.width * (0.22 + rand() * 0.56), y: a.y + a.height * (0.18 + rand() * 0.45) },
    radius: Math.max(12, Math.min(a.width, a.height) * (big ? 0.075 : 0.09) * (0.7 + rand() * 0.6)),
  }));

  const surferCount = fill < 0.35 ? 0 : Math.max(1, Math.round((big ? 4 : 2) * fill * scale));
  const surfers = Array.from({ length: surferCount }).map(() => ({
    start: { x: a.x + a.width * (0.12 + rand() * 0.6), y: a.y + a.height * (0.08 + rand() * 0.3) },
    travel: a.width * (0.1 + rand() * 0.2),
    offsetMs: rand() * 6000,
  }));

  const flagCount = fill < 0.15 ? 0 : Math.round((big ? 10 : 3) * (0.4 + fill * 0.6));
  const flags = Array.from({ length: flagCount }).map((_, i) => ({
    base: { x: a.x + a.width * (0.06 + rand() * 0.88), y: a.y + a.height * (0.1 + rand() * 0.7) },
    height: 16 + rand() * (big ? 34 : 18),
    colour: FLAG_COLOURS[i % FLAG_COLOURS.length],
  }));

  const bannerCount = fill < 0.2 ? 0 : big ? 3 : 1;
  const banners = Array.from({ length: bannerCount }).map((_, i) => {
    const w = Math.max(46, a.width * 0.16);
    return {
      rect: { x: a.x + a.width * (0.08 + rand() * 0.7), y: a.y + a.height * (0.12 + rand() * 0.6), width: w, height: Math.max(12, w * 0.22) },
      colour: ["#fde047", "#fca5a5", "#a5f3fc"][i % 3],
      text: BANNER_TEXTS[Math.floor(rand() * BANNER_TEXTS.length)],
    };
  });

  const barrier = preset.barriers[0];
  const guards = preset.stageType === "club" ? 5 : preset.stageType === "theater" ? 7 : 14;
  const securityLine: Point[] = barrier
    ? Array.from({ length: guards }).map((_, i) => ({
        x: barrier.x + barrier.width * ((i + 0.5) / guards),
        y: barrier.y + barrier.height + 9,
      }))
    : [];

  return { pitCircles, surfers, flags, banners, securityLine };
}

/** Draws the security pit line and audience activities above the crowd layer. */
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

  // Mosh / pit circles opening up as energy rises.
  plan.pitCircles.forEach((pit, i) => {
    if (heat < 0.45) return;
    const pulse = reducedMotion ? 0 : Math.sin(t / 420 + i) * pit.radius * 0.1;
    const r = pit.radius * (0.7 + heat * 0.5) + pulse;
    ctx.strokeStyle = `rgba(248, 113, 113, ${0.2 + heat * 0.35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pit.center.x, pit.center.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(15, 23, 42, .38)";
    ctx.beginPath();
    ctx.arc(pit.center.x, pit.center.y, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    const runners = 6;
    for (let k = 0; k < runners; k++) {
      const angle = (k / runners) * Math.PI * 2 + (reducedMotion ? 0 : t / 700) * (i % 2 === 0 ? 1 : -1);
      ctx.fillStyle = "rgba(252, 165, 165, .9)";
      ctx.beginPath();
      ctx.arc(pit.center.x + Math.cos(angle) * r * 0.72, pit.center.y + Math.sin(angle) * r * 0.72, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Flags and poles waving in the crowd.
  plan.flags.forEach((flag, i) => {
    const sway = reducedMotion ? 0 : Math.sin(t / 520 + i) * 3;
    ctx.strokeStyle = "rgba(226, 232, 240, .7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(flag.base.x, flag.base.y);
    ctx.lineTo(flag.base.x + sway * 0.4, flag.base.y - flag.height);
    ctx.stroke();
    ctx.fillStyle = flag.colour;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(flag.base.x + sway * 0.4, flag.base.y - flag.height);
    ctx.lineTo(flag.base.x + sway * 0.4 + 14, flag.base.y - flag.height + 4 + sway);
    ctx.lineTo(flag.base.x + sway * 0.4, flag.base.y - flag.height + 10);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Fan banners held above heads.
  plan.banners.forEach((banner) => {
    const r = banner.rect;
    ctx.fillStyle = banner.colour;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(r.x, r.y, r.width, r.height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(0,0,0,.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x, r.y, r.width, r.height);
    ctx.fillStyle = "#111827";
    ctx.font = `bold ${Math.max(5, Math.min(9, r.height * 0.6))}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(banner.text, r.x + r.width / 2, r.y + r.height / 2);
  });

  // Crowd surfers riding toward the barrier once the room is hot.
  if (heat >= 0.6) {
    plan.surfers.forEach((surfer, i) => {
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
      ctx.fillStyle = "rgba(226,232,240,.5)";
      ctx.fillText("", x, y);
      void i;
    });
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}
