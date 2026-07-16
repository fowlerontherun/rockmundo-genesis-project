import { describe, expect, it } from "vitest";
import {
  canShowFestivalEditionTransition,
  getFestivalEditionStatusLabel,
  isFestivalEditionPubliclyVisible,
  isFestivalEditionTerminal,
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

  it("shows valid advisory transitions", () => {
    expect(canShowFestivalEditionTransition("announced", "announced")).toBe(false);
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
