import { describe, expect, it } from "vitest";
import {
  canShowFestivalEditionTransition,
  getFestivalEditionActionLabel,
  isFestivalEditionPubliclyVisible,
  selectManagedFestivalEdition,
} from "../lifecycle";

const edition = (id: string, status: any, edition_number: number, start_at: string | null, completed_at: string | null = null) => ({
  id,
  status,
  edition_number,
  start_at,
  end_at: start_at,
  completed_at,
});

describe("managed festival edition selection", () => {
  const now = new Date("2030-01-01T00:00:00Z");

  it("prefers live before upcoming and completed editions", () => {
    const selected = selectManagedFestivalEdition([
      edition("future", "announced", 4, "2030-06-01T00:00:00Z"),
      edition("live", "live", 2, "2029-12-30T00:00:00Z"),
      edition("done", "completed", 3, "2029-01-01T00:00:00Z", "2029-01-03T00:00:00Z"),
    ], now);
    expect(selected?.id).toBe("live");
  });

  it("selects next active upcoming before planning upcoming", () => {
    const selected = selectManagedFestivalEdition([
      edition("planning", "planning", 8, "2030-03-01T00:00:00Z"),
      edition("announced", "announced", 7, "2030-04-01T00:00:00Z"),
    ], now);
    expect(selected?.id).toBe("announced");
  });

  it("falls back to most recent completed then latest edition number", () => {
    expect(selectManagedFestivalEdition([
      edition("old", "completed", 1, "2027-01-01T00:00:00Z", "2027-01-02T00:00:00Z"),
      edition("new", "completed", 2, "2028-01-01T00:00:00Z", "2028-01-02T00:00:00Z"),
    ], now)?.id).toBe("new");
    expect(selectManagedFestivalEdition([
      edition("cancelled", "cancelled", 3, null),
      edition("abandoned", "abandoned", 4, null),
    ], now)?.id).toBe("abandoned");
  });
});

describe("festival edition UI classifications", () => {
  it("does not present no-op transitions as actionable", () => {
    expect(canShowFestivalEditionTransition("announced", "announced")).toBe(false);
  });

  it("keeps terminal states closed", () => {
    expect(canShowFestivalEditionTransition("completed", "live")).toBe(false);
    expect(canShowFestivalEditionTransition("cancelled", "planning")).toBe(false);
  });

  it("classifies public/private read statuses", () => {
    expect(isFestivalEditionPubliclyVisible("planning")).toBe(false);
    expect(isFestivalEditionPubliclyVisible("on_sale")).toBe(true);
  });

  it("labels owner action states", () => {
    expect(getFestivalEditionActionLabel("planning")).toBe("Announce edition");
    expect(getFestivalEditionActionLabel("announced")).toBe("Edition announced");
    expect(getFestivalEditionActionLabel("on_sale")).toBe("Tickets on sale");
    expect(getFestivalEditionActionLabel("setup")).toBe("Ready for live operations");
    expect(getFestivalEditionActionLabel("live")).toBe("Festival live");
  });
});
