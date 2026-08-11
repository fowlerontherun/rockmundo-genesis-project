import type { Rect, Point, Size } from "./Viewport";
import { scaleRect, scalePoint } from "./Viewport";

export type VenuePresetName = "small" | "medium" | "large";
export type StageType = "club" | "theater" | "arena" | "stadium" | "festival" | "tent" | "arena_bowl" | "stadium_bowl";
export type FloorPattern = "checker" | "concrete" | "wood" | "grass" | "asphalt";
export type ScaledVenuePreset = VenuePreset;

export interface StageDecorations {
  ampsLeft: Rect[];
  ampsRight: Rect[];
  monitors: Rect[];
  speakerStacks: Rect[];
  subwoofers: Rect[];
  drumRiser: Rect | null;
  lightingTruss: Rect | null;
  lightFixtures: Point[];
  followSpots: Point[];
  backdrop: Rect | null;
  bannerRect: Rect | null;
  bigScreens: Rect[];
  barrierPosts: Point[];
  micStands: Point[];
  cableRuns: Rect[];
  guitarRack: Rect | null;
  fohTower: Rect | null;
  securityPosts: Point[];
  ledLipStrip: Rect | null;
  floorTapeMarks: Point[];
  seatingTiers: Rect[];
  tentCanopy: Rect | null;
  tentStripes: number;
  floorPattern: FloorPattern;
  palette: { skyTop: string; skyBottom: string; audienceFloor: string; stageDeck: string; stageEdge: string; barrier: string; ampBody: string; speakerBody: string; accent: string };
}

export interface VenuePreset {
  name: VenuePresetName;
  stageType: StageType;
  bounds: Rect;
  stage: Rect;
  audience: Rect;
  entrances: Point[];
  backstage: Point;
  performerSlots: Record<string, Point>;
  crowdZones: Rect[];
  barriers: Rect[];
  labelSafe: Rect;
  decorations: StageDecorations;
}

const PALETTES: Record<StageType, StageDecorations["palette"]> = {
  club: { skyTop: "#1a0524", skyBottom: "#2a0b3a", audienceFloor: "#0f0a1a", stageDeck: "#1b0d0d", stageEdge: "#3d1a1a", barrier: "#2f2f36", ampBody: "#111111", speakerBody: "#0a0a0a", accent: "#f472b6" },
  theater: { skyTop: "#2a0a12", skyBottom: "#3d0f1a", audienceFloor: "#3b1216", stageDeck: "#4a2a1a", stageEdge: "#2a1508", barrier: "#8b6b2a", ampBody: "#161616", speakerBody: "#0e0e0e", accent: "#f59e0b" },
  arena: { skyTop: "#050914", skyBottom: "#0b1226", audienceFloor: "#111827", stageDeck: "#1f2937", stageEdge: "#0b0f17", barrier: "#4b5563", ampBody: "#0f0f10", speakerBody: "#050505", accent: "#38bdf8" },
  stadium: { skyTop: "#0a1a2e", skyBottom: "#173958", audienceFloor: "#1a2b3d", stageDeck: "#22303f", stageEdge: "#0a1220", barrier: "#5b6472", ampBody: "#0d0d0f", speakerBody: "#050505", accent: "#22d3ee" },
  tent: { skyTop: "#2b0f36", skyBottom: "#7c2d12", audienceFloor: "#2f2412", stageDeck: "#2a1e12", stageEdge: "#4a2f14", barrier: "#78716c", ampBody: "#131313", speakerBody: "#080808", accent: "#f0abfc" },
  arena_bowl: { skyTop: "#03060f", skyBottom: "#0a1020", audienceFloor: "#0f172a", stageDeck: "#1f2937", stageEdge: "#0b0f17", barrier: "#4b5563", ampBody: "#0f0f10", speakerBody: "#050505", accent: "#818cf8" },
  stadium_bowl: { skyTop: "#061426", skyBottom: "#123049", audienceFloor: "#14532d", stageDeck: "#22303f", stageEdge: "#0a1220", barrier: "#5b6472", ampBody: "#0d0d0f", speakerBody: "#050505", accent: "#34d399" },
  festival: { skyTop: "#3d1a4a", skyBottom: "#c2410c", audienceFloor: "#3b2f14", stageDeck: "#2a1e12", stageEdge: "#4a2f14", barrier: "#78716c", ampBody: "#131313", speakerBody: "#080808", accent: "#facc15" },
};

const FLOOR_BY_TYPE: Record<StageType, FloorPattern> = { club: "checker", theater: "wood", arena: "concrete", stadium: "concrete", festival: "grass", tent: "grass", arena_bowl: "concrete", stadium_bowl: "grass" };

function baseBounds(name: VenuePresetName) {
  if (name === "small") return { stage: { x: .2, y: .12, width: .6, height: .3 }, audience: { x: .22, y: .5, width: .56, height: .4 }, entrances: [{ x: .12, y: .92 }, { x: .88, y: .92 }], backstage: { x: .84, y: .25 }, crowdZones: [{ x: .24, y: .51, width: .52, height: .37 }], barriers: [{ x: .2, y: .45, width: .6, height: .018 }] };
  if (name === "large") return { stage: { x: .18, y: .1, width: .64, height: .34 }, audience: { x: .2, y: .5, width: .6, height: .42 }, entrances: [{ x: .1, y: .94 }, { x: .5, y: .96 }, { x: .9, y: .94 }], backstage: { x: .86, y: .25 }, crowdZones: [{ x: .22, y: .51, width: .56, height: .22 }, { x: .25, y: .74, width: .5, height: .16 }], barriers: [{ x: .18, y: .46, width: .64, height: .022 }] };
  return { stage: { x: .19, y: .11, width: .62, height: .32 }, audience: { x: .21, y: .5, width: .58, height: .41 }, entrances: [{ x: .11, y: .94 }, { x: .89, y: .94 }], backstage: { x: .85, y: .25 }, crowdZones: [{ x: .23, y: .51, width: .54, height: .25 }, { x: .27, y: .77, width: .46, height: .12 }], barriers: [{ x: .19, y: .46, width: .62, height: .02 }] };
}

function collapseStageType(stageType: StageType): StageType {
  if (stageType === "arena_bowl") return "arena";
  if (stageType === "stadium_bowl") return "stadium";
  if (stageType === "tent") return "festival";
  return stageType;
}

function buildDecorations(name: VenuePresetName, rawStageType: StageType, stage: Rect, barriers: Rect[], audience: Rect): StageDecorations {
  const stageType = collapseStageType(rawStageType);
  const sx = stage.x, sy = stage.y, sw = stage.width, sh = stage.height;
  const rightEdge = sx + sw;
  const stackWidth = stageType === "stadium" || stageType === "festival" ? 0.045 : stageType === "arena" ? 0.04 : 0.03;
  const stackHeight = stageType === "stadium" || stageType === "festival" ? sh * 1.3 : stageType === "arena" ? sh * 1.05 : sh * 0.75;
  const ampsCount = stageType === "club" ? 2 : stageType === "theater" ? 3 : 4;
  const buildAmps = (side: "l" | "r"): Rect[] => Array.from({ length: ampsCount }).map((_, i) => {
    const w = 0.045; const h = 0.045; const gap = 0.005;
    const rowY = sy + sh - h - 0.01;
    const x = side === "l" ? sx + 0.02 + i * (w + gap) : rightEdge - 0.02 - (i + 1) * (w + gap) + gap;
    return { x, y: rowY, width: w, height: h };
  });
  const monitors: Rect[] = Array.from({ length: name === "small" ? 3 : name === "medium" ? 4 : 5 }).map((_, i, arr) => ({ x: sx + 0.04 + (sw - 0.08) * (i / arr.length), y: sy + sh - 0.018, width: (sw - 0.08) / arr.length * 0.7, height: 0.012 }));
  const speakerStacks: Rect[] = stageType === "club"
    ? [{ x: sx - stackWidth * 0.5, y: sy + sh * 0.15, width: stackWidth, height: stackHeight }, { x: rightEdge - stackWidth * 0.5, y: sy + sh * 0.15, width: stackWidth, height: stackHeight }]
    : [
        { x: sx - stackWidth * 0.7, y: sy - sh * 0.15, width: stackWidth, height: stackHeight },
        { x: rightEdge - stackWidth * 0.3, y: sy - sh * 0.15, width: stackWidth, height: stackHeight },
      ];
  // Subwoofer cabinets on the floor at stage edge
  const subCount = stageType === "club" ? 2 : stageType === "theater" ? 3 : 4;
  const subW = 0.05, subH = 0.022;
  const subwoofers: Rect[] = Array.from({ length: subCount * 2 }).map((_, i) => {
    const side = i < subCount ? "l" : "r";
    const k = i % subCount;
    const totalW = subCount * subW + (subCount - 1) * 0.004;
    const startX = side === "l" ? sx + 0.01 : rightEdge - 0.01 - totalW;
    return { x: startX + k * (subW + 0.004), y: sy + sh + 0.004, width: subW, height: subH };
  });
  const drumRiser: Rect | null = { x: sx + sw * 0.4, y: sy + sh * 0.05, width: sw * 0.2, height: sh * 0.35 };
  const trussY = sy - 0.015;
  const lightingTruss: Rect | null = stageType === "festival" ? null : { x: sx + 0.005, y: trussY, width: sw - 0.01, height: 0.014 };
  const lightCount = stageType === "club" ? 6 : stageType === "theater" ? 8 : stageType === "stadium" ? 14 : stageType === "festival" ? 12 : 10;
  const lightFixtures: Point[] = Array.from({ length: lightCount }).map((_, i) => ({ x: sx + 0.02 + (sw - 0.04) * (i / Math.max(1, lightCount - 1)), y: (lightingTruss ? lightingTruss.y + lightingTruss.height * 0.5 : sy - 0.006) }));
  // Follow spots from FOH position
  const followSpots: Point[] = stageType === "club" ? [] : [
    { x: audience.x + audience.width * 0.15, y: audience.y + audience.height * 0.55 },
    { x: audience.x + audience.width * 0.85, y: audience.y + audience.height * 0.55 },
  ];
  const backdrop: Rect | null = { x: sx, y: sy, width: sw, height: sh * 0.55 };
  const bannerRect: Rect | null = { x: sx + sw * 0.28, y: sy + sh * 0.06, width: sw * 0.44, height: sh * 0.14 };
  const bigScreens: Rect[] = stageType === "arena" || stageType === "stadium" || stageType === "festival"
    ? [
        { x: sx - 0.01, y: sy + sh * 0.05, width: sw * 0.14, height: sh * 0.45 },
        { x: rightEdge - sw * 0.13, y: sy + sh * 0.05, width: sw * 0.14, height: sh * 0.45 },
      ]
    : [];
  const barrier = barriers[0];
  const postCount = stageType === "club" ? 8 : stageType === "theater" ? 12 : stageType === "arena" ? 18 : 24;
  const barrierPosts: Point[] = barrier ? Array.from({ length: postCount }).map((_, i) => ({ x: barrier.x + barrier.width * (i / Math.max(1, postCount - 1)), y: barrier.y + barrier.height * 0.5 })) : [];
  // Mic stands at front of stage (vocals + backing)
  const micStands: Point[] = [
    { x: sx + sw * 0.5, y: sy + sh * 0.78 },
    { x: sx + sw * 0.25, y: sy + sh * 0.72 },
    { x: sx + sw * 0.75, y: sy + sh * 0.72 },
  ];
  // Cable runs from amps toward drum riser
  const cableRuns: Rect[] = [
    { x: sx + sw * 0.1, y: sy + sh - 0.008, width: sw * 0.3, height: 0.004 },
    { x: sx + sw * 0.6, y: sy + sh - 0.008, width: sw * 0.3, height: 0.004 },
  ];
  const guitarRack: Rect | null = { x: sx + sw * 0.05, y: sy + sh * 0.5, width: sw * 0.08, height: sh * 0.2 };
  // FOH sound tower in audience
  const fohTower: Rect | null = { x: audience.x + audience.width * 0.5 - 0.03, y: audience.y + audience.height * 0.65, width: 0.06, height: 0.05 };
  // Security posts along stage front barrier (behind barrier, on stage side)
  const secCount = stageType === "club" ? 2 : stageType === "theater" ? 3 : 5;
  const securityPosts: Point[] = barrier ? Array.from({ length: secCount }).map((_, i) => ({
    x: barrier.x + barrier.width * ((i + 0.5) / secCount),
    y: barrier.y - 0.012,
  })) : [];
  const ledLipStrip: Rect | null = { x: sx, y: sy + sh - 0.004, width: sw, height: 0.004 };
  // Floor tape marks in audience zone (path markings)
  const floorTapeMarks: Point[] = Array.from({ length: 8 }).map((_, i) => ({
    x: audience.x + audience.width * ((i + 0.5) / 8),
    y: audience.y + audience.height * 0.9,
  }));
  // Bowl seating tiers wrapping the audience floor (zoomed-out arena / stadium view)
  const bowl = rawStageType === "arena_bowl" || rawStageType === "stadium_bowl";
  const tierCount = rawStageType === "stadium_bowl" ? 4 : 3;
  const seatingTiers: Rect[] = bowl
    ? Array.from({ length: tierCount }).map((_, i) => {
        const inset = 0.012 + i * 0.026;
        return { x: 0.012 + inset * 0.6, y: 0.03 + inset * 0.5, width: 0.976 - inset * 1.2, height: 0.94 - inset };
      })
    : [];
  const tentCanopy: Rect | null = rawStageType === "tent" ? { x: 0.02, y: 0.01, width: 0.96, height: 0.34 } : null;
  const tentStripes = rawStageType === "tent" ? 14 : 0;
  return {
    seatingTiers, tentCanopy, tentStripes,
    ampsLeft: buildAmps("l"), ampsRight: buildAmps("r"), monitors, speakerStacks, subwoofers,
    drumRiser, lightingTruss, lightFixtures, followSpots, backdrop, bannerRect, bigScreens, barrierPosts,
    micStands, cableRuns, guitarRack, fohTower, securityPosts, ledLipStrip, floorTapeMarks,
    floorPattern: FLOOR_BY_TYPE[stageType], palette: PALETTES[stageType],
  };
}

function buildPreset(name: VenuePresetName, stageType: StageType): VenuePreset {
  const b = baseBounds(name);
  const stage = b.stage as Rect;
  const performerSlots: Record<string, Point> = name === "small"
    ? { vocalist: { x: .5, y: .27 }, guitar: { x: .32, y: .23 }, bass: { x: .68, y: .23 }, drums: { x: .5, y: .16 }, keyboard: { x: .72, y: .17 }, dj: { x: .58, y: .17 }, backing: { x: .24, y: .17 }, unknown: { x: .5, y: .22 } }
    : name === "medium"
    ? { vocalist: { x: .5, y: .29 }, guitar: { x: .28, y: .24 }, bass: { x: .69, y: .25 }, drums: { x: .5, y: .17 }, keyboard: { x: .76, y: .18 }, dj: { x: .58, y: .18 }, backing: { x: .22, y: .18 }, unknown: { x: .5, y: .22 } }
    : { vocalist: { x: .5, y: .29 }, guitar: { x: .25, y: .25 }, bass: { x: .72, y: .25 }, drums: { x: .5, y: .15 }, keyboard: { x: .78, y: .17 }, dj: { x: .62, y: .16 }, backing: { x: .2, y: .18 }, unknown: { x: .5, y: .22 } };
  return {
    name, stageType,
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    stage, audience: b.audience as Rect,
    entrances: b.entrances as Point[], backstage: b.backstage as Point,
    performerSlots,
    crowdZones: b.crowdZones as Rect[], barriers: b.barriers as Rect[],
    labelSafe: { x: .03, y: .03, width: .94, height: .08 },
    decorations: buildDecorations(name, stageType, stage, b.barriers as Rect[], b.audience as Rect),
  };
}

export const VENUE_PRESETS: Record<VenuePresetName, VenuePreset> = {
  small: buildPreset("small", "club"),
  medium: buildPreset("medium", "theater"),
  large: buildPreset("large", "arena"),
};

export function selectStageType(input?: { venueName?: string | null; venueType?: string | null; capacity?: number | null }): StageType {
  const hay = `${input?.venueName ?? ""} ${input?.venueType ?? ""}`.toLowerCase().replace(/_/g, " ");
  const cap = input?.capacity ?? NaN;
  if (/tent|marquee|big ?top|cabaret|gospel tent|dance tent|silent disco/.test(hay)) return "tent";
  if (/bowl|amphitheat/.test(hay)) return "stadium_bowl";
  if (/festival|open ?air|fields?|park|outdoor|beach|seafront|bandstand|city square|vineyard|airfield|mountain stage|desert stage/.test(hay)) return "festival";
  if (/stadium|olympic|megadome|dome/.test(hay)) return "stadium_bowl";
  if (/ice arena|ice rink/.test(hay)) return "arena_bowl";
  if (/arena|coliseum|colise|forum|garden/.test(hay)) return "arena_bowl";
  if (/theat(re|er)|opera|hall|auditorium|ballroom|playhouse|casino|cruise|church|chapel|cathedral|conservat/.test(hay)) return "theater";
  if (/club|bar|pub|lounge|basement|cellar|cafe|tavern|live ?house|indie|warehouse|rooftop|terrace|speakeasy|union|social/.test(hay)) return "club";
  if (Number.isFinite(cap)) {
    if (cap >= 25000) return "stadium_bowl";
    if (cap >= 5000) return "arena_bowl";
    if (cap >= 1000) return "arena";
    if (cap >= 300) return "theater";
    return "club";
  }
  return "theater";
}

/** Deterministic 0-1 hash so each venue keeps a stable, slightly different look. */
function variantHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function shiftHex(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const clampByte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clampByte(((n >> 16) & 255) + amount);
  const g = clampByte(((n >> 8) & 255) + amount * 0.7);
  const b = clampByte((n & 255) + amount * 1.2);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Cosmetic-only variation: palette shading and decorative counts. Geometry stays identical so entity layouts still line up. */
function applyVenueVariation(preset: VenuePreset, seed: string): VenuePreset {
  const r = variantHash(seed);
  const tint = Math.round((r - 0.5) * 26);
  const d = preset.decorations;
  const extraLights = Math.round((r * 5) % 3) - 1;
  const lightFixtures = extraLights >= 0
    ? d.lightFixtures
    : d.lightFixtures.slice(0, Math.max(2, d.lightFixtures.length - 1));
  const bannerRect = d.bannerRect
    ? { ...d.bannerRect, width: d.bannerRect.width * (0.9 + r * 0.2), height: d.bannerRect.height * (0.92 + r * 0.16) }
    : null;
  return {
    ...preset,
    decorations: {
      ...d,
      lightFixtures,
      bannerRect,
      tentStripes: d.tentStripes > 0 ? Math.max(9, d.tentStripes + Math.round((r - 0.5) * 6)) : 0,
      palette: {
        ...d.palette,
        skyTop: shiftHex(d.palette.skyTop, tint),
        skyBottom: shiftHex(d.palette.skyBottom, -tint),
        stageDeck: shiftHex(d.palette.stageDeck, Math.round(tint * 0.6)),
        audienceFloor: shiftHex(d.palette.audienceFloor, Math.round(tint * 0.4)),
        accent: shiftHex(d.palette.accent, Math.round((r - 0.5) * 34)),
      },
    },
  };
}

export function selectVenuePreset(input?: { venueType?: string | null; venueName?: string | null; capacity?: number | null; variantSeed?: string | null }): VenuePreset {
  const stageType = selectStageType(input);
  const capacity = input?.capacity ?? NaN;
  let sizeName: VenuePresetName = "medium";
  if (stageType === "club" || (Number.isFinite(capacity) && capacity > 0 && capacity <= 250)) sizeName = "small";
  else if (stageType === "stadium" || stageType === "arena" || stageType === "festival" || (Number.isFinite(capacity) && capacity >= 1200)) sizeName = "large";
  const preset = buildPreset(sizeName, stageType);
  const seed = input?.variantSeed ?? input?.venueName ?? null;
  return seed ? applyVenueVariation(preset, `${seed}|${stageType}|${sizeName}`) : preset;
}


export function scaleVenuePreset(preset: VenuePreset, size: Size): VenuePreset {
  const scaledStage = scaleRect(preset.stage, size);
  const scaledBarriers = preset.barriers.map((r) => scaleRect(r, size));
  const d = preset.decorations;
  const decorations: StageDecorations = {
    ampsLeft: d.ampsLeft.map((r) => scaleRect(r, size)),
    ampsRight: d.ampsRight.map((r) => scaleRect(r, size)),
    monitors: d.monitors.map((r) => scaleRect(r, size)),
    speakerStacks: d.speakerStacks.map((r) => scaleRect(r, size)),
    subwoofers: d.subwoofers.map((r) => scaleRect(r, size)),
    drumRiser: d.drumRiser ? scaleRect(d.drumRiser, size) : null,
    lightingTruss: d.lightingTruss ? scaleRect(d.lightingTruss, size) : null,
    lightFixtures: d.lightFixtures.map((p) => scalePoint(p, size)),
    followSpots: d.followSpots.map((p) => scalePoint(p, size)),
    backdrop: d.backdrop ? scaleRect(d.backdrop, size) : null,
    bannerRect: d.bannerRect ? scaleRect(d.bannerRect, size) : null,
    bigScreens: d.bigScreens.map((r) => scaleRect(r, size)),
    barrierPosts: d.barrierPosts.map((p) => scalePoint(p, size)),
    micStands: d.micStands.map((p) => scalePoint(p, size)),
    cableRuns: d.cableRuns.map((r) => scaleRect(r, size)),
    guitarRack: d.guitarRack ? scaleRect(d.guitarRack, size) : null,
    fohTower: d.fohTower ? scaleRect(d.fohTower, size) : null,
    securityPosts: d.securityPosts.map((p) => scalePoint(p, size)),
    ledLipStrip: d.ledLipStrip ? scaleRect(d.ledLipStrip, size) : null,
    floorTapeMarks: d.floorTapeMarks.map((p) => scalePoint(p, size)),
    seatingTiers: d.seatingTiers.map((r) => scaleRect(r, size)),
    tentCanopy: d.tentCanopy ? scaleRect(d.tentCanopy, size) : null,
    tentStripes: d.tentStripes,
    floorPattern: d.floorPattern,
    palette: d.palette,
  };
  return {
    ...preset,
    bounds: scaleRect(preset.bounds, size),
    stage: scaledStage,
    audience: scaleRect(preset.audience, size),
    entrances: preset.entrances.map((p) => scalePoint(p, size)),
    backstage: scalePoint(preset.backstage, size),
    performerSlots: Object.fromEntries(Object.entries(preset.performerSlots).map(([k, p]) => [k, scalePoint(p, size)])),
    crowdZones: preset.crowdZones.map((r) => scaleRect(r, size)),
    barriers: scaledBarriers,
    labelSafe: scaleRect(preset.labelSafe, size),
    decorations,
  };
}
