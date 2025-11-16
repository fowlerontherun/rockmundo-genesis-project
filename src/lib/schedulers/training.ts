import { addDays, addMonths } from "date-fns";

export type TrainingCadence = "daily" | "weekly" | "biweekly" | "monthly";

export interface TrainingScheduleOptions {
  cadence: TrainingCadence;
  sessionsPerWeek?: number;
  preferredWeekdays?: number[] | null;
  preferredTime?: string | null;
  startDate?: Date;
  lastCompletedAt?: Date | null;
}

export interface TrainingSchedulePlan extends TrainingScheduleOptions {
  occurrences?: number;
}

const MINUTES_IN_DAY = 24 * 60;

const isValidWeekday = (value: number | undefined): value is number =>
  typeof value === "number" && value >= 0 && value <= 6;

const normalizeWeekdays = (weekdays?: number[] | null): number[] => {
  if (!Array.isArray(weekdays)) {
    return [];
  }

  const unique = Array.from(new Set(weekdays.filter(isValidWeekday)));
  unique.sort((a, b) => a - b);
  return unique;
};

const parsePreferredTime = (preferredTime?: string | null): { hours: number; minutes: number } | null => {
  if (!preferredTime) {
    return null;
  }

  const parts = preferredTime.split(":");
  if (parts.length < 2) {
    return null;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  if (hours < 0 || hours > 23) {
    return null;
  }

  if (minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
};

const applyPreferredTime = (date: Date, preferredTime?: string | null): Date => {
  const parsed = parsePreferredTime(preferredTime);
  if (!parsed) {
    return date;
  }

  const adjusted = new Date(date);
  adjusted.setHours(parsed.hours, parsed.minutes, 0, 0);
  return adjusted;
};

const clampToFuture = (candidate: Date, reference: Date): Date => {
  if (candidate.getTime() <= reference.getTime()) {
    return addDays(reference, 1);
  }

  return candidate;
};

const findNextPreferredWeekday = (
  candidate: Date,
  preferredWeekdays: number[],
  reference: Date
): Date => {
  if (preferredWeekdays.length === 0) {
    return candidate;
  }

  const next = new Date(candidate);
  const currentDay = candidate.getDay();

  if (preferredWeekdays.includes(currentDay) && candidate.getTime() > reference.getTime()) {
    return candidate;
  }

  for (let offset = 1; offset <= 14; offset += 1) {
    next.setDate(candidate.getDate() + offset);
    if (preferredWeekdays.includes(next.getDay())) {
      return next;
    }
  }

  next.setDate(candidate.getDate() + 7);
  return next;
};

const getIntervalDays = (cadence: TrainingCadence, sessionsPerWeek?: number): number => {
  const safeSessions = Math.max(1, Math.floor(sessionsPerWeek ?? 1));

  switch (cadence) {
    case "daily":
      return Math.max(1, Math.floor(7 / Math.max(safeSessions, 1)));
    case "biweekly":
      return Math.max(1, Math.round((14 / safeSessions) || 14));
    case "monthly":
      return Math.max(1, Math.round((30 / safeSessions) || 30));
    case "weekly":
    default:
      return Math.max(1, Math.round((7 / safeSessions) || 7));
  }
};

export const calculateNextTrainingSession = (
  options: TrainingScheduleOptions
): Date | null => {
  const {
    cadence,
    sessionsPerWeek,
    preferredWeekdays,
    preferredTime,
    startDate,
    lastCompletedAt,
  } = options;

  const reference = new Date();
  const baseline = lastCompletedAt ?? startDate ?? reference;
  const intervalDays = getIntervalDays(cadence, sessionsPerWeek);
  const normalizedPreferredDays = normalizeWeekdays(preferredWeekdays);

  let candidate = new Date(baseline);

  if (candidate.getTime() <= reference.getTime()) {
    candidate = new Date(reference);
  }

  if (cadence === "monthly") {
    const scheduled = applyPreferredTime(addMonths(candidate, 1), preferredTime);
    return clampToFuture(scheduled, reference);
  }

  const nextWindow = addDays(candidate, intervalDays);
  const alignedWeekday = findNextPreferredWeekday(nextWindow, normalizedPreferredDays, reference);
  const scheduled = applyPreferredTime(alignedWeekday, preferredTime);

  return clampToFuture(scheduled, reference);
};

export const generateTrainingSchedule = (
  plan: TrainingSchedulePlan
): Date[] => {
  const { occurrences = 4, ...options } = plan;
  const sessions: Date[] = [];
  let lastSession = options.lastCompletedAt ?? options.startDate ?? new Date();

  for (let index = 0; index < occurrences; index += 1) {
    const next = calculateNextTrainingSession({
      ...options,
      lastCompletedAt: lastSession,
    });

    if (!next) {
      break;
    }

    sessions.push(next);
    lastSession = next;
  }

  return sessions;
};

export const minutesUntilNextSession = (
  nextSessionAt?: string | Date | null,
  referenceDate: Date = new Date()
): number | null => {
  if (!nextSessionAt) {
    return null;
  }

  const next = typeof nextSessionAt === "string" ? new Date(nextSessionAt) : nextSessionAt;
  const difference = next.getTime() - referenceDate.getTime();

  if (Number.isNaN(difference)) {
    return null;
  }

  return Math.round(difference / (1000 * 60));
};

export const isTrainingSessionDue = (
  nextSessionAt?: string | Date | null,
  referenceDate: Date = new Date()
): boolean => {
  if (!nextSessionAt) {
    return false;
  }

  const minutesRemaining = minutesUntilNextSession(nextSessionAt, referenceDate);
  if (minutesRemaining === null) {
    return false;
  }

  return minutesRemaining <= 0;
};

export const estimateWeeklyTrainingMinutes = (
  options: TrainingScheduleOptions & { durationMinutes?: number }
): number => {
  const { sessionsPerWeek = 1, durationMinutes = 60 } = options;
  return Math.max(1, sessionsPerWeek) * Math.max(15, Math.min(durationMinutes, MINUTES_IN_DAY));
};

export default calculateNextTrainingSession;
