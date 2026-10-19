import type { VenueProfile } from "./venueProfile";

export type DjClubCameraShot = "dj_booth" | "dj_overhead" | "dj_dancefloor" | "dj_reverse";
export interface DjClubCameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/** Camera geometry is deterministic, venue-relative and DJ-only.
 * Shared concert and television camera behaviour is untouched.
 */
export function djClubCameraPose(
  shot: DjClubCameraShot,
  p: VenueProfile,
  booth: readonly [number, number, number],
  aspect: number,
): DjClubCameraPose {
  const [x, y, z] = booth;
  if (shot === "dj_booth") {
    const target: [number, number, number] = [x, y + 1.03, z + .12];
    return {
      target,
      position: [target[0] + .8, target[1] + .5,
        target[2] + 2.4 / Math.max(.55, Math.min(1, Number.isFinite(aspect) ? aspect : 1))],
    };
  }
  if (shot === "dj_overhead") {
    return {
      target: [x, y + .9, z + .4],
      position: [x + .2,
        Math.min(p.roofHeight - .4, Math.max(p.stageHeight + 3.1, p.rigHeight * .8)),
        z + 1.5],
    };
  }
  if (shot === "dj_dancefloor") {
    const floorDistance = Math.min(7.5, Math.max(3.2, p.crowdDepth * .35));
    return {
      target: [x, y + 1.27, z + .1],
      position: [-Math.min(2.1, p.stageWidth * .22), p.stageHeight + 1.15,
        z + floorDistance],
    };
  }
  return {
    position: [x - .45, y + 1.7, z - .65],
    target: [0, p.stageHeight + .6, Math.min(p.crowdDepth * .45, 10)],
  };
}
