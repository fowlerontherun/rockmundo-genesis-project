import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FestivalGroundsMap } from "./FestivalGroundsMap";

const stages = [
  { id: "stage-a", name: "Main Stage", capacity: 6000 },
  { id: "stage-b", name: "Acoustic Garden", capacity: 250 },
];

const base = {
  stages,
  selectedStageId: "stage-a",
  onSelectStage: vi.fn(),
  visitorInformation: { travel: "Shuttle from the station.", camping: null, foodAndDrink: "Published food stalls.", accessibility: null },
};

describe("interactive illustrated Festival grounds", () => {
  it("uses only edition-projected stages and published facility notes as map hotspots", () => {
    render(<FestivalGroundsMap {...base} />);
    const map = screen.getByTestId("festival-svg-grounds");
    expect(within(map).getByRole("button", { name: /Explore Main Stage, 6,000 capacity/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(map).getByRole("button", { name: /Explore Acoustic Garden, 250 capacity/ })).toBeInTheDocument();
    expect(within(map).getByRole("button", { name: /Unconfirmed Camping/ })).toBeInTheDocument();
    expect(within(map).getByRole("button", { name: /Restricted Backstage/ })).toBeInTheDocument();
    expect(screen.getByText(/not a walking map/i)).toBeInTheDocument();
    fireEvent.click(within(map).getByRole("button", { name: /Published Arrival & travel information/ }));
    expect(screen.getByText("Shuttle from the station.")).toBeInTheDocument();
    fireEvent.click(within(map).getByRole("button", { name: /Restricted Backstage/ }));
    expect(screen.getByText(/never displays private access routes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hospitality · unconfirmed" }));
    expect(screen.getByText(/Hospitality availability and location have not been confirmed/)).toBeInTheDocument();
  });

  it("supports pointer and keyboard stage selection using stable stage IDs", () => {
    const onSelectStage = vi.fn();
    render(<FestivalGroundsMap {...base} onSelectStage={onSelectStage} />);
    const stage = within(screen.getByTestId("festival-svg-grounds")).getByRole("button", { name: /Explore Acoustic Garden/ });
    fireEvent.click(stage);
    fireEvent.keyDown(stage, { key: "Enter" });
    fireEvent.keyDown(stage, { key: " " });
    expect(onSelectStage).toHaveBeenCalledTimes(3);
    expect(onSelectStage).toHaveBeenNthCalledWith(1, "stage-b");
    expect(onSelectStage).toHaveBeenNthCalledWith(2, "stage-b");
  });

  it("does not invent crowd bands or facility information when the server provides none", () => {
    render(<FestivalGroundsMap {...base} visitorInformation={{ travel: null, camping: null, foodAndDrink: null, accessibility: null }} />);
    expect(screen.getAllByText("Crowd not reported")).toHaveLength(2);
    expect(screen.getByText(/No verified facility information has been published/)).toBeInTheDocument();
    expect(screen.queryByText(/Near capacity/)).toBeNull();
  });

  it("renders only supplied, verified per-stage crowd bands without headcounts", () => {
    const snapshot = { stageId: "stage-b", stageName: "Acoustic Garden", crowdBand: "busy" as const, mood: "engaged" as const, festivalDate: "2030-06-10", lastCalculatedAt: "2030-06-10T15:00:00Z" };
    render(<FestivalGroundsMap {...base} stageCrowds={[snapshot]} localHour={22} weatherState="light_rain" />);
    expect(screen.getByText("Crowd: Busy")).toBeInTheDocument();
    expect(screen.getByText(/Runtime weather: light rain/)).toBeInTheDocument();
    expect(screen.getByText(/Night colours reflect/)).toBeInTheDocument();
    expect(screen.queryByText("250 people onsite")).toBeNull();
  });
});
