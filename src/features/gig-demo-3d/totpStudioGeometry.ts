import type { TotpStageKey } from "@/features/top-of-the-pops/broadcastProfile";
import type { VenueProfile } from "./venueProfile";

export interface TotpStudioStageGeometry {
  centerX: number;
  centerZ: number;
  floorY: number;
  deckWidth: number;
  deckDepth: number;
  safeWidth: number;
  safeDepth: number;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  centerV: number;
  cameraTargetY: number;
}

export function resolveTotpStudioStageGeometry(
  stage: TotpStageKey,
  venue: VenueProfile,
): TotpStudioStageGeometry {
  switch (stage) {
    case "stage_b":
      return {
        centerX: 5.4,
        centerZ: 2.05,
        floorY: .22,
        deckWidth: 4.9,
        deckDepth: 3.7,
        safeWidth: 3.25,
        safeDepth: 2.15,
        minU: .29,
        maxU: .71,
        minV: .30,
        maxV: .78,
        centerV: .54,
        cameraTargetY: 1.15,
      };
    case "rock_stage":
      return {
        centerX: -4.5,
        centerZ: 4.05,
        floorY: .28,
        deckWidth: 6.2,
        deckDepth: 4.7,
        safeWidth: 4.35,
        safeDepth: 2.7,
        minU: .27,
        maxU: .73,
        minV: .29,
        maxV: .78,
        centerV: .53,
        cameraTargetY: 1.25,
      };
    case "studio_floor":
      return {
        centerX: 1.4,
        centerZ: 5.65,
        floorY: .08,
        deckWidth: 6.1,
        deckDepth: 6.1,
        safeWidth: 3.5,
        safeDepth: 2.45,
        minU: .31,
        maxU: .69,
        minV: .31,
        maxV: .75,
        centerV: .53,
        cameraTargetY: 1.05,
      };
    default:
      return {
        centerX: 0,
        centerZ: .65 - venue.stageDepth / 2,
        floorY: venue.stageHeight,
        deckWidth: venue.stageWidth + .7,
        deckDepth: venue.stageDepth + .45,
        safeWidth: Math.min(6.6, venue.stageWidth * .58),
        safeDepth: Math.min(4.25, venue.stageDepth * .64),
        minU: .27,
        maxU: .73,
        minV: .28,
        maxV: .80,
        centerV: .53,
        cameraTargetY: 1.35,
      };
  }
}

export function totpStudioStageCenter(
  stage: TotpStageKey,
  venue: VenueProfile,
): [number, number, number] {
  const geometry = resolveTotpStudioStageGeometry(stage, venue);
  return [geometry.centerX, geometry.cameraTargetY, geometry.centerZ];
}

export function totpStudioDeckContains(
  stage: TotpStageKey,
  venue: VenueProfile,
  x: number,
  z: number,
  margin = 0,
): boolean {
  const geometry = resolveTotpStudioStageGeometry(stage, venue);
  return Math.abs(x - geometry.centerX) <= geometry.deckWidth / 2 - margin
    && Math.abs(z - geometry.centerZ) <= geometry.deckDepth / 2 - margin;
}

export function totpStudioSafeContains(
  stage: TotpStageKey,
  venue: VenueProfile,
  x: number,
  z: number,
): boolean {
  const geometry = resolveTotpStudioStageGeometry(stage, venue);
  return Math.abs(x - geometry.centerX) <= geometry.safeWidth / 2
    && Math.abs(z - geometry.centerZ) <= geometry.safeDepth / 2;
}
