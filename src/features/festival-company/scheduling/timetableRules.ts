/**
 * Canonical festival timetable rules (Phase 5).
 *
 * These mirror the database triggers on public.festival_stage_slots so the
 * client can warn before a write is rejected. The database remains the
 * authority — never rely on these checks alone.
 */

export const FESTIVAL_PERFORMANCE_WINDOW = {
  earliestLocalStartMinutes: 13 * 60,
  latestLocalEndMinutes: 22 * 60,
} as const;

export const FESTIVAL_SLOT_DURATION_RULES = {
  regular: { minMinutes: 40, maxMinutes: 50 },
  headline: { minMinutes: 60, maxMinutes: 90 },
} as const;

export type FestivalTimetableViolation =
  | "starts_before_window"
  | "ends_after_window"
  | "duration_below_minimum"
  | "duration_above_maximum"
  | "duration_mismatch";

export interface FestivalSlotCandidate {
  /** Minutes past local midnight for the slot start. */
  localStartMinutes: number;
  /** Minutes past local midnight for the slot end. */
  localEndMinutes: number;
  headline: boolean;
  /** Optional booked performance length, which must match the slot length. */
  performanceDurationMinutes?: number;
}

export interface FestivalTimetableCheck {
  valid: boolean;
  violations: FestivalTimetableViolation[];
  messages: string[];
}

const MESSAGES: Record<FestivalTimetableViolation, string> = {
  starts_before_window: "Performances cannot start before 13:00 local time.",
  ends_after_window: "Performances cannot end after 22:00 local time.",
  duration_below_minimum: "Slot is shorter than the allowed performance length.",
  duration_above_maximum: "Slot is longer than the allowed performance length.",
  duration_mismatch: "Booked performance length must match the stage slot length.",
};

export function durationRuleFor(headline: boolean) {
  return headline ? FESTIVAL_SLOT_DURATION_RULES.headline : FESTIVAL_SLOT_DURATION_RULES.regular;
}

export function checkFestivalSlot(candidate: FestivalSlotCandidate): FestivalTimetableCheck {
  const violations: FestivalTimetableViolation[] = [];
  const rule = durationRuleFor(candidate.headline);
  const minutes = candidate.localEndMinutes - candidate.localStartMinutes;

  if (candidate.localStartMinutes < FESTIVAL_PERFORMANCE_WINDOW.earliestLocalStartMinutes) {
    violations.push("starts_before_window");
  }
  if (candidate.localEndMinutes > FESTIVAL_PERFORMANCE_WINDOW.latestLocalEndMinutes) {
    violations.push("ends_after_window");
  }
  if (minutes < rule.minMinutes) {
    violations.push("duration_below_minimum");
  }
  if (minutes > rule.maxMinutes) {
    violations.push("duration_above_maximum");
  }
  if (
    candidate.performanceDurationMinutes !== undefined &&
    candidate.performanceDurationMinutes !== minutes
  ) {
    violations.push("duration_mismatch");
  }

  return {
    valid: violations.length === 0,
    violations,
    messages: violations.map((violation) => MESSAGES[violation]),
  };
}

export function localMinutesInTimezone(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return (hour % 24) * 60 + minute;
}
