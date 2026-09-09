import type { ConcertVenue } from './liveTypes';

/** Exact game types take precedence over a venue's marketing name. */
export const VENUE_TYPES = {
  street_corner: ['Street corner', 40], cafe_stage: ['Café stage', 70], dive_bar: ['Dive bar', 150], jazz_lounge: ['Jazz lounge', 250],
  rock_club: ['Rock club', 700], live_house: ['Live house', 900], warehouse: ['Warehouse', 2000], university_union: ['University union', 350], church_hall: ['Church hall', 250],
  concert_hall: ['Concert hall', 2500], theatre: ['Theatre', 2000], indoor_arena: ['Indoor arena', 18000], ice_arena: ['Ice arena', 10000], stadium: ['Stadium', 65000],
  amphitheatre: ['Amphitheatre', 12000], park_bandstand: ['Park bandstand', 1500], city_square: ['City square', 4500], rooftop_terrace: ['Rooftop terrace', 450],
  festival_tent: ['Festival tent', 5000], beach_stage: ['Beach stage', 3000], festival_stage: ['Festival stage', 20000],
} as const;
export type VenueKind = keyof typeof VENUE_TYPES;
export interface VenueProfile {
  kind: VenueKind; label: string; capacity: number; outdoor: boolean; size: 'intimate' | 'small' | 'medium' | 'large' | 'landmark';
  stageWidth: number; stageDepth: number; stageHeight: number; rigHeight: number;
  roomWidth: number; roomDepth: number; roofHeight: number; crowdWidth: number; crowdDepth: number;
  seating: boolean; seatRows: number; production: 'portable' | 'house' | 'touring'; accent: string;
}
const aliases: Record<string, VenueKind> = { pub: 'dive_bar', club: 'rock_club', arena: 'indoor_arena', theatre: 'theatre', stadium: 'stadium', theater: 'theatre', amphitheater: 'amphitheatre', beach: 'beach_stage', festival: 'festival_stage', cafe: 'cafe_stage', bar: 'dive_bar' };
const alias = (key: string): VenueKind | undefined => Object.prototype.hasOwnProperty.call(aliases, key) ? aliases[key] : undefined;
const normalise = (s: string) => s.toLowerCase().trim().replace(/[\s-]+/g, '_');
const fallback = (capacity: number): VenueKind => capacity >= 25000 ? 'stadium' : capacity >= 5000 ? 'indoor_arena' : capacity >= 700 ? 'concert_hall' : capacity <= 180 ? 'dive_bar' : 'rock_club';
export function resolveVenueProfile(venue: Partial<ConcertVenue> = {}): VenueProfile {
  const typed = normalise(venue.type ?? ''), rawCapacity = venue.capacity;
  let kind: VenueKind | undefined = Object.prototype.hasOwnProperty.call(VENUE_TYPES, typed) ? typed as VenueKind : alias(typed);
  if (!kind && typed !== 'large_venue') {
    const name = normalise(venue.name ?? '');
    kind = (Object.keys(VENUE_TYPES) as VenueKind[]).find(k => name.includes(k));
    if (!kind && !typed) kind = alias(venue.archetype ?? '');
  }
  const capacity = Number.isFinite(rawCapacity) && rawCapacity! > 0 ? Math.max(1, Math.min(150000, Math.round(rawCapacity!))) : kind ? VENUE_TYPES[kind][1] : 500;
  kind ??= fallback(capacity);
  const level = capacity <= 100 ? 0 : capacity <= 500 ? 1 : capacity <= 3000 ? 2 : capacity <= 15000 ? 3 : 4;
  const stageWidth = [6.4, 8.2, 11.6, 17, 24][level], stageDepth = [3.8, 4.6, 5.9, 8, 10][level], stageHeight = [.25, .5, .9, 1.3, 1.8][level];
  const outdoor = ['street_corner','amphitheatre','park_bandstand','city_square','rooftop_terrace','beach_stage','festival_stage','stadium'].includes(kind);
  const seating = ['concert_hall','theatre','indoor_arena','ice_arena','stadium','amphitheatre'].includes(kind);
  const production = level === 0 || kind === 'street_corner' || kind === 'cafe_stage' ? 'portable' : level >= 3 ? 'touring' : 'house';
  return { kind, label: VENUE_TYPES[kind][0], capacity, outdoor, size: ['intimate','small','medium','large','landmark'][level] as VenueProfile['size'], stageWidth, stageDepth, stageHeight,
    rigHeight: stageHeight + [3.1, 4, 5.3, 7, 9][level], roomWidth: stageWidth + [5, 8, 14, 26, 42][level], roomDepth: [15, 22, 34, 50, 76][level], roofHeight: [4.5, 5.8, 8.5, 14, 22][level],
    crowdWidth: ['cafe_stage','jazz_lounge'].includes(kind) ? stageWidth : stageWidth + [0, 1, 2, 5, 8][level], crowdDepth: [6, 10, 16, 26, 40][level], seating, seatRows: seating ? [2, 3, 5, 8, 12][level] : 0, production,
    accent: ['jazz_lounge','theatre','concert_hall'].includes(kind) ? '#9c3f52' : ['park_bandstand','church_hall'].includes(kind) ? '#537c62' : kind === 'warehouse' ? '#ba7c37' : '#3b8ba5' };
}
/** Coordinates shared by deck, rig, fixed instruments and replay performers. */
export function stagePosition(p: VenueProfile, u: number, v: number): [number, number, number] {
  return [(u - .5) * p.stageWidth * .78, p.stageHeight, .65 - p.stageDepth * .91 + v * p.stageDepth * .8];
}
export function stageTransform(p: VenueProfile, point: readonly number[]): [number, number, number] {
  return [point[0] * p.stageWidth / 11.6, p.stageHeight + (point[1] - .9) * (p.rigHeight - p.stageHeight) / 5.3, .65 + (point[2] - .65) * p.stageDepth / 5.9];
}
