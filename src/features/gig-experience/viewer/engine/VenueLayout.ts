import type { Rect, Point, Size } from "./Viewport";
import { scaleRect, scalePoint } from "./Viewport";

export type VenuePresetName = "small" | "medium" | "large";
export interface VenuePreset { name: VenuePresetName; bounds: Rect; stage: Rect; audience: Rect; entrances: Point[]; backstage: Point; performerSlots: Record<string, Point>; crowdZones: Rect[]; barriers: Rect[]; labelSafe: Rect }

export const VENUE_PRESETS: Record<VenuePresetName, VenuePreset> = {
  small: { name: "small", bounds: { x: 0, y: 0, width: 1, height: 1 }, stage: { x: .18, y: .08, width: .64, height: .25 }, audience: { x: .08, y: .38, width: .84, height: .5 }, entrances: [{ x: .5, y: .95 }], backstage: { x: .88, y: .18 }, performerSlots: { vocalist: { x: .5, y: .27 }, guitar: { x: .32, y: .23 }, bass: { x: .68, y: .23 }, drums: { x: .5, y: .14 }, keyboard: { x: .72, y: .15 }, dj: { x: .58, y: .15 }, backing: { x: .24, y: .15 }, unknown: { x: .5, y: .2 } }, crowdZones: [{ x: .1, y: .4, width: .8, height: .46 }], barriers: [{ x: .16, y: .34, width: .68, height: .025 }], labelSafe: { x: .03, y: .03, width: .94, height: .08 } },
  medium: { name: "medium", bounds: { x: 0, y: 0, width: 1, height: 1 }, stage: { x: .12, y: .07, width: .76, height: .28 }, audience: { x: .06, y: .39, width: .88, height: .5 }, entrances: [{ x: .35, y: .96 }, { x: .65, y: .96 }], backstage: { x: .92, y: .2 }, performerSlots: { vocalist: { x: .5, y: .29 }, guitar: { x: .28, y: .24 }, bass: { x: .69, y: .25 }, drums: { x: .5, y: .15 }, keyboard: { x: .76, y: .16 }, dj: { x: .58, y: .16 }, backing: { x: .22, y: .16 }, unknown: { x: .5, y: .22 } }, crowdZones: [{ x: .07, y: .41, width: .86, height: .32 }, { x: .14, y: .74, width: .72, height: .13 }], barriers: [{ x: .1, y: .36, width: .8, height: .025 }], labelSafe: { x: .03, y: .03, width: .94, height: .08 } },
  large: { name: "large", bounds: { x: 0, y: 0, width: 1, height: 1 }, stage: { x: .08, y: .05, width: .84, height: .3 }, audience: { x: .03, y: .39, width: .94, height: .53 }, entrances: [{ x: .2, y: .96 }, { x: .5, y: .97 }, { x: .8, y: .96 }], backstage: { x: .95, y: .18 }, performerSlots: { vocalist: { x: .5, y: .29 }, guitar: { x: .25, y: .25 }, bass: { x: .72, y: .25 }, drums: { x: .5, y: .13 }, keyboard: { x: .78, y: .15 }, dj: { x: .62, y: .14 }, backing: { x: .2, y: .16 }, unknown: { x: .5, y: .22 } }, crowdZones: [{ x: .04, y: .41, width: .92, height: .28 }, { x: .08, y: .7, width: .84, height: .2 }], barriers: [{ x: .06, y: .36, width: .88, height: .025 }], labelSafe: { x: .03, y: .03, width: .94, height: .08 } },
};

export function selectVenuePreset(input?: { venueType?: string | null; capacity?: number | null }): VenuePreset {
  const type = input?.venueType?.toLowerCase() ?? "";
  const capacity = input?.capacity ?? NaN;
  if (type.includes("small") || (Number.isFinite(capacity) && capacity > 0 && capacity <= 250)) return VENUE_PRESETS.small;
  if (type.includes("large") || type.includes("arena") || (Number.isFinite(capacity) && capacity >= 1200)) return VENUE_PRESETS.large;
  return VENUE_PRESETS.medium;
}

export function scaleVenuePreset(preset: VenuePreset, size: Size): VenuePreset { return { ...preset, bounds: scaleRect(preset.bounds, size), stage: scaleRect(preset.stage, size), audience: scaleRect(preset.audience, size), entrances: preset.entrances.map((p) => scalePoint(p, size)), backstage: scalePoint(preset.backstage, size), performerSlots: Object.fromEntries(Object.entries(preset.performerSlots).map(([k, p]) => [k, scalePoint(p, size)])), crowdZones: preset.crowdZones.map((r) => scaleRect(r, size)), barriers: preset.barriers.map((r) => scaleRect(r, size)), labelSafe: scaleRect(preset.labelSafe, size) }; }
