import { getDisplayDurationMinutes } from "@/utils/activityBookingTime";

export type SmokeQueryState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: T };

export function getControlledLoadState<T>(state: SmokeQueryState<T>, emptyMessage: string) {
  if (state.status === "loading") return { kind: "loading" as const, message: "Loading" };
  if (state.status === "error") return { kind: "error" as const, message: state.message };
  const isEmpty = Array.isArray(state.data) && state.data.length === 0;
  return { kind: isEmpty ? "empty" as const : "ready" as const, message: isEmpty ? emptyMessage : "Ready" };
}

export interface SmokeScheduleActivity {
  id: string;
  title: string;
  scheduled_start: string;
  scheduled_end?: string | null;
  duration_minutes?: number | null;
  source?: "booked" | "placeholder" | "mock";
}

export function realChronologicalSchedule(activities: SmokeScheduleActivity[]) {
  return activities
    .filter((activity) => activity.source !== "placeholder" && activity.source !== "mock")
    .map((activity) => ({ ...activity, displayDurationMinutes: getDisplayDurationMinutes(activity) }))
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
}

export interface SongSmokeFixture {
  id: string;
  title: string;
  status: "draft" | "completed" | "recorded" | "released";
  ownerProfileId: string;
  bandId?: string | null;
}

export function getSongwritingState(state: SmokeQueryState<SongSmokeFixture[]>) {
  return getControlledLoadState(state, "No songs yet");
}

export function eligibleSongsForRecording(songs: SongSmokeFixture[]) {
  return songs.map((song) => ({
    ...song,
    eligible: song.status === "completed",
    reason: song.status === "completed" ? null : "Only completed songs can be recorded.",
  }));
}

export function releaseCandidates(songs: SongSmokeFixture[]) {
  return songs.filter((song) => song.status === "recorded");
}

export function canAccessBandPrivateContent(profileId: string, memberProfileIds: string[]) {
  return memberProfileIds.includes(profileId);
}

export function requireAdmin(role: "user" | "moderator" | "admin") {
  return role === "admin" ? { allowed: true as const } : { allowed: false as const, reason: "Admin access required" };
}

export function createIdempotencyGuard() {
  const seen = new Set<string>();
  return (key: string) => {
    if (seen.has(key)) return { accepted: false as const, reason: "Duplicate request ignored" };
    seen.add(key);
    return { accepted: true as const };
  };
}

export function applyResourceTransaction(balance: number, amount: number, idempotencyKey: string, guard = createIdempotencyGuard()) {
  const duplicate = guard(idempotencyKey);
  if (!duplicate.accepted) return { ok: false as const, balance, reason: duplicate.reason };
  const nextBalance = balance + amount;
  if (nextBalance < 0) return { ok: false as const, balance, reason: "Insufficient funds" };
  return { ok: true as const, balance: nextBalance };
}
