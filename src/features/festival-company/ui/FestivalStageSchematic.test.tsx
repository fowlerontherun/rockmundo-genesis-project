import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FestivalPublicConfirmedAct } from "../domain/festivalLaunch";
import { FestivalStageSchematic } from "./FestivalStageSchematic";

const stage = { id: "stage-one", name: "Main Stage", capacity: 5000 };
const act: FestivalPublicConfirmedAct = {
  id: "announced-artist", artistName: "Shockmaster", artistType: "band",
  genre: "Rock", billingPosition: "headliner", festivalDate: "2026-10-29",
  stageName: "Main Stage", startsAt: "2026-10-29T17:00:00Z",
  endsAt: "2026-10-29T18:00:00Z",
};
const base = {
  cancelled: false,
  stages: [stage], lineup: [act], selectedStageId: stage.id,
  timezone: "Europe/London", localHour: 17, onSelectStage: vi.fn(),
};

describe("illustrated festival stage schedule indicators", () => {
  it("shows next published set without suggesting it is live", () => {
    render(<FestivalStageSchematic {...base} now={Date.parse("2026-10-29T16:30:00Z")} />);
    expect(screen.getByText("Next scheduled set")).toBeTruthy();
    expect(screen.getByText("Shockmaster")).toBeTruthy();
    expect(screen.queryByText(/Live ·/)).toBeNull();
  });

  it("shows elapsed published time but not verified performance progress", () => {
    render(<FestivalStageSchematic {...base} now={Date.parse("2026-10-29T17:30:00Z")} />);
    expect(screen.getByText("Scheduled set (not confirmed live)")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Scheduled set time elapsed: 50 percent, not confirmed performance progress/ })).toBeTruthy();
  });

  it("prioritises runtime-confirmed live performance instead of a timetable hint", () => {
    const performances = [{
      id: "runtime-set", artistName: "Real Live Artist", stageName: "Main Stage",
      scheduledStart: "2026-10-29T17:00:00Z", scheduledEnd: "2026-10-29T18:00:00Z",
      status: "live" as const, delayMinutes: 0,
    }];
    render(<FestivalStageSchematic {...base} now={Date.parse("2026-10-29T17:30:00Z")} performances={performances} />);
    expect(screen.getByText("Live · Real Live Artist")).toBeTruthy();
    expect(screen.queryByText("Scheduled set (not confirmed live)")).toBeNull();
  });

  it.each([
    ["soundcheck", "Soundcheck"], ["changeover", "Changeover"],
    ["starting", "Starting"], ["delayed", "Delayed"], ["cancelled", "Cancelled"],
  ] as const)("shows verified %s without marking the act live", (status, label) => {
    render(<FestivalStageSchematic {...base} now={Date.parse("2026-10-29T17:30:00Z")} performances={[{
      id: "runtime-set", artistName: "Shockmaster", stageName: stage.name,
      scheduledStart: null, scheduledEnd: null, status, delayMinutes: 0,
    }]} />);
    expect(screen.getByText(label + " · Shockmaster")).toBeVisible();
    expect(screen.queryByText(/Live ·/)).toBeNull();
  });

  it("keeps the timetable fallback when a stage name is ambiguous", () => {
    render(<FestivalStageSchematic {...base} now={Date.parse("2026-10-29T17:30:00Z")}
      stages={[stage, { ...stage, id: "other-stage" }]} performances={[{
        id: "runtime-set", artistName: "Shockmaster", stageName: stage.name,
        scheduledStart: null, scheduledEnd: null, status: "soundcheck", delayMinutes: 0,
      }]} />);
    expect(screen.queryByText("Soundcheck · Shockmaster")).toBeNull();
    expect(screen.getAllByText("Scheduled set (not confirmed live)")).toHaveLength(2);
  });

  it("renders weather atmosphere without interpreting illustrated people as attendance", () => {
    const { container } = render(
      <FestivalStageSchematic
        {...base}
        now={Date.parse("2026-10-29T16:30:00Z")}
        weatherState="heavy_rain"
      />,
    );
    expect(container.querySelectorAll('[data-weather-visual="rain"]')).toHaveLength(8);
    expect(container.querySelectorAll('[data-crowd-figure="illustration"]')).toHaveLength(11);
    expect(container.querySelector('[data-testid="festival-stage-illustration"]')?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText(/People and weather artwork illustrate the atmosphere/)).toBeTruthy();
    expect(screen.getByText("Attendance not available")).toBeTruthy();
  });

  it("budgets one CSS illustration across a large directory and none in lightweight view", () => {
    const stages = Array.from({ length: 24 }, (_, index) => ({
      ...stage, id: `stage-${index}`, name: index === 0 ? stage.name : `Stage ${index}`,
    }));
    const props = { ...base, stages, selectedStageId: stages[0].id, weatherState: "storm" as const,
      now: Date.parse("2026-10-29T16:30:00Z") };
    const { container, rerender } = render(<FestivalStageSchematic {...props} />);
    expect(screen.getAllByRole("button")).toHaveLength(24);
    expect(screen.getAllByTestId("festival-stage-illustration")).toHaveLength(1);
    expect(container.querySelectorAll('[data-weather-visual="rain"]')).toHaveLength(8);
    expect(container.querySelectorAll("[data-crowd-figure]")).toHaveLength(11);
    expect(container.querySelectorAll("img, svg, canvas, video, audio, iframe, object")).toHaveLength(0);

    rerender(<FestivalStageSchematic {...props} lightweight />);
    expect(screen.queryByTestId("festival-stage-illustration")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(24);
    expect(screen.getByText("Shockmaster")).toBeVisible();
    expect(screen.getByRole("button", { name: /Main Stage/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("retains accessible stage selection", () => {
    const onSelectStage = vi.fn();
    render(<FestivalStageSchematic {...base} onSelectStage={onSelectStage} now={Date.parse("2026-10-29T16:30:00Z")} />);
    fireEvent.click(screen.getByRole("button", { name: /Main Stage/ }));
    expect(onSelectStage).toHaveBeenCalledWith("stage-one");
  });
});
