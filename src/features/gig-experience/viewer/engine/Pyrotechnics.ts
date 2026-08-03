import type { StoryModel } from "./StoryEngine";
import type { StageType, VenuePreset } from "./VenueLayout";
import type { Size } from "./Viewport";

export type PyroKind = "flame_jet" | "sparkler_fountain" | "co2_jet" | "firework_shell" | "confetti_burst";

export interface PyroCue {
  id: string;
  kind: PyroKind;
  atMs: number;
  durationMs: number;
  /** 0..1 across the stage (or full canvas for aerial shells) */
  lane: number;
  /** 0..1 relative launch height for aerial shells */
  altitude: number;
  hue: number;
  scale: number;
}

export interface PyroPlan {
  cues: PyroCue[];
  outdoor: boolean;
  stageType: StageType;
}

export const PYRO_STORAGE_KEY = "rockmundo.gigViewer.pyrotechnics";

function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isOutdoorStage(stageType: StageType): boolean {
  return stageType === "festival" || stageType === "stadium";
}

/** Deterministic pyro cue sheet derived from the stored replay story. Presentation only. */
export function buildPyroPlan({ story, stageType, seed, intensity = 1 }: { story: StoryModel; stageType: StageType; seed?: string | number | null; intensity?: number }): PyroPlan {
  const outdoor = isOutdoorStage(stageType);
  const rng = mulberry32(hashSeed(String(seed ?? "gig-pyro")));
  const cues: PyroCue[] = [];
  const budget = stageType === "club" ? 0.45 : stageType === "theater" ? 0.7 : stageType === "arena" ? 1 : 1.25;
  const push = (cue: Omit<PyroCue, "id">) => { cues.push({ ...cue, id: `pyro-${cues.length}` }); };

  story.songs.forEach((song, index) => {
    const score = song.score ?? 0;
    const energy = song.energyAfter ?? song.energyBefore ?? 50;
    // Opening hit on the downbeat of every song in bigger rooms.
    if (stageType !== "club" || index === 0) {
      push({ kind: "flame_jet", atMs: song.startMs + 250, durationMs: 900, lane: 0.22, altitude: 0, hue: 24, scale: budget });
      push({ kind: "flame_jet", atMs: song.startMs + 250, durationMs: 900, lane: 0.78, altitude: 0, hue: 24, scale: budget });
    }
    if (outdoor || stageType === "arena") {
      push({ kind: "co2_jet", atMs: song.introEndMs, durationMs: 1200, lane: 0.35 + rng() * 0.3, altitude: 0, hue: 190, scale: budget });
    }
    // Peak moments get fountains when the crowd is hot.
    if (energy >= 60 || song.isBest) {
      push({ kind: "sparkler_fountain", atMs: song.peakStartMs, durationMs: 2600, lane: 0.34, altitude: 0, hue: 48, scale: budget });
      push({ kind: "sparkler_fountain", atMs: song.peakStartMs, durationMs: 2600, lane: 0.66, altitude: 0, hue: 48, scale: budget });
    }
    if (outdoor && (score >= 14 || song.isBest)) {
      for (let i = 0; i < 2; i++) push({ kind: "firework_shell", atMs: song.peakStartMs + i * 700, durationMs: 2200, lane: 0.2 + rng() * 0.6, altitude: 0.24 + rng() * 0.3, hue: Math.floor(rng() * 360), scale: budget });
    }
  });

  story.highlights.forEach((highlight) => {
    if (outdoor) push({ kind: "firework_shell", atMs: highlight.offsetMs + 200, durationMs: 2200, lane: 0.15 + rng() * 0.7, altitude: 0.2 + rng() * 0.35, hue: Math.floor(rng() * 360), scale: budget });
    else push({ kind: "sparkler_fountain", atMs: highlight.offsetMs + 200, durationMs: 2000, lane: 0.5, altitude: 0, hue: 52, scale: budget });
  });

  const finaleMs = story.finaleEvent?.scheduledOffsetMs ?? story.songs.at(-1)?.endingStartMs ?? null;
  if (finaleMs !== null) {
    push({ kind: "confetti_burst", atMs: finaleMs, durationMs: 6000, lane: 0.5, altitude: 0, hue: 0, scale: budget });
    for (let i = 0; i < 4; i++) push({ kind: "flame_jet", atMs: finaleMs + i * 450, durationMs: 800, lane: 0.14 + i * 0.24, altitude: 0, hue: 18, scale: budget * 1.15 });
    const shells = outdoor ? 10 : 4;
    for (let i = 0; i < shells; i++) {
      const kind: PyroKind = outdoor ? "firework_shell" : "sparkler_fountain";
      push({ kind, atMs: finaleMs + 400 + i * 520, durationMs: outdoor ? 2400 : 2200, lane: 0.1 + rng() * 0.8, altitude: 0.18 + rng() * 0.4, hue: Math.floor(rng() * 360), scale: budget });
    }
  }

  const scaled = cues.map((cue) => ({ ...cue, scale: cue.scale * Math.max(0, intensity) }));
  return { cues: scaled.sort((a, b) => a.atMs - b.atMs), outdoor, stageType };
}

function hsla(hue: number, sat: number, light: number, alpha: number) {
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}

/** Draws all pyro cues that are live at positionMs. Reduced motion renders static, dimmer glows only. */
export function drawPyrotechnics(ctx: CanvasRenderingContext2D, preset: VenuePreset, size: Size, opts: { plan: PyroPlan | null; positionMs: number; reducedMotion: boolean; crowdEnergy: number }) {
  const plan = opts.plan;
  if (!plan || plan.cues.length === 0) return;
  const stage = preset.stage;
  const damp = opts.reducedMotion ? 0.35 : 1;

  ctx.save();
  plan.cues.forEach((cue) => {
    const t = (opts.positionMs - cue.atMs) / cue.durationMs;
    if (t < 0 || t > 1) return;
    const x = stage.x + stage.width * cue.lane;
    const baseY = stage.y + stage.height * 0.92;
    const rng = mulberry32(hashSeed(cue.id));

    if (cue.kind === "flame_jet") {
      const height = stage.height * (1.5 + Math.sin(t * Math.PI) * 1.4) * cue.scale * damp;
      const width = 10 * cue.scale;
      const grad = ctx.createLinearGradient(x, baseY, x, baseY - height);
      grad.addColorStop(0, hsla(cue.hue + 20, 100, 62, 0.9 * damp));
      grad.addColorStop(0.45, hsla(cue.hue, 100, 55, 0.6 * damp));
      grad.addColorStop(1, hsla(cue.hue - 10, 100, 50, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x - width, baseY);
      ctx.quadraticCurveTo(x, baseY - height * 0.6, x, baseY - height);
      ctx.quadraticCurveTo(x, baseY - height * 0.6, x + width, baseY);
      ctx.closePath();
      ctx.fill();
    } else if (cue.kind === "sparkler_fountain") {
      const life = Math.sin(Math.min(1, t) * Math.PI);
      const count = Math.round(26 * cue.scale * damp);
      const spread = stage.height * 1.1 * cue.scale;
      for (let i = 0; i < count; i++) {
        const p = rng();
        const vx = (rng() - 0.5) * 26 * cue.scale;
        const age = (t * 1.4 + p) % 1;
        const py = baseY - spread * age * life - 2;
        const px = x + vx * age;
        ctx.globalAlpha = (1 - age) * 0.9 * damp;
        ctx.fillStyle = hsla(cue.hue, 100, 70 + p * 20, 1);
        ctx.fillRect(px, py, 2, 2.6);
      }
      ctx.globalAlpha = 1;
    } else if (cue.kind === "co2_jet") {
      const life = Math.sin(Math.min(1, t) * Math.PI);
      const radius = 6 + t * 46 * cue.scale;
      const grad = ctx.createRadialGradient(x, baseY - 12, 1, x, baseY - 12 - t * 20, radius);
      grad.addColorStop(0, hsla(cue.hue, 40, 96, 0.5 * life * damp));
      grad.addColorStop(1, hsla(cue.hue, 40, 96, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, baseY - 12 - t * 20, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (cue.kind === "firework_shell") {
      const apexY = size.height * (0.05 + (1 - cue.altitude) * 0.16);
      const launchX = stage.x + stage.width * cue.lane;
      if (t < 0.35) {
        const rise = t / 0.35;
        const y = baseY - (baseY - apexY) * rise;
        ctx.strokeStyle = hsla(cue.hue, 90, 72, 0.7 * damp);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(launchX, y + 14);
        ctx.lineTo(launchX, y);
        ctx.stroke();
      } else {
        const burst = (t - 0.35) / 0.65;
        const radius = 8 + burst * 80 * cue.scale;
        const spokes = Math.round(26 * damp) + 6;
        ctx.globalAlpha = Math.max(0, 1 - burst) * damp;
        for (let i = 0; i < spokes; i++) {
          const angle = (i / spokes) * Math.PI * 2 + rng();
          const r = radius * (0.7 + rng() * 0.45);
          ctx.fillStyle = hsla(cue.hue + i * 3, 100, 68, 1);
          ctx.beginPath();
          ctx.arc(launchX + Math.cos(angle) * r, apexY + Math.sin(angle) * r * 0.85 + burst * 18, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        const halo = ctx.createRadialGradient(launchX, apexY, 2, launchX, apexY, radius * 1.2);
        halo.addColorStop(0, hsla(cue.hue, 100, 80, 0.22 * (1 - burst)));
        halo.addColorStop(1, hsla(cue.hue, 100, 80, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(launchX, apexY, radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (cue.kind === "confetti_burst") {
      const count = Math.round(70 * cue.scale * damp);
      for (let i = 0; i < count; i++) {
        const p = rng();
        const drift = (rng() - 0.5) * size.width * 0.5;
        const fall = ((t * 1.1 + p) % 1);
        const px = stage.x + stage.width * 0.5 + drift + Math.sin((fall + p) * 8) * 10;
        const py = stage.y + fall * (size.height - stage.y);
        ctx.globalAlpha = (1 - fall) * 0.85 * damp;
        ctx.fillStyle = hsla(Math.floor(p * 360), 90, 62, 1);
        ctx.fillRect(px, py, 3, 6);
      }
      ctx.globalAlpha = 1;
    }
  });
  ctx.restore();
}
