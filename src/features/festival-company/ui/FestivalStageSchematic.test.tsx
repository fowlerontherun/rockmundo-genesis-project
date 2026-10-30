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

    it("retains accessible stage selection", () => {
    const onSelectStage = vi.fn();
    render(<FestivalStageSchematic {...base} onSelectStage={onSelectStage} now={Date.parse("2026-10-29T16:30:00Z")} />);
    fireEvent.click(screen.getByRole("button", { name: /Main Stage/ }));
    expect(onSelectStage).toHaveBeenCalledWith("stage-one");
  });
});
