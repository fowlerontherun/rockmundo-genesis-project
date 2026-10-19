import type { ConcertFrame, ConcertOptions } from "@/features/gig-demo-3d/liveTypes";
import { resolveVenueProfile, stagePosition } from "@/features/gig-demo-3d/venueProfile";
import { defaultAppearance } from "@/features/player-model/appearance";
import type { GigPlayerModelsData } from "@/features/player-model/usePlayerModel";
import { DJ_BOOTH_CUE_WINDOW_MS, type DjBoothAction } from "@/features/gig-demo-3d/djBoothMotion";

/**
 * Read-only visualization of a canonical DJ booking.
 * No payouts, fan growth, scores, rights or admissions are computed here.
 */
export interface DjStageMixEvent {
  event_no: number;
  kind: string;
  recorded_at: string;
  deck?: string | null;
}

export interface DjStageAudience {
  attendance: number;
  venue_capacity: number;
}

export interface DjStageBooking {
  id: string;
  club_id?: string;
  status: string;
  starts_at: string;
  ends_at: string;
}

/** Only accepted, recently recorded mixer evidence can move the DJ's hands.
 * Never synthesize an action from local fader/audio state or an older event.
 */
export function djBoothActionAt(
  events: readonly DjStageMixEvent[],
  nowMs: number,
): { action: DjBoothAction; actionProgress: number } | null {
  if (!Number.isFinite(nowMs)) return null;
  const recent = events.filter(event => {
    const at = Date.parse(event.recorded_at);
    return Number.isInteger(event.event_no) && event.event_no > 0 &&
      Number.isFinite(at) && at <= nowMs && nowMs - at <= DJ_BOOTH_CUE_WINDOW_MS;
  }).sort((a, b) => a.event_no - b.event_no);
  const event = recent[recent.length - 1];
  if (!event) return null;
  const action: DjBoothAction | null = event.kind === "crossfade" ? "dj_crossfade"
    : event.kind === "deck_play" && event.deck === "A" ? "dj_cue_a"
      : event.kind === "deck_play" && event.deck === "B" ? "dj_cue_b"
        : event.kind === "tempo" && event.deck === "A" ? "dj_tempo_a"
          : event.kind === "tempo" && event.deck === "B" ? "dj_tempo_b"
            : null;
  if (!action) return null;
  return { action, actionProgress: (nowMs - Date.parse(event.recorded_at)) / DJ_BOOTH_CUE_WINDOW_MS };
}

/** No replay without the original booked show AND its immutable settlement receipt. */
export function hasVerifiedDjReplay(
  booking: DjStageBooking | null | undefined,
  clubId: string,
  receipt: DjStageAudience | null | undefined,
  events: readonly DjStageMixEvent[] | null | undefined,
  hasReadError = false,
): boolean {
  return !hasReadError && booking?.club_id === clubId &&
    booking.status === "completed" && djReplayDurationMs(booking) > 0 &&
    receipt !== null && receipt !== undefined && events !== null && events !== undefined;
}

/** An exact, read-only replay lasts as long as the canonical booked slot. */
export function djReplayDurationMs(booking: DjStageBooking): number {
  const start = Date.parse(booking.starts_at);
  const end = Date.parse(booking.ends_at);
  return Number.isFinite(start) && Number.isFinite(end) && end > start
    ? end - start : 0;
}

/** Never preview mixer activity before its server-recorded timestamp. */
export function djReplayEventsThrough(
  events: readonly DjStageMixEvent[], atMs: number,
): DjStageMixEvent[] {
  return events.filter(event =>
    Number.isInteger(event.event_no) && event.event_no > 0 &&
    Number.isFinite(Date.parse(event.recorded_at)) &&
    Date.parse(event.recorded_at) <= atMs,
  ).sort((a, b) => a.event_no - b.event_no);
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
    djClub: true,
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
        (visual) => visual.instrumentId === "turntablism",
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
  performerPosition: [number, number, number] = [0, 0, 0],
  verifiedCompletedReplay = false,
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
  const isLive = booking.status === "live" || (verifiedCompletedReplay && booking.status === "completed");
  const booth = isLive && !reducedMotion ? djBoothActionAt(valid, nowMs) : null;
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
      position: performerPosition,
      visible: isLive,
      walking: false,
      action: booth?.action ?? (isLive ? "dj_mix" : null),
      actionProgress: booth?.actionProgress ?? 0,
    }],
  };
}
