import type { ScheduledActivity } from "@/hooks/useScheduledActivities";
import { addDays, format, startOfDay } from "date-fns";

export interface CharacterTravelRow {
  id: string;
  profile_id?: string | null;
  departure_time?: string | null;
  scheduled_departure_time?: string | null;
  arrival_time?: string | null;
  status?: string | null;
  tour_leg_id?: string | null;
  transport_type?: string | null;
  from_city?: { name?: string | null } | null;
  to_city?: { name?: string | null } | null;
}

/** Travel history includes manual, auto-gig, concierge, charter and tour journeys.
 * Schedule mirrors are preferred; this is the fallback for missing mirrors.
 */
export function mergeCharacterTravel(
  activities: ScheduledActivity[],
  history: CharacterTravelRow[],
  userId: string,
  profileId: string,
): ScheduledActivity[] {
  const validHistory = history.filter((row) =>
    (!row.profile_id || row.profile_id === profileId) &&
    ["scheduled", "in_progress", "completed"].includes(row.status ?? "") &&
    Boolean(row.id));
  const historyTourLegIds = new Set(history
    .filter((row) => (!row.profile_id || row.profile_id === profileId))
    .map((row) => row.tour_leg_id).filter(Boolean));

  // Generic tour projections are not an extra journey when the character has
  // their own authoritative travel history for that leg.
  const base = activities.filter((activity) => !(
    activity.activity_type === "travel" &&
    activity.metadata?.tour_travel_leg === true &&
    historyTourLegIds.has(activity.metadata?.tour_travel_leg_id ?? activity.metadata?.tour_leg_id)
  ));
  const coveredHistory = new Set(base
    .filter((activity) => activity.activity_type === "travel")
    .map((activity) => activity.metadata?.travel_history_id).filter(Boolean));
  const coveredTourLegs = new Set(base
    .filter((activity) => activity.activity_type === "travel")
    .map((activity) => activity.metadata?.tour_leg_id ?? activity.metadata?.tour_travel_leg_id)
    .filter(Boolean));

  const fallback: ScheduledActivity[] = [];
  for (const row of validHistory) {
    if (coveredHistory.has(row.id) || (row.tour_leg_id && coveredTourLegs.has(row.tour_leg_id))) continue;
    const departure = row.scheduled_departure_time ?? row.departure_time;
    const arrival = row.arrival_time;
    if (!departure || !arrival || !Number.isFinite(Date.parse(departure)) ||
        !Number.isFinite(Date.parse(arrival)) || Date.parse(arrival) <= Date.parse(departure)) continue;
    const origin = row.from_city?.name ?? "Departure";
    const destination = row.to_city?.name ?? "Destination";
    fallback.push({
      id: `travel_history_${row.id}`,
      user_id: userId,
      profile_id: profileId,
      activity_type: "travel",
      scheduled_start: departure,
      scheduled_end: arrival,
      status: row.status === "completed" ? "completed" : row.status === "in_progress" ? "in_progress" : "scheduled",
      title: `Travel: ${origin} → ${destination}`,
      location: destination,
      description: row.transport_type ? `By ${row.transport_type.replace(/_/g, " ")}` : undefined,
      metadata: { travel_history_id: row.id, tour_leg_id: row.tour_leg_id, travel_source: "history" },
    });
    coveredHistory.add(row.id);
    if (row.tour_leg_id) coveredTourLegs.add(row.tour_leg_id);
  }
  return [...base, ...fallback];
}

export interface UniversityClassRow {
  id: string;
  status?: string | null;
  enrolled_at?: string | null;
  scheduled_end_date?: string | null;
  university_courses?: {
    name?: string | null;
    class_start_hour?: number | null;
    class_end_hour?: number | null;
  } | null;
  universities?: { name?: string | null; city?: string | null } | null;
}

function campusTime(day: string, hour: number, timeZone?: string | null): Date {
  const [year, month, date] = day.split("-").map(Number);
  if (!timeZone) return new Date(year, month - 1, date, hour);
  // Iteratively convert a campus wall-clock hour to UTC (including DST).
  const target = Date.UTC(year, month - 1, date, hour);
  let instant = target;
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant))
        .filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
      const campusWall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
      const delta = target - campusWall;
      instant += delta;
      if (delta === 0) break;
    }
    return new Date(instant);
  } catch {
    return new Date(year, month - 1, date, hour);
  }
}

/** Project an actual daily class window for ongoing courses, not a fake timed
 * booking for passive book reading or overnight auto-study.
 */
export function projectUniversityClasses(
  date: Date,
  rows: UniversityClassRow[],
  activities: ScheduledActivity[],
  userId: string,
  profileId: string,
  campusTimeZones: Record<string, string> = {},
): ScheduledActivity[] {
  const dayStart = startOfDay(date).getTime();
  const dayEnd = addDays(startOfDay(date), 1).getTime();
  const manuallyBooked = activities.filter((activity) => activity.activity_type === "university");
  const projected: ScheduledActivity[] = [];

  // A campus class close to midnight may appear on the neighbouring local day.
  for (const offset of [-1, 0, 1]) {
    const campusDay = format(addDays(date, offset), "yyyy-MM-dd");
    for (const row of rows) {
      if (!["enrolled", "in_progress"].includes(row.status ?? "")) continue;
      if (!row.enrolled_at || campusDay < row.enrolled_at.slice(0, 10) ||
          (row.scheduled_end_date && campusDay > row.scheduled_end_date.slice(0, 10))) continue;
      const course = row.university_courses;
      if (!course) continue;
      const startHour = Math.min(23, Math.max(0, Number(course.class_start_hour ?? 10)));
      const endHour = Math.min(24, Math.max(startHour + 1, Number(course.class_end_hour ?? 14)));
      if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) continue;
      const timezone = row.universities?.city ? campusTimeZones[row.universities.city] : undefined;
      const start = campusTime(campusDay, startHour, timezone);
      const end = campusTime(campusDay, endHour, timezone);
      if (!(start.getTime() < dayEnd && end.getTime() > dayStart)) continue;
      if (manuallyBooked.some((booking) => Date.parse(booking.scheduled_start) < end.getTime() &&
        Date.parse(booking.scheduled_end) > start.getTime())) continue;
      projected.push({
        id: `university_class_${row.id}_${campusDay}`,
        user_id: userId,
        profile_id: profileId,
        activity_type: "university",
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        status: "scheduled",
        title: `University: ${course.name || "Class"}`,
        location: row.universities?.name ?? undefined,
        description: timezone ? `Daily class · ${timezone}` : "Daily class",
        metadata: { enrollment_id: row.id, campus_day: campusDay, campus_timezone: timezone, projected_enrollment: true },
      });
    }
  }
  return projected;
}
