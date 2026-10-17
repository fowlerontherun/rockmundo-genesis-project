import { describe, expect, it } from "vitest";
import type { ScheduledActivity } from "@/hooks/useScheduledActivities";
import { mergeCharacterTravel, projectUniversityClasses } from "../scheduleVisibility";

const userId = "user-1";
const profileId = "character-1";
const baseActivity = (overrides: Partial<ScheduledActivity>): ScheduledActivity => ({
  id: "event",
  user_id: userId,
  profile_id: profileId,
  activity_type: "reading",
  status: "scheduled",
  scheduled_start: "2026-10-17T11:00:00Z",
  scheduled_end: "2026-10-17T12:00:00Z",
  title: "Reading",
  ...overrides,
});

const journey = {
  id: "history-1",
  profile_id: profileId,
  status: "scheduled",
  scheduled_departure_time: "2026-10-17T09:00:00Z",
  departure_time: "2026-10-17T09:00:00Z",
  arrival_time: "2026-10-17T10:30:00Z",
  transport_type: "train",
  from_city: { name: "Portsmouth" },
  to_city: { name: "London" },
};

describe("character schedule travel coverage", () => {
  it("shows personal, auto-booked and concierge travel without a schedule mirror", () => {
    const result = mergeCharacterTravel([], [journey], userId, profileId);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      activity_type: "travel",
      status: "scheduled",
      title: "Travel: Portsmouth → London",
      metadata: { travel_history_id: "history-1" },
    });
  });

  it("preserves a canonical mirrored journey without a duplicate", () => {
    const scheduled = baseActivity({
      id: "schedule-1", activity_type: "travel",
      metadata: { travel_history_id: "history-1" },
    });
    expect(mergeCharacterTravel([scheduled], [journey], userId, profileId)).toEqual([scheduled]);
  });

  it("replaces a generic tour projection with its character-owned travel record", () => {
    const tourProjection = baseActivity({
      id: "tour-1", activity_type: "travel",
      metadata: { tour_travel_leg: true, tour_travel_leg_id: "leg-1" },
    });
    const result = mergeCharacterTravel(
      [tourProjection], [{ ...journey, tour_leg_id: "leg-1", status: "in_progress" }],
      userId, profileId,
    );
    expect(result).toHaveLength(1);
    expect(result[0].metadata?.travel_history_id).toBe("history-1");
    expect(result[0].status).toBe("in_progress");
  });

  it("excludes cancelled, cross-character and invalid journeys", () => {
    const result = mergeCharacterTravel([], [
      { ...journey, status: "cancelled" },
      { ...journey, id: "other", profile_id: "character-2" },
      { ...journey, id: "invalid", arrival_time: "2026-10-17T08:00:00Z" },
    ], userId, profileId);
    expect(result).toEqual([]);
  });

  it("keeps distinct booked education events unchanged", () => {
    const events = [
      baseActivity({ id: "read", activity_type: "reading" }),
      baseActivity({ id: "practice", activity_type: "skill_practice" }),
      baseActivity({ id: "class", activity_type: "university" }),
    ];
    expect(mergeCharacterTravel(events, [], userId, profileId)).toEqual(events);
  });
});

describe("university class projection", () => {
  const rows = [{
    id: "enrollment-1",
    status: "enrolled",
    enrolled_at: "2026-10-01T10:00:00Z",
    scheduled_end_date: "2026-11-01",
    university_courses: { name: "Music Theory", class_start_hour: 10, class_end_hour: 14 },
    universities: { name: "London Music University", city: "London" },
  }];
  const day = new Date(2026, 9, 17, 12);

  it("displays recurring enrolled classes at their campus-local time", () => {
    const result = projectUniversityClasses(day, rows, [], userId, profileId, {
      London: "Europe/London",
    });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("University: Music Theory");
    expect(result[0].location).toBe("London Music University");
    expect(result[0].scheduled_start).toBe("2026-10-17T09:00:00.000Z");
    expect(result[0].scheduled_end).toBe("2026-10-17T13:00:00.000Z");
  });

  it("does not double-list a university class when an explicit booking overlaps", () => {
    const booked = baseActivity({
      activity_type: "university",
      scheduled_start: "2026-10-17T10:00:00Z",
      scheduled_end: "2026-10-17T11:00:00Z",
    });
    expect(projectUniversityClasses(day, rows, [booked], userId, profileId, {
      London: "Europe/London",
    })).toHaveLength(0);
  });

  it("does not invent classes outside enrolment dates or for completed courses", () => {
    const expired = { ...rows[0], scheduled_end_date: "2026-10-16" };
    const completed = { ...rows[0], id: "completed", status: "completed" };
    expect(projectUniversityClasses(day, [expired, completed], [], userId, profileId)).toEqual([]);
  });

  it("leaves reading and practice bookings intact alongside the university class", () => {
    const reading = baseActivity({ activity_type: "reading" });
    const practice = baseActivity({ id: "practice", activity_type: "skill_practice" });
    const result = [...[reading, practice], ...projectUniversityClasses(day, rows, [reading, practice], userId, profileId)];
    expect(result.map((item) => item.activity_type)).toEqual(["reading", "skill_practice", "university"]);
  });
});
