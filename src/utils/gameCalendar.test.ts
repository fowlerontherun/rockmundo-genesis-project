import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateCharacterAgeFromAnchor, calculateInGameDate } from "./gameCalendar";

afterEach(() => {
  vi.useRealTimers();
});

describe("accelerated game calendar", () => {
  it("makes every game day reachable at the default eight-hour cadence", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(calculateInGameDate()).toMatchObject({ gameYear: 1, gameMonth: 1, gameDay: 1 });

    vi.setSystemTime(new Date("2026-01-01T08:00:00Z"));
    expect(calculateInGameDate()).toMatchObject({ gameYear: 1, gameMonth: 1, gameDay: 2 });

    vi.setSystemTime(new Date("2026-01-10T16:00:00Z"));
    expect(calculateInGameDate()).toMatchObject({ gameYear: 1, gameMonth: 1, gameDay: 30 });

    vi.setSystemTime(new Date("2026-01-11T00:00:00Z"));
    expect(calculateInGameDate()).toMatchObject({ gameYear: 1, gameMonth: 2, gameDay: 1 });
  });
});

describe("anchored character aging", () => {
  const profile = {
    age: 25,
    age_anchor_age: 25,
    age_anchor_game_year: 3,
    age_anchor_game_month: 4,
    age_anchor_game_day: 10,
    birth_game_month: 7,
    birth_game_day: 15,
  };

  it("does not age a character before their birthday", () => {
    expect(calculateCharacterAgeFromAnchor(profile, { gameYear: 3, gameMonth: 7, gameDay: 14 })).toBe(25);
  });

  it("increments age on the birthday", () => {
    expect(calculateCharacterAgeFromAnchor(profile, { gameYear: 3, gameMonth: 7, gameDay: 15 })).toBe(26);
  });

  it("only adds one year across a later game year until the next birthday", () => {
    expect(calculateCharacterAgeFromAnchor(profile, { gameYear: 4, gameMonth: 7, gameDay: 14 })).toBe(26);
    expect(calculateCharacterAgeFromAnchor(profile, { gameYear: 4, gameMonth: 7, gameDay: 15 })).toBe(27);
  });
});
