import { describe, expect, it } from "vitest";
import { getRehearsalRsvpDeadline, isRehearsalRsvpOpen } from "./rehearsalRsvp";

describe("rehearsal RSVP helpers", () => {
  it("uses a one hour deadline before rehearsal start", () => {
    expect(getRehearsalRsvpDeadline("2026-07-11T20:00:00.000Z").toISOString()).toBe("2026-07-11T19:00:00.000Z");
  });

  it("allows provisional scheduled responses before the deadline", () => {
    expect(isRehearsalRsvpOpen("scheduled", "invited", "2026-07-11T20:00:00.000Z", new Date("2026-07-11T18:59:00.000Z"))).toBe(true);
    expect(isRehearsalRsvpOpen("scheduled", "confirmed", "2026-07-11T20:00:00.000Z", new Date("2026-07-11T18:59:00.000Z"))).toBe(true);
    expect(isRehearsalRsvpOpen("scheduled", "declined", "2026-07-11T20:00:00.000Z", new Date("2026-07-11T18:59:00.000Z"))).toBe(true);
  });

  it("locks final statuses, non-scheduled rehearsals, and late responses", () => {
    expect(isRehearsalRsvpOpen("scheduled", "attended", "2026-07-11T20:00:00.000Z", new Date("2026-07-11T18:59:00.000Z"))).toBe(false);
    expect(isRehearsalRsvpOpen("cancelled", "invited", "2026-07-11T20:00:00.000Z", new Date("2026-07-11T18:59:00.000Z"))).toBe(false);
    expect(isRehearsalRsvpOpen("scheduled", "invited", "2026-07-11T20:00:00.000Z", new Date("2026-07-11T19:00:00.000Z"))).toBe(false);
  });
});
