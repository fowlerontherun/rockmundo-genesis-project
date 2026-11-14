import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { FestivalGrounds } from "./FestivalGrounds";

const { publicExperience } = vi.hoisted(() => ({ publicExperience: vi.fn() }));
vi.mock("../data/festivalRuntimeRepository", () => ({
  festivalRuntimeRepository: { publicExperience },
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
    expect(screen.queryByTestId("festival-stage-illustration")).toBeNull();
    expect(screen.getByText("Checking official stage status…")).toBeVisible();
    expect(screen.getByText("Checking festival site conditions…")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Second Stage/ }));
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /Second Stage/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByTestId("festival-stage-illustration")).toHaveLength(1);

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
