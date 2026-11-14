import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { FestivalGrounds } from "./FestivalGrounds";

const { publicExperience } = vi.hoisted(() => ({ publicExperience: vi.fn() }));
vi.mock("../data/festivalRuntimeRepository", () => ({
  festivalRuntimeRepository: { publicExperience },
}));

vi.mock("./FestivalOutdoorStage", () => ({
  default: ({ artist, crowdBand, stageName }: { artist?: string; crowdBand?: string; stageName: string }) =>
    <div data-testid="outdoor-view">{[stageName, artist, crowdBand].filter(Boolean).join(" · ")}</div>,
}));

it("keeps the lightweight directory usable during loading, failure and retry", async () => {
  const client = new QueryClient();
  const stage = { id: "main", name: "Main Stage", capacity: 5000 };
  const onViewTimetable = vi.fn();
  let rejectRuntime!: (reason: Error) => void;
  let resolveRetry!: (result: null) => void;
  publicExperience.mockReset()
    .mockImplementationOnce(() => new Promise((_, reject) => { rejectRuntime = reject; }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve; }));
  const matchMedia = vi.fn().mockReturnValue({ matches: true });
  vi.stubGlobal("matchMedia", matchMedia);
  const view = render(
    <QueryClientProvider client={client}>
      <FestivalGrounds slug="festival" festivalLaunchId="launch" festivalEditionId="edition"
        cancelled={false} stages={[stage, { ...stage, id: "second", name: "Second Stage" }]}
        lineup={[]} timezone="Europe/London"
        visitorInformation={{ travel: null, camping: null, accessibility: null, foodAndDrink: null }}
        onViewTimetable={onViewTimetable} />
    </QueryClientProvider>,
  );
  try {
    const toggle = screen.getByRole("checkbox", { name: "Lightweight stage view" });
    expect(toggle).toBeChecked();
    expect(screen.queryByRole("button", { name: "Open 3D stage" })).toBeNull();
    expect(screen.queryByTestId("festival-stage-illustration")).toBeNull();
    expect(screen.getByText("Checking official stage status…")).toBeVisible();
    expect(screen.getByText("Checking festival site conditions…")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Second Stage/ }));
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Second Stage/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("festival-stage-illustration")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Open 3D stage" }));
    expect(await screen.findByTestId("outdoor-view")).toHaveTextContent(/^Second Stage$/);
    fireEvent.click(screen.getByRole("button", { name: /Main Stage/ }));
    expect(screen.queryByTestId("outdoor-view")).toBeNull();

    await act(async () => rejectRuntime(new Error("festival_public_runtime_not_deployed")));
    expect(await screen.findByText(/Official live updates are unavailable/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "View full timetable" }));
    expect(onViewTimetable).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Retry live festival updates" }));
    expect(await screen.findByRole("button", { name: "Retrying live festival updates…" })).toBeDisabled();
    await act(async () => resolveRetry(null));
    expect(await screen.findByText("No verified live status for this edition.")).toBeVisible();
    expect(publicExperience).toHaveBeenCalledTimes(2);
  } finally {
    view.unmount();
    client.clear();
    vi.unstubAllGlobals();
  }
});

it("passes live artist and crowd only from the selected edition's fresh snapshot", async () => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  const client = new QueryClient();
  const launch = "00000000-0000-4000-8000-000000000001";
  const performance = "00000000-0000-4000-8000-000000000002";
  const now = new Date().toISOString();
  publicExperience.mockReset().mockResolvedValue({
    festivalLaunchId: launch, editionId: "edition", runtimeStatus: "live", gatesStatus: "open",
    currentDay: now.slice(0, 10), updatedAt: now, attendanceBand: "busy", messages: [],
    performances: [{ id: performance, artistName: "Shockmaster", stageName: "Main Stage",
      status: "live", delayMinutes: 0, scheduledStart: null, scheduledEnd: null }],
    stageCrowds: [{ stageId: "runtime-main", stageName: "Main Stage", crowdBand: "busy",
      mood: "engaged", festivalDate: now.slice(0, 10), lastCalculatedAt: now }],
  });
  const grounds = (editionId: string) => (
    <QueryClientProvider client={client}>
      <FestivalGrounds slug="festival" festivalLaunchId={launch} festivalEditionId={editionId}
        cancelled={false} stages={[{ id: "public-main", name: "Main Stage", capacity: 5000 }]}
        lineup={[]} timezone="Europe/London"
        visitorInformation={{ travel: null, camping: null, accessibility: null, foodAndDrink: null }}
        onViewTimetable={() => {}} />
    </QueryClientProvider>
  );
  const view = render(grounds("edition"));
  try {
    const lightweight = screen.getByRole("checkbox", { name: "Lightweight stage view" });
    if ((lightweight as HTMLInputElement).checked) fireEvent.click(lightweight);
    expect(await screen.findByText("Confirmed stage activity")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open 3D stage" }));
    expect(await screen.findByTestId("outdoor-view")).toHaveTextContent("Main Stage · Shockmaster · busy");

    view.rerender(grounds("other-edition"));
    expect(screen.queryByTestId("outdoor-view")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open 3D stage" }));
    expect(await screen.findByTestId("outdoor-view")).toHaveTextContent(/^Main Stage$/);
  } finally {
    view.unmount();
    client.clear();
    vi.unstubAllGlobals();
  }
});
