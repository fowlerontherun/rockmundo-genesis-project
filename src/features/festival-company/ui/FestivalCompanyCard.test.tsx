import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FestivalCompanyEdition } from "@/features/festivals/editions/repository";
import { FestivalCompanyCard } from "./FestivalCompanyCard";

const {
  useQuery,
  useFestivalArtistProgramme,
  useFestivalTicketPlan,
  navigate,
} = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useFestivalArtistProgramme: vi.fn(),
  useFestivalTicketPlan: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({ useQuery }));
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../application/useFestivalArtistProgramme", () => ({
  useFestivalArtistProgramme,
}));
vi.mock("../application/useFestivalTicketPlan", () => ({
  useFestivalTicketPlan,
}));

const festival = {
  festivalCompanyId: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  publicName: "Shock Festival",
  legalCompanyName: "Shock Festival Ltd",
  setupStatus: "complete",
  setupCompleted: true,
  configurationComplete: true,
  firstEditionExists: true,
  companyBalance: 250000,
  managementEnabled: true,
};

const currentEdition: FestivalCompanyEdition = {
  festivalEditionId: "33333333-3333-4333-8333-333333333333",
  editionYear: 2026,
  name: "Shock Festival 2026",
  status: "draft",
  startsOn: "2026-09-26",
  endsOn: "2026-09-27",
  preferredMonth: 9,
  countryCode: "GB",
  cityId: "44444444-4444-4444-8444-444444444444",
  vibe: "mainstream",
  siteType: "outdoor",
  durationDays: 2,
  environmentalPolicy: "responsible",
  festivalScale: "small",
  marketingEmphasis: "balanced",
  expectedCapacity: 5000,
  estimatedOperatingCostMinor: 1000000,
  planningStatus: "ready",
  readinessScore: 100,
  version: 1,
  lockedAt: null,
  creationSource: "company",
  editable: true,
  planBindings: {
    configuration: true,
    site: true,
    tickets: true,
    artists: true,
    operations: true,
    sponsorship: true,
    timetable: true,
  },
};

function mockEdition(edition: FestivalCompanyEdition = currentEdition) {
  useQuery.mockReturnValue({
    data: {
      festivalCompanyId: festival.festivalCompanyId,
      publicName: festival.publicName,
      companyStatus: "active",
      setupCompleted: true,
      canPlanNext: true,
      currentGameYear: 2026,
      editions: [edition],
    },
    isLoading: false,
    isError: false,
  });
}

describe("FestivalCompanyCard owner next action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEdition();
    useFestivalArtistProgramme.mockReturnValue({
      data: { ready: false },
      isLoading: false,
      isError: false,
    });
    useFestivalTicketPlan.mockReturnValue({
      data: { ready: false },
      isLoading: false,
      isError: false,
    });
  });

  it("keeps an unfinished annual plan on Plan", () => {
    mockEdition({
      ...currentEdition,
      planningStatus: "in_progress",
      readinessScore: 50,
    });

    render(<FestivalCompanyCard festival={festival} />);

    expect(screen.getByRole("button", { name: "Continue Plan" })).toBeInTheDocument();
    expect(screen.getByText(/finish the 2026 Festival plan/i)).toBeInTheDocument();
  });

  it("moves a ready annual plan to Line-up when artist planning is unfinished", () => {
    render(<FestivalCompanyCard festival={festival} />);

    expect(
      screen.getByRole("button", { name: "Continue Line-up" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/finish the 2026 line-up/i)).toBeInTheDocument();
  });

  it("moves to Tickets & budget only after Line-up is ready", () => {
    useFestivalArtistProgramme.mockReturnValue({
      data: { ready: true },
      isLoading: false,
      isError: false,
    });

    render(<FestivalCompanyCard festival={festival} />);

    expect(
      screen.getByRole("button", { name: "Set tickets & budget" }),
    ).toBeInTheDocument();
  });

  it("moves to Run Festival only when Plan, Line-up and Tickets are ready", () => {
    useFestivalArtistProgramme.mockReturnValue({
      data: { ready: true },
      isLoading: false,
      isError: false,
    });
    useFestivalTicketPlan.mockReturnValue({
      data: { ready: true },
      isLoading: false,
      isError: false,
    });

    render(<FestivalCompanyCard festival={festival} />);

    expect(screen.getByRole("button", { name: "Run Festival" })).toBeInTheDocument();
    expect(screen.getByText(/planning, line-up and tickets are ready/i)).toBeInTheDocument();
  });

  it("shows the Festival company balance in GBP", () => {
    render(<FestivalCompanyCard festival={festival} />);

    expect(screen.getByText("£250,000")).toBeInTheDocument();
  });
});
