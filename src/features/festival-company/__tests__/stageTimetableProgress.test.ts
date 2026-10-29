import { describe, expect, it } from "vitest";
import type { FestivalPublicConfirmedAct } from "../domain/festivalLaunch";
import { stageTimetableProgress } from "../domain/stageTimetableProgress";

const act = (id: string, stageName: string, start: string, end: string): FestivalPublicConfirmedAct => ({
  id, artistName: id, artistType: "band", genre: null,
  billingPosition: "support", festivalDate: "2026-10-29",
  stageName, startsAt: start, endsAt: end,
});
const start = "2026-10-29T17:00:00Z";
const end = "2026-10-29T18:00:00Z";

describe("published festival stage timetable", () => {
  it("shows a future scheduled act and never claims it is live", () => {
    const res = stageTimetableProgress("Main Stage", [act("The Band", "Main Stage", start, end)], Date.parse("2026-10-29T16:59:59Z"));
    expect(res).toMatchObject({ kind: "next", act: { artistName: "The Band" }, progressPercent: null });
  });

  it("shows schedule-only set progress within the start/end boundaries", () => {
    const list = [act("The Band", "Main Stage", start, end)];
    expect(stageTimetableProgress("Main Stage", list, Date.parse(start))).toMatchObject({ kind: "scheduled_now", progressPercent: 0 });
    expect(stageTimetableProgress("Main Stage", list, Date.parse("2026-10-29T17:30:00Z"))).toMatchObject({ kind: "scheduled_now", progressPercent: 50 });
    expect(stageTimetableProgress("Main Stage", list, Date.parse(end)).kind).toBe("finished");
  });

  it("selects the next scheduled set between performances and sorts by start", () => {
    const list = [
      act("Later", "Main Stage", "2026-10-29T20:00:00Z", "2026-10-29T21:00:00Z"),
      act("Earlier", "Main Stage", start, end),
    ];
    expect(stageTimetableProgress(" main stage ", list, Date.parse("2026-10-29T18:30:00Z")).act?.artistName).toBe("Later");
  });

  it("does not allow one stage to consume another stage's programme", () => {
    const res = stageTimetableProgress("Second Stage", [act("Main Band", "Main Stage", start, end)], Date.parse(start));
    expect(res).toEqual({ kind: "unpublished", act: null, progressPercent: null });
  });

  it("rejects missing, invalid and reversed timestamps rather than advertising a set", () => {
    const list = [
      act("Bad", "Main Stage", "not-a-date", end),
      act("Reversed", "Main Stage", end, start),
      { ...act("Missing", "Main Stage", start, end), endsAt: null },
    ];
    expect(stageTimetableProgress("Main Stage", list, Date.parse(start)).kind).toBe("unpublished");
  });

  it("never mutates the official published order", () => {
    const list = [
      act("Later", "Main Stage", "2026-10-29T20:00:00Z", "2026-10-29T21:00:00Z"),
      act("Earlier", "Main Stage", start, end),
    ];
    stageTimetableProgress("Main Stage", list, Date.parse(start));
    expect(list.map((item) => item.artistName)).toEqual(["Later", "Earlier"]);
  });

  it("treats all past performances as finished and invalid current times as unpublished", () => {
    const list = [act("Old", "Main Stage", start, end)];
    expect(stageTimetableProgress("Main Stage", list, Date.parse("2026-11-01T10:00:00Z")).kind).toBe("finished");
    expect(stageTimetableProgress("Main Stage", list, Number.NaN).kind).toBe("unpublished");
  });
});
