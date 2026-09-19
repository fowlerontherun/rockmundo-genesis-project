import { smoothMotion } from './performanceMotion';

export interface CrowdEventPlan {
  pit: number;
  turn: number;
  radius: number;
  centerX: number;
  centerZ: number;
  surf: number;
  surfProgress: number;
  surferRank: number;
}

const envelope = (time: number, start: number, end: number, ramp: number) =>
  smoothMotion((time - start) / ramp) * (1 - smoothMotion((time - end + ramp) / ramp));

/** One small pocket reacts; sparse crowds, quiet songs and studio floors stay clear. */
export function crowdEventPlan(seconds: number, density: number, energy: number, reaction: string, reduced: boolean,
  area: { width: number; depth: number; front: number; runway: boolean }, television = false, cueProgress?: number): CrowdEventPlan {
  const cycle = Math.max(0, seconds) % 48;
  const explicitPit = /mosh|circle_pit/.test(reaction), explicitSurf = /crowd_surf/.test(reaction);
  const lively = /bounce|jump|cheer|roar|mosh|circle_pit|crowd_surf/.test(reaction);
  const allowed = !reduced && !television && !area.runway && density >= .55 && area.width >= 8 && area.depth >= 6 && lively;
  const intensity = explicitPit || explicitSurf ? 1 : smoothMotion((energy - .65) / .25);
  const cued = cueProgress !== undefined && (explicitPit || explicitSurf);
  const cueEnvelope = cued ? envelope(cueProgress, 0, 1, .18) : 0;
  return {
    pit: allowed && !explicitSurf ? (cued ? cueEnvelope : envelope(cycle, 2, 30, 3)) * intensity : 0,
    turn: cued ? cueProgress * Math.PI * 4 : Math.max(0, cycle - 2) * .72,
    radius: Math.min(1.65, area.width * .16, area.depth * .20),
    centerX: -area.width * .16,
    centerZ: area.front + area.depth * .48,
    surf: allowed && !explicitPit ? (cued ? cueEnvelope : envelope(cycle, explicitSurf ? 2 : 23, explicitSurf ? 26 : 46, 3)) * intensity : 0,
    surfProgress: cued ? smoothMotion(cueProgress) : smoothMotion((cycle - (explicitSurf ? 2 : 23)) / 23),
    surferRank: cued ? 16 : 16 + Math.floor(Math.max(0, seconds) / 48) % 24,
  };
}

export function circlePitSlots(fans: { rank: number; x: number; z: number }[], event: CrowdEventPlan) {
  const runners = fans.filter(fan => Math.hypot(fan.x - event.centerX, fan.z - event.centerZ) < event.radius + .38);
  runners.sort((a, b) => Math.atan2(a.z - event.centerZ, a.x - event.centerX) - Math.atan2(b.z - event.centerZ, b.x - event.centerX));
  return new Map(runners.map((fan, index) => [fan.rank, -Math.PI + index / runners.length * Math.PI * 2]));
}

export function circlePitPosition(x: number, z: number, personality: number, event: CrowdEventPlan, slotAngle?: number) {
  const dx = x - event.centerX, dz = z - event.centerZ, distance = Math.hypot(dx, dz);
  const runner = event.pit > 0 && distance < event.radius + .38;
  if (!runner) {
    // Spectators step back to leave a visible ring, instead of standing in the
    // runners' path. They return to their original place when the pit closes.
    const clearance = event.pit * Math.max(0, event.radius + 1 - distance);
    return { x: x + dx / Math.max(.001, distance) * clearance, z: z + dz / Math.max(.001, distance) * clearance, yaw: Math.PI, running: 0 };
  }
  const angle = (slotAngle ?? Math.atan2(dz, dx)) + event.turn;
  const radius = event.radius + personality * .28;
  const blend = event.pit;
  // Returning the same member to the same spot at the end prevents replacement
  // pop-in and preserves the authoritative representative attendance.
  return {
    x: x + (event.centerX + Math.cos(angle) * radius - x) * blend,
    z: z + (event.centerZ + Math.sin(angle) * radius - z) * blend,
    yaw: -angle,
    running: blend,
  };
}
