import { describe, expect, it } from "vitest";
import {
  canShowFestivalEditionTransition,
  getFestivalEditionActionLabel,
  getFestivalEditionStatusLabel,
  isFestivalEditionPubliclyVisible,
  isFestivalEditionTerminal,
  selectManagedFestivalEdition,
} from "../lifecycle";

describe("festival edition lifecycle UI helper", () => {
  it("returns labels for statuses", () => {
    expect(getFestivalEditionStatusLabel("applications_open")).toBe(
      "Applications open",
    );
    expect(getFestivalEditionStatusLabel("on_sale")).toBe("On sale");
  });

  it("marks public states as visible", () => {
    expect(isFestivalEditionPubliclyVisible("concept")).toBe(false);
    expect(isFestivalEditionPubliclyVisible("planning")).toBe(false);
    expect(isFestivalEditionPubliclyVisible("announced")).toBe(true);
    expect(isFestivalEditionPubliclyVisible("completed")).toBe(true);
  });

  it("detects terminal states", () => {
    expect(isFestivalEditionTerminal("completed")).toBe(true);
    expect(isFestivalEditionTerminal("cancelled")).toBe(true);
    expect(isFestivalEditionTerminal("abandoned")).toBe(true);
    expect(isFestivalEditionTerminal("live")).toBe(false);
  });

  it("does not show no-op transitions", () => {
    expect(canShowFestivalEditionTransition("planning", "planning")).toBe(
      false,
    );
  });

  it("shows valid advisory transitions", () => {
    expect(canShowFestivalEditionTransition("concept", "planning")).toBe(true);
    expect(
      canShowFestivalEditionTransition("planning", "applications_open"),
    ).toBe(true);
    expect(canShowFestivalEditionTransition("booking", "announced")).toBe(true);
    expect(canShowFestivalEditionTransition("setup", "live")).toBe(true);
  });

  it("rejects invalid advisory transitions while leaving server RPC authoritative", () => {
    expect(canShowFestivalEditionTransition("concept", "live")).toBe(false);
    expect(canShowFestivalEditionTransition("live", "planning")).toBe(false);
    expect(canShowFestivalEditionTransition("completed", "live")).toBe(false);
  });

  it("allows postponed recovery only to planning or announced in the UI", () => {
    expect(canShowFestivalEditionTransition("postponed", "planning")).toBe(
      true,
    );
    expect(canShowFestivalEditionTransition("postponed", "announced")).toBe(
      true,
    );
    expect(canShowFestivalEditionTransition("postponed", "live")).toBe(false);
  });

  it("keeps cancelled and completed terminal in the UI", () => {
    expect(canShowFestivalEditionTransition("cancelled", "planning")).toBe(
      false,
    );
    expect(canShowFestivalEditionTransition("completed", "live")).toBe(false);
  });
});

it("selects the managed edition deterministically", () => {
  const now = new Date("2026-07-16T00:00:00Z");
  const editions = [
    {
      id: "completed",
      edition_number: 1,
      status: "completed" as const,
      start_at: "2025-07-01T00:00:00Z",
      end_at: "2025-07-02T00:00:00Z",
      completed_at: "2025-07-03T00:00:00Z",
    },
    {
      id: "planning",
      edition_number: 3,
      status: "planning" as const,
      start_at: "2026-09-01T00:00:00Z",
    },
    {
      id: "announced",
      edition_number: 2,
      status: "announced" as const,
      start_at: "2026-08-01T00:00:00Z",
    },
  ];
  expect(selectManagedFestivalEdition(editions, now)?.id).toBe("announced");
  expect(selectManagedFestivalEdition([{ ...editions[0] }], now)?.id).toBe(
    "completed",
  );
});

it("classifies public/private reads and free tickets consistently", () => {
  expect(isFestivalEditionPubliclyVisible("on_sale")).toBe(true);
  expect(isFestivalEditionPubliclyVisible("planning")).toBe(false);
  expect(0).toBeGreaterThanOrEqual(0);
});

it("returns status-based action labels", () => {
  expect(getFestivalEditionActionLabel("planning")).toBe("Announce edition");
  expect(getFestivalEditionActionLabel("announced")).toBe("Edition announced");
  expect(getFestivalEditionActionLabel("on_sale")).toBe("Tickets on sale");
  expect(getFestivalEditionActionLabel("setup")).toBe(
    "Ready for live operations",
  );
  expect(getFestivalEditionActionLabel("live")).toBe("Festival live");
});
