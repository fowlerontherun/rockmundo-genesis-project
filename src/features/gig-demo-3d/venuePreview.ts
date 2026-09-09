import { defaultAppearance } from '@/features/player-model/appearance';
import type { ConcertOptions, StageRole } from './liveTypes';
import { resolveVenueProfile, stagePosition, type VenueKind } from './venueProfile';

/** Fictional preview uses the production layout without reading/writing game data. */
export function venuePreviewOptions(type: VenueKind, capacity: number): ConcertOptions {
  const venue = { type, capacity, name: `${resolveVenueProfile({ type }).label} preview`, bandName: 'NEON HOURS', archetype: type, seed: 85043 };
  const p = resolveVenueProfile(venue);
  const band: [string, StageRole, number, number][] = [['Alex','vocals',.5,.78],['Riley','guitar',.2,.62],['Sam','bass',.8,.62],['Charlie','drums',.5,.18]];
  return { externalClock: false, venue, performers: band.map(([name, role, u, v], i) => ({ id: `preview-${i}`, displayName: name, role, phase: i, appearance: defaultAppearance(name), position: stagePosition(p,u,v) })) };
}
