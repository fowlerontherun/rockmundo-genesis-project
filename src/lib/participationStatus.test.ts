import { describe, expect, it } from "vitest";
import { getGigLineupStatusDisplay, getRehearsalParticipantStatusDisplay } from "./participationStatus";

describe("participation status mappings", () => {
  it("maps rehearsal statuses", () => {
    expect(getRehearsalParticipantStatusDisplay("invited")).toMatchObject({ label: "Expected", final: false, selfResponseAvailable: true });
    expect(getRehearsalParticipantStatusDisplay("confirmed")).toMatchObject({ label: "Confirmed", final: false, selfResponseAvailable: true });
    expect(getRehearsalParticipantStatusDisplay("declined")).toMatchObject({ label: "Declined", final: false, selfResponseAvailable: true });
    expect(getRehearsalParticipantStatusDisplay("attended")).toMatchObject({ label: "Attended", final: true, selfResponseAvailable: false });
    expect(getRehearsalParticipantStatusDisplay("missed")).toMatchObject({ label: "Missed", final: true });
  });

  it("maps gig statuses", () => {
    expect(getGigLineupStatusDisplay("selected")).toMatchObject({ label: "Selected", final: false });
    expect(getGigLineupStatusDisplay("performed")).toMatchObject({ label: "Performed", final: true });
    expect(getGigLineupStatusDisplay("missed")).toMatchObject({ label: "Missed", final: true });
  });

  it("returns a safe fallback for unsupported values", () => {
    expect(getRehearsalParticipantStatusDisplay("future")).toMatchObject({ label: "Status unavailable", semantic: "unknown" });
    expect(getGigLineupStatusDisplay(undefined)).toMatchObject({ label: "Status unavailable", semantic: "unknown" });
  });
});
