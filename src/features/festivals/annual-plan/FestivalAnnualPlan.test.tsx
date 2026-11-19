import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FestivalAnnualPlan as AnnualPlan } from "./model";
import { getFestivalAnnualPlan } from "./repository";
import { FestivalAnnualPlan } from "./FestivalAnnualPlan";

vi.mock("./repository", () => ({
  festivalAnnualPlanQueryKey: (companyId: string, editionId: string) => ["annual-plan", companyId, editionId],
  getFestivalAnnualPlan: vi.fn(),
  saveFestivalAnnualPlan: vi.fn(),
}));

const plan: AnnualPlan = {
  festivalCompanyId: "22222222-2222-4222-8222-222222222222",
  festivalEditionId: "33333333-3333-4333-8333-333333333333",
  editionYear: 2030,
  name: "Owner Festival",
  status: "draft",
  editable: true,
  version: 3,
  startsOn: "2030-06-10",
  endsOn: "2030-06-11",
  preferredMonth: 6,
  city: null,
  currencyCode: "GBP",
  siteType: "outdoor",
  festivalScale: "local",
  durationDays: 2,
  vibe: "community",
  environmentalPolicy: "green",
  marketingEmphasis: "community",
  expectedCapacity: 1000,
  estimatedOperatingCostMinor: 500000,
  planningStatus: "ready",
  readinessScore: 100,
  planningEffects: {},
  blockers: [
    { code: "festival_city_required", message: "Choose the Festival city." },
    { code: "festival_licence_capacity_exceeded", message: "The selected scale exceeds the active Festival licence capacity." },
  ],
  canWrite: true,
  updatedAt: null,
  cities: [{ id: "44444444-4444-4444-8444-444444444444", name: "London", country: "United Kingdom", timezone: "Europe/London" }],
  scales: [{ key: "local", displayName: "Local", description: "", minimumCapacity: 100, maximumCapacity: 2000, maximumDurationDays: 3, complexity: "small" }],
  siteTypes: [{ key: "outdoor", displayName: "Outdoor", description: "" }],
  vibes: [{ key: "community", displayName: "Community", description: "" }],
  environmentalPolicies: [{ key: "green", displayName: "Green", description: "" }],
  marketingEmphases: [{ key: "community", displayName: "Community", description: "", demandBasisPoints: 10000, costBasisPoints: 10000, reputationBasisPoints: 10000, localArtistBasisPoints: 5000 }],
};

const renderPlan = (override: Partial<AnnualPlan> = {}) => {
  vi.mocked(getFestivalAnnualPlan).mockResolvedValue({ ...plan, ...override });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FestivalAnnualPlan festivalCompanyId={plan.festivalCompanyId} editionId={plan.festivalEditionId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
};

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  vi.clearAllMocks();
});

describe("annual Festival readiness checklist", () => {
  it("shows canonical blockers even if a stale score says 100%, and opens the right form", async () => {
    const { client } = renderPlan();
    try {
      expect(await screen.findByText("Choose the Festival city.")).toBeInTheDocument();
      expect(screen.getByText(/100% · Action required/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Choose city" }));
      expect(screen.getByLabelText("Start date")).toBeInTheDocument();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      expect(screen.getByRole("link", { name: "Review capacity licence" })).toHaveAttribute(
        "href", `/festival-company/${plan.festivalCompanyId}/upgrades`,
      );
    } finally { client.clear(); }
  });

  it("does not offer disabled editing controls on a locked edition", async () => {
    const { client } = renderPlan({ editable: false, canWrite: false });
    try {
      expect(await screen.findByText("Choose the Festival city.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Choose city" })).toBeDisabled();
      expect(screen.getByText(/planning choices are locked/i)).toBeInTheDocument();
    } finally { client.clear(); }
  });
});
