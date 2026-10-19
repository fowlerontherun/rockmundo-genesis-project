import type { ConcertFrame, ConcertOptions } from "@/features/gig-demo-3d/liveTypes";
import { resolveVenueProfile, stagePosition } from "@/features/gig-demo-3d/venueProfile";
import { defaultAppearance } from "@/features/player-model/appearance";
import type { GigPlayerModelsData } from "@/features/player-model/usePlayerModel";

/**
 * Read-only visualization of a canonical DJ booking.
 * No payouts, fan growth, scores, rights or admissions are computed here.
 */
export interface DjStageMixEvent {
  event_no: number;
  kind: string;
  recorded_at: string;
}

export interface DjStageAudience {
  attendance: number;
  venue_capacity: number;
}

export interface DjStageBooking {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
}

function unit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function seededClubId(input: string): number {
  let hash = 2166136261;
  for (const char of input) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function djStageOccupancy(
  crowd: DjStageAudience | null,
  officialCapacity: number | null | undefined,
): { occupancy: number; verified: boolean } {
  // Crowd accounting cannot be inferred from arbitrary mixer taps. A small,
  // explicitly labelled illustrative visual dancefloor is used while live.
  if (!crowd) return { occupancy: 0.12, verified: false };
  const capacities = [officialCapacity, crowd.venue_capacity]
    .filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0);
  if (capacities.length === 0 || !Number.isInteger(crowd.attendance) || crowd.attendance < 0) {
    return { occupancy: 0, verified: false };
  }
  const safeCapacity = Math.min(...capacities);
  // A bad or forged receipt never inflates the picture past actual capacity.
  return { occupancy: unit(Math.min(crowd.attendance, safeCapacity) / safeCapacity), verified: true };
}

export function buildDjClubStageOptions(
  profileId: string, clubId: string, clubName: string, capacity: number | null | undefined,
  model: GigPlayerModelsData | null | undefined,
): ConcertOptions {
  const venue: ConcertOptions["venue"] = {
    name: clubName, bandName: "DJ SET", archetype: "club", type: "rock_club",
    capacity: Number.isFinite(capacity) && (capacity ?? 0) > 0 ? capacity : 150,
    seed: seededClubId(clubId), id: clubId,
  };
  const p = resolveVenueProfile(venue);
  return {
    venue,
    externalClock: false,
    performers: [{
      id: profileId,
      displayName: "DJ",
      role: "dj",
      instrument: "turntablism",
      position: stagePosition(p, 0.5, 0.43),
      appearance: model?.appearances?.[profileId] ?? defaultAppearance(profileId),
      richClothing: model?.richClothing?.[profileId] ?? [],
      tattoos: model?.tattoos?.[profileId] ?? [],
      instrumentSkin: model?.instrumentSkins?.[profileId]?.find(
        (visual) => visual.instrument_id === "turntablism",
      ) ?? null,
      merchWearable: model?.merchWearables?.[profileId] ?? null,
      phase: 0,
    }],
  };
}

export function buildDjClubStageFrame(
  booking: DjStageBooking,
  profileId: string,
  acceptedEvents: readonly DjStageMixEvent[],
  crowd: DjStageAudience | null,
  capacity: number | null | undefined,
  nowMs: number,
  reducedMotion = false,
): ConcertFrame {
  const start = Date.parse(booking.starts_at);
  const end = Date.parse(booking.ends_at);
  const length = Number.isFinite(start) && Number.isFinite(end) && end > start ? end - start : 1;
  const elapsed = Number.isFinite(nowMs) && Number.isFinite(start)
    ? Math.max(0, Math.min(length, nowMs - start)) : 0;
  const valid = acceptedEvents
    .filter(event => Number.isInteger(event.event_no) && event.event_no > 0)
    .sort((a, b) => a.event_no - b.event_no);
  const last = valid[valid.length - 1];
  const accepted = valid.length;
  const occupancy = djStageOccupancy(crowd, capacity).occupancy;
  // Reactions depend on actual server-persisted *mixer evidence*, not
  // untrusted browser fader positions, random scores or alleged attendance.
  const energy = unit(0.24 + Math.min(8, accepted) * 0.055);
  const reaction = reducedMotion ? "still"
    : last?.kind === "crossfade" ? "cheer"
      : last?.kind === "deck_play" ? "bounce"
        : last?.kind === "tempo" ? "sway" : "sway";
  const isLive = booking.status === "live";
  return {
    positionMs: elapsed,
    section: last?.kind === "crossfade" ? "chorus" : "verse",
    sectionProgress: unit(elapsed / length),
    energy,
    crowd: occupancy,
    occupancy,
    crowdReaction: isLive ? reaction : "still",
    performing: isLive,
    look: last?.kind === "crossfade" ? "encore" : "electric",
    lightLevel: 0.72,
    focusId: profileId,
    effect: null,
    performers: [{
      id: profileId,
      position: [0, 0, 0], // replaced with the actual rig's stage position by the caller
      visible: isLive,
      walking: false,
      action: isLive ? "dj_mix" : null,
      actionProgress: 0,
    }],
  };
}
