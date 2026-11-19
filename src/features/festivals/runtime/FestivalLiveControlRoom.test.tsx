import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FestivalRuntimeProjection } from "./model";
import {
  getCanonicalLiveDayAvailability,
  getEditionRuntime,
  getFestivalRunReadiness,
} from "./service";
import { FestivalLiveControlRoom } from "./FestivalLiveControlRoom";

vi.mock("./service", () => ({
  getEditionRuntime: vi.fn(),
  getCanonicalLiveDayAvailability: vi.fn(),
  getFestivalRunReadiness: vi.fn(),
  startCanonicalFestivalLiveDay: vi.fn(),
  runSimplifiedFestival: vi.fn(),
}));

vi.mock("./CanonicalLiveDayOperations", () => ({
  CanonicalLiveDayOperations: ({ canAllocate }: { canAllocate: boolean }) => (
    <div data-testid="owner-operations">Live operating controls · allocate {String(canAllocate)}</div>
  ),
}));

vi.mock("./CanonicalStageControl", () => ({
  CanonicalStageControl: () => <div>Verified stage confirmations</div>,
}));

const liveRuntime: FestivalRuntimeProjection = {
  runtimeId: "11111111-1111-4111-8111-111111111111",
  festivalCompanyId: "22222222-2222-4222-8222-222222222222",
  editionId: "33333333-3333-4333-8333-333333333333",
  currencyCode: "GBP",
  state: "live",
  version: 5,
  simulatedTime: "2030-06-10T15:00:00.000Z",
  gates: { status: "open", queueSize: 22, waitMinutes: 6 },
  attendance: { expected: 1100, admitted: 700, onsite: 650, departed: 50, capacity: 900 },
  weather: { condition: "clear", temperatureC: 21, warning: null },
  readiness: { staff: { ready: 3, total: 3 }, suppliers: { ready: 2, total: 2 }, sponsors: { ready: 1, total: 1 } },
  stages: [{ id: "main", name: "Main Stage", status: "scheduled", currentArtist: "The Comets", nextArtist: "The Dust", delayMinutes: 0, artistReady: true }],
  incidents: [{ id: "i1", category: "crowd", severity: "high", status: "open", location: "Main Stage", summary: "Queue building" }],
  sales: { foodAndDrinkMinor: 35000, merchandiseMinor: 12000 },
  satisfaction: { audience: 83, artist: 91 },
  blockers: [],
  recentEvents: [],
  permissions: { role: "owner", actions: ["read", "operate"] },
};

const createView = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={client}>
      <FestivalLiveControlRoom companyId={liveRuntime.festivalCompanyId} editionId={liveRuntime.editionId} />
    </QueryClientProvider>,
  );
  return { ...result, client };
};

beforeEach(() => {
  vi.mocked(getEditionRuntime).mockResolvedValue(liveRuntime);
  vi.mocked(getCanonicalLiveDayAvailability).mockResolvedValue({ canOpen: false, managed: true, canAllocate: true });
  vi.mocked(getFestivalRunReadiness).mockResolvedValue(null as never);
});

afterEach(() => vi.clearAllMocks());

describe("canonical Festival Day control-room permission boundaries", () => {
  it("renders role-scoped reporting and offers controls only after verification", async () => {
    const { client } = createView();
    try {
      expect(await screen.findByText("Live operating controls · allocate true")).toBeInTheDocument();
      expect(screen.getByText("Queue building")).toBeInTheDocument();
      expect(screen.getByText("The Comets")).toBeInTheDocument();
      expect(screen.getByText("£470.00")).toBeInTheDocument();
      expect(screen.getByText("6/6")).toBeInTheDocument();
      expect(screen.getByText("Verified stage confirmations")).toBeInTheDocument();
    } finally { client.clear(); }
  });

  it("shows the report but not operating controls for a noncanonical runtime", async () => {
    vi.mocked(getCanonicalLiveDayAvailability).mockResolvedValue({ canOpen: false, managed: false, canAllocate: false });
    const { client } = createView();
    try {
      expect(await screen.findByText(/no canonical live-day operating session/i)).toBeInTheDocument();
      expect(screen.getByText("Queue building")).toBeInTheDocument();
      expect(screen.queryByTestId("owner-operations")).not.toBeInTheDocument();
    } finally { client.clear(); }
  });

  it("fails closed on a permission-check error, then recovers via retry", async () => {
    vi.mocked(getCanonicalLiveDayAvailability)
      .mockRejectedValueOnce(new Error("permission check unavailable"))
      .mockResolvedValueOnce({ canOpen: false, managed: true, canAllocate: false });
    const { client } = createView();
    try {
      expect(await screen.findByText(/live operating permissions could not be verified/i)).toBeInTheDocument();
      expect(screen.queryByTestId("owner-operations")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Retry operating permissions" }));
      expect(await screen.findByText("Live operating controls · allocate false")).toBeInTheDocument();
    } finally { client.clear(); }
  });

  it("does not display stale metrics if the canonical runtime query fails", async () => {
    vi.mocked(getEditionRuntime).mockRejectedValue(new Error("runtime access denied"));
    const { client } = createView();
    try {
      expect(await screen.findByText(/no operating actions are available until it can be verified/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry Festival Day" })).toBeInTheDocument();
      expect(screen.queryByText("Queue building")).not.toBeInTheDocument();
      expect(screen.queryByTestId("owner-operations")).not.toBeInTheDocument();
    } finally { client.clear(); }
  });
});
