import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FestivalPublicConfirmedAct } from "../domain/festivalLaunch";
import { FestivalPublishedTimetable } from "./FestivalPublishedTimetable";

const first: FestivalPublicConfirmedAct = {
  id: "band-1", artistName: "The Band", artistType: "band", genre: null,
  billingPosition: "headliner", festivalDate: "2026-10-30",
  stageName: "Main Stage",
  startsAt: "2026-10-30T10:00:00Z",
  endsAt: "2026-10-30T11:00:00Z",
};
const now = Date.parse("2026-10-30T10:30:00Z");

describe("cancelled festival visitor timetable", () => {
  it("preserves archived acts but never advertises the cancelled set as scheduled now", () => {
    render(<FestivalPublishedTimetable performances={[first]} timezone="Europe/London" now={now} cancelled />);
    expect(screen.getByText("The Band")).toBeTruthy();
    expect(screen.getByText(/This edition was cancelled/)).toBeTruthy();
    expect(screen.getByText("Cancelled edition · archived programme")).toBeTruthy();
    expect(screen.queryByText("Scheduled now · not live confirmed")).toBeNull();
    expect(screen.queryByLabelText("Show sets still in progress or upcoming")).toBeNull();
  });

  it("shows the normal schedule-only NOW badge for noncancelled editions", () => {
    render(<FestivalPublishedTimetable performances={[first]} timezone="Europe/London" now={now} cancelled={false} />);
    expect(screen.getByText("Scheduled now · not live confirmed")).toBeTruthy();
    expect(screen.queryByText("Cancelled edition · archived programme")).toBeNull();
  });
});
