import { seededRandom } from "./SeededRandom";
import type { VenueSceneDescriptor } from "./VenueSceneRegistry";
import type { Rect, Size } from "./Viewport";

/**
 * Deterministic venue signage: marquee boards, service signs and screen panels.
 *
 * Signage is presentation only. Text comes from already displayed facts (venue and
 * service names), never from private or financial data. Motion (marquee scroll,
 * screen sweep, neon flicker) is fully disabled under Reduced Motion, which the plan
 * requires alongside camera, paths, weather, water, crowd and effects.
 */
export type SignageKind = "marquee" | "service" | "screen" | "neon";

export interface SignagePanel {
  readonly id: string;
  readonly kind: SignageKind;
  readonly bounds: Readonly<Rect>;
  readonly text: string;
  readonly palette: readonly [string, string];
  /** 0 = static, 1 = full animation. Always 0 under Reduced Motion. */
  readonly motion: number;
  readonly phaseOffsetMs: number;
}

export interface VenueSignagePlan {
  readonly seed: string;
  readonly reducedMotion: boolean;
  readonly panels: readonly SignagePanel[];
}

export const SIGNAGE_SEED_NAMESPACE = "signage-v1" as const;

const PALETTES: Readonly<Record<SignageKind, readonly [string, string]>> = Object.freeze({
  marquee: ["#facc15", "#78350f"],
  service: ["#e2e8f0", "#1f2937"],
  screen: ["#38bdf8", "#0f172a"],
  neon: ["#f472b6", "#312e81"],
});

/** Signs never sit on the stage, in the label-safe strip, or outside the scene. */
function usable(bounds: Rect, scene: VenueSceneDescriptor): boolean {
  if (bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > 1 || bounds.y + bounds.height > 1) return false;
  const overlaps = (other: Readonly<Rect>) =>
    bounds.x < other.x + other.width &&
    bounds.x + bounds.width > other.x &&
    bounds.y < other.y + other.height &&
    bounds.y + bounds.height > other.y;
  return !overlaps(scene.stage) && !overlaps(scene.labelSafeBounds) && !overlaps(scene.controlSafeBounds);
}

function shorten(value: string, max = 22): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function buildVenueSignagePlan(input: {
  scene: VenueSceneDescriptor;
  venueName?: string | null;
  reducedMotion?: boolean;
}): VenueSignagePlan {
  const { scene } = input;
  const reducedMotion = input.reducedMotion === true;
  const seed = `${scene.structuralFingerprint}:${SIGNAGE_SEED_NAMESPACE}`;
  const random = seededRandom(seed);
  const venueName = shorten(input.venueName?.trim() || "Tonight Live");
  const panels: SignagePanel[] = [];

  const push = (panel: Omit<SignagePanel, "motion" | "phaseOffsetMs"> & { motion: number }) => {
    if (!usable(panel.bounds as Rect, scene)) return;
    panels.push({
      ...panel,
      motion: reducedMotion ? 0 : panel.motion,
      phaseOffsetMs: reducedMotion ? 0 : Math.round(random() * 4_000),
    });
  };

  // Entrance marquee. Candidates are tried in order so a scene whose top strip is
  // reserved for labels or controls still gets a name board on a side wall.
  const marqueeCandidates: Rect[] = [
    { x: 0.06 + random() * 0.04, y: Math.max(0.04, scene.stage.y - 0.075), width: 0.26, height: 0.045 },
    { x: 0.04, y: Math.min(0.9, scene.stage.y + scene.stage.height + 0.04), width: 0.24, height: 0.042 },
    { x: 0.7, y: Math.min(0.9, scene.stage.y + scene.stage.height + 0.04), width: 0.24, height: 0.042 },
    { x: 0.36, y: 0.9, width: 0.28, height: 0.04 },
  ];
  const marqueeBounds = marqueeCandidates.find((bounds) => usable(bounds, scene));
  if (marqueeBounds) {
    push({
      id: "signage:marquee:front",
      kind: "marquee",
      bounds: marqueeBounds,
      text: venueName.toUpperCase(),
      palette: PALETTES.marquee,
      motion: 0.7,
    });
  }


  // One sign per distributed service point.
  [...scene.bars, ...scene.merchandiseStands].forEach((point, index) => {
    push({
      id: `signage:service:${point.id}`,
      kind: "service",
      bounds: {
        x: point.bounds.x,
        y: Math.max(0.02, point.bounds.y - 0.032),
        width: Math.max(0.06, Math.min(0.2, point.bounds.width)),
        height: 0.026,
      },
      text: point.kind === "bar" ? "BAR" : "MERCH",
      palette: PALETTES.service,
      motion: index % 2 === 0 ? 0.25 : 0.15,
    });
  });

  // Screen panels only where the archetype authored screens or tiers.
  scene.decorations
    .filter((slot) => slot.kind === "screen")
    .slice(0, 4)
    .forEach((slot, index) => {
      push({
        id: `signage:screen:${slot.id}`,
        kind: "screen",
        bounds: slot.bounds,
        text: index % 2 === 0 ? "LIVE" : venueName.toUpperCase(),
        palette: PALETTES.screen,
        motion: 0.9,
      });
    });

  // Interior neon accents for the small, dark archetypes.
  if (scene.archetype === "club" || scene.archetype === "pub") {
    push({
      id: "signage:neon:room",
      kind: "neon",
      bounds: { x: 0.72 - random() * 0.08, y: 0.2 + random() * 0.05, width: 0.16, height: 0.034 },
      text: scene.archetype === "club" ? "ON AIR" : "LIVE MUSIC",
      palette: PALETTES.neon,
      motion: 0.55,
    });
  }

  return { seed, reducedMotion, panels: Object.freeze(panels) };
}

/** Paints signage in the architecture band. Static when the plan reports no motion. */
export function drawVenueSignage(
  ctx: CanvasRenderingContext2D,
  size: Size,
  plan: VenueSignagePlan,
  positionMs = 0,
  reducedMotion = false,
) {
  if (!plan.panels.length) return;
  ctx.save();
  for (const panel of plan.panels) {
    const x = panel.bounds.x * size.width;
    const y = panel.bounds.y * size.height;
    const width = panel.bounds.width * size.width;
    const height = panel.bounds.height * size.height;
    const motion = reducedMotion ? 0 : panel.motion;
    const phase = motion === 0 ? 0 : (positionMs + panel.phaseOffsetMs) / 1000;
    const glow = motion === 0 ? 0.82 : 0.72 + Math.sin(phase * 2.2) * 0.18;

    ctx.globalAlpha = 1;
    ctx.fillStyle = panel.palette[1];
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = panel.palette[0];
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));

    ctx.globalAlpha = Math.max(0.35, Math.min(1, glow));
    ctx.fillStyle = panel.palette[0];
    if (panel.kind === "screen" && motion > 0) {
      const sweep = ((phase * 0.35) % 1) * width;
      ctx.fillRect(x + sweep, y + 1, Math.max(2, width * 0.12), Math.max(1, height - 2));
    }
    const fontSize = Math.max(7, Math.min(14, height * 0.62));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const drift = panel.kind === "marquee" && motion > 0 ? Math.sin(phase * 1.1) * width * 0.04 : 0;
    ctx.fillText(panel.text, x + width / 2 + drift, y + height / 2, Math.max(8, width - 6));
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
