import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { usePublicFestivalLiveExperience, usePublicFestivalLiveStatus } from "./useFestivalRuntime";

const { publicExperience } = vi.hoisted(() => ({ publicExperience: vi.fn() }));
vi.mock("../data/festivalRuntimeRepository", () => ({
  festivalRuntimeRepository: { publicExperience },
}));

const liveSnapshot = (slug: string, status: "gates_open" | "runtime_complete" = "gates_open") => ({
  festivalLaunchId: slug === "alpha" ? "00000000-0000-4000-8000-000000000041" : "00000000-0000-4000-8000-000000000042",
  runtimeStatus: status, gatesStatus: status === "gates_open" ? "open" : "closed",
  currentDay: null, attendanceBand: null, performances: [], messages: [],
});

function Viewer({ slug, id }: { slug: string; id: number }) {
  const status = usePublicFestivalLiveStatus(slug);
  const experience = usePublicFestivalLiveExperience(slug);
  return <p data-testid={`viewer-${id}`}>
    {status.isError || experience.isError ? "Unavailable" :
      `${status.data?.runtimeStatus ?? "Pending"} / ${(experience.data as { runtimeStatus?: string } | null)?.runtimeStatus ?? "Pending"}`}
  </p>;
}

afterEach(() => publicExperience.mockReset());

it("shares a single authoritative request across concurrent stage/status subscribers, including refresh", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  publicExperience.mockImplementation(async (slug: string) => liveSnapshot(slug));
  const view = render(
    <QueryClientProvider client={client}>
      {Array.from({ length: 12 }, (_, id) => <Viewer key={id} slug="alpha" id={id} />)}
      <Viewer slug="beta" id={12} />
    </QueryClientProvider>,
  );
  try {
    await waitFor(() => {
      for (let id = 0; id < 12; id++) expect(screen.getByTestId(`viewer-${id}`)).toHaveTextContent("gates_open / gates_open");
      expect(screen.getByTestId("viewer-12")).toHaveTextContent("gates_open / gates_open");
    });
    expect(publicExperience).toHaveBeenCalledTimes(2); // one fetch per slug, not per hook or viewer

    publicExperience.mockImplementation(async (slug: string) => liveSnapshot(slug, "runtime_complete"));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ["festival-public-canonical-edition", "alpha"] });
    });
    await waitFor(() => {
      for (let id = 0; id < 12; id++) expect(screen.getByTestId(`viewer-${id}`)).toHaveTextContent("runtime_complete / runtime_complete");
      expect(screen.getByTestId("viewer-12")).toHaveTextContent("gates_open / gates_open");
    });
    expect(publicExperience).toHaveBeenCalledTimes(3); // exactly one refetch for 12 viewers
  } finally {
    view.unmount();
    client.clear();
  }
});
