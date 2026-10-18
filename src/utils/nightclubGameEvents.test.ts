import { describe, expect, it, vi } from "vitest";
import {
  currentNightclubEvent,
  gameDateIso,
  gameWeekday,
  type MatchableNightclubEvent,
} from "./nightclubGameEvents";

type Event = MatchableNightclubEvent & { id: string };
const date = { gameYear: 1, gameMonth: 1, gameDay: 1 };
const event = (id: string, overrides: Partial<Event> = {}): Event => ({
  id,
  is_recurring: true,
  is_active: true,
  scheduled_date: null,
  day_of_week: 4,
  ...overrides,
});

describe("nightclub events on RockMundo's calendar", () => {
  it("advances weekly events on game days, including 30-day-month and year boundaries", () => {
    expect(gameWeekday(date)).toBe(4); // Epoch: Thursday.
    expect(gameWeekday({ ...date, gameDay: 4 })).toBe(0); // Sunday.
    expect(gameWeekday({ ...date, gameMonth: 2 })).toBe(6); // 30 days later.
    expect(gameWeekday({ ...date, gameYear: 2 })).toBe(0); // 360 days later.
  });

  it("matches the game date for one-off nights ahead of recurring nights", () => {
    const oneOff = event("special", {
      is_recurring: false, scheduled_date: "2026-01-01", day_of_week: null,
    });
    const weekly = event("weekly");
    expect(gameDateIso(date)).toBe("2026-01-01");
    expect(gameDateIso({ gameYear: 3, gameMonth: 10, gameDay: 9 })).toBe("2028-10-09");
    expect(currentNightclubEvent([weekly, oneOff], date)?.id).toBe("special");
    expect(currentNightclubEvent([weekly, oneOff], { ...date, gameDay: 8 })?.id).toBe("weekly");
  });

  it("never selects inactive events, unrelated weekdays, or invalid calendar input", () => {
    const inactive = event("disabled", { is_active: false });
    const friday = event("friday", { day_of_week: 5 });
    expect(currentNightclubEvent([inactive, friday], date)).toBeNull();
    expect(currentNightclubEvent([event("thursday")], null)).toBeNull();
    expect(currentNightclubEvent([event("thursday")], { ...date, gameDay: 31 })).toBeNull();
    expect(gameDateIso({ ...date, gameMonth: 13 })).toBeNull();
  });

  it("is unchanged by the device clock or its real-world weekday", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-18T00:00:00Z")); // Real Sunday.
      const first = currentNightclubEvent([event("thursday")], date);
      vi.setSystemTime(new Date("2026-10-21T23:50:00Z")); // Real Wednesday.
      const second = currentNightclubEvent([event("thursday")], date);
      expect(first?.id).toBe("thursday");
      expect(second?.id).toBe("thursday");
    } finally {
      vi.useRealTimers();
    }
  });
});
