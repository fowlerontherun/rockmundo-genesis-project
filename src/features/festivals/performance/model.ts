export type FestivalSessionStatus =
  | "scheduled" | "arrival_open" | "checked_in" | "soundcheck_pending" | "soundcheck_complete" | "ready" | "stage_call" | "in_progress" | "completed" | "partially_completed" | "cancelled" | "no_show" | "abandoned";

export type ReadinessBand = "excellent" | "ready" | "strained" | "compromised" | "unfit" | "blocked";
export type ReadinessDimension = { status: ReadinessBand | "ready" | "blocked"; blockers: string[]; warnings: string[]; facts?: string[]; lastCalculatedAt?: string };
export type FestivalSessionReadiness = Record<string, unknown> & { overall: { status: "ready" | "blocked" | "strained"; last_calculated_at?: string } };
export type FestivalSession = { id: string; status: FestivalSessionStatus; festival_id?: string; edition_id?: string; band_id?: string; stage_id?: string | null; scheduled_start_at: string; scheduled_end_at: string; arrival_deadline_at?: string; stage_call_at?: string | null; current_setlist_position?: number; active_song_position?: number | null; setlist_snapshot?: unknown; readiness_snapshot?: unknown };
export type FestivalPublicSession = { session_id: string; festival_id: string; edition_id: string; band_id: string; stage_id: string | null; scheduled_start_at: string; scheduled_end_at: string; actual_start_at: string | null; actual_end_at: string | null; public_status: string; current_safe_progress: { current_position?: number; active_song_position?: number | null }; completed_song_count: number; total_planned_song_count: number; headline: boolean; public_incident_status: string };

export const FESTIVAL_SESSION_TRANSITIONS: Record<FestivalSessionStatus, FestivalSessionStatus[]> = {
  scheduled: ["arrival_open", "cancelled", "no_show"],
  arrival_open: ["checked_in", "soundcheck_pending", "cancelled", "no_show"],
  checked_in: ["soundcheck_pending", "ready", "cancelled"],
  soundcheck_pending: ["soundcheck_complete", "cancelled"],
  soundcheck_complete: ["ready", "cancelled"],
  ready: ["stage_call", "in_progress", "cancelled"],
  stage_call: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed", "partially_completed", "abandoned"],
  completed: [], partially_completed: [], cancelled: [], no_show: [], abandoned: [],
};

export function canTransitionFestivalSession(from: FestivalSessionStatus, to: FestivalSessionStatus): boolean { return FESTIVAL_SESSION_TRANSITIONS[from]?.includes(to) ?? false; }
export function festivalTimingWindows(startIso: string, endIso: string) { const start = new Date(startIso).getTime(); const end = new Date(endIso).getTime(); const min = 60_000; return { arrivalWindowOpensAt: new Date(start - 360 * min).toISOString(), arrivalDeadlineAt: new Date(start - 45 * min).toISOString(), soundcheckStartAt: new Date(start - 90 * min).toISOString(), stageCallAt: new Date(start - 15 * min).toISOString(), startToleranceMinutes: 20, noShowAfterMinutes: 15, scheduledDurationMinutes: Math.max(1, Math.round((end - start) / min)) }; }
export function calculateLateMinutes(nowIso: string, deadlineIso: string): number { return Math.max(0, Math.floor((new Date(nowIso).getTime() - new Date(deadlineIso).getTime()) / 60_000)); }
export function healthReadiness(input: { health?: number; energy?: number; fatigue?: number; stress?: number; illness?: boolean; injury?: boolean; intoxication?: boolean; voice?: number; morale?: number; sleep?: number; burnout?: number }): ReadinessBand { if (input.illness || input.injury || input.intoxication || (input.health ?? 100) < 25) return "unfit"; if ((input.energy ?? 100) < 25 || (input.fatigue ?? 0) > 85 || (input.voice ?? 100) < 30) return "compromised"; if ((input.stress ?? 0) > 70 || (input.burnout ?? 0) > 70 || (input.sleep ?? 100) < 40) return "strained"; if ((input.health ?? 0) > 85 && (input.energy ?? 0) > 80 && (input.morale ?? 0) > 75) return "excellent"; return "ready"; }
export function overallReadiness(dimensions: ReadinessDimension[]): ReadinessBand { if (dimensions.some((d) => d.status === "blocked" || d.status === "unfit" || d.blockers.length > 0)) return "blocked"; if (dimensions.some((d) => d.status === "compromised")) return "compromised"; if (dimensions.some((d) => d.status === "strained" || d.warnings.length > 0)) return "strained"; if (dimensions.every((d) => d.status === "excellent")) return "excellent"; return "ready"; }
export function nextSetlistPosition(current: number, action: string, total: number): number { if (action === "complete_song" || action === "skip_song") return Math.min(total, current + 1); if (action === "curtail_remaining_set") return total; return current; }
export function publicProjectionIsPrivateSafe(row: Record<string, unknown>): boolean { return !("health_snapshot" in row) && !("equipment_snapshot" in row) && !("contract_economics" in row) && !("attendance_snapshot" in row); }
export function realtimeInvalidationKeys(sessionId: string) { return [["festival-performance-session", sessionId], ["festival-session-readiness", sessionId], ["festival-session-arrival", sessionId], ["festival-session-events", sessionId]] as const; }
