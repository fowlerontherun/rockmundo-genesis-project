import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyCompanies from "./MyCompanies";

const useCompanies = vi.fn();
const useOwnedFestivalCompanies = vi.fn();
const refetch = vi.fn();
const refetchFestivalCompanies = vi.fn();

vi.mock("@/hooks/useCompanies", () => ({
  useCompanies,
  useCompanyFinancialSummary: () => ({ data: {}, isLoading: false }),
}));
vi.mock("@/hooks/useCompanyFinance", () => ({
  useAllCompanyTaxRecords: () => ({ data: [] }),
}));
vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ isLoading: false }),
}));
vi.mock("@/hooks/use-auth-context", () => ({
  useAuth: () => ({ loading: false }),
}));
vi.mock("@/components/company/VipGate", () => ({
  VipGate: ({ children }: any) => children,
}));
vi.mock("@/components/fm/FMPageScaffold", () => ({
  FMPageScaffold: ({ children }: any) => children,
}));
vi.mock("@/components/company/CompanyCard", () => ({
  CompanyCard: ({ company }: any) => <div>{company.name}</div>,
}));
vi.mock("@/components/company/CreateCompanyDialog", () => ({
  CreateCompanyDialog: ({ trigger }: any) =>
    trigger ?? <button>Create Company</button>,
}));
vi.mock("@/components/company/CompanySynergies", () => ({
  CompanySynergies: () => null,
}));
vi.mock("@/features/festival-company", () => ({
  FestivalCompanyCard: ({ festival }: any) => (
    <div>Festival company: {festival.publicName}</div>
  ),
  FestivalCompanyEligibilityCard: () => <div>Festival eligibility</div>,
  useOwnedFestivalCompanies,
}));

describe("My Companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/my-companies");
    useCompanies.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    });
    useOwnedFestivalCompanies.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchFestivalCompanies,
    });
  });

  it("renders existing holding companies and subsidiaries", () => {
    useCompanies.mockReturnValue({
      data: [
        {
          id: "holding-1",
          name: "Touring Holdings",
          company_type: "holding",
        },
        {
          id: "label-1",
          name: "Roadrunner Records",
          company_type: "record_label",
          parent_company_id: "holding-1",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    });

    render(<MyCompanies />);

    expect(screen.getByText("Touring Holdings")).toBeInTheDocument();
    expect(screen.getByText("Roadrunner Records")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Holding (1)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Subsidiaries (1)" }),
    ).toBeInTheDocument();
  });

  it("keeps a Festival-only owner out of the create-first-company dead end", () => {
    useOwnedFestivalCompanies.mockReturnValue({
      data: [
        {
          festivalCompanyId: "festival-1",
          publicName: "Shock Festival",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchFestivalCompanies,
    });

    render(<MyCompanies />);

    expect(screen.getByText("My Festivals")).toBeInTheDocument();
    expect(screen.getByText("Festival company: Shock Festival")).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Festivals (1)" }),
    ).toHaveAttribute("data-state", "active");
    expect(screen.queryByText("Start Your Business Empire")).not.toBeInTheDocument();
  });

  it("supports a direct Festivals deep link from Business navigation", () => {
    window.history.replaceState(null, "", "/my-companies#festivals");
    useCompanies.mockReturnValue({
      data: [
        { id: "holding-1", name: "Touring Holdings", company_type: "holding" },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch,
    });

    render(<MyCompanies />);

    expect(
      screen.getByRole("tab", { name: "Festivals (0)" }),
    ).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Festival eligibility")).toBeInTheDocument();
  });

  it("shows a core query error instead of the create-first-company empty state", () => {
    useCompanies.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Please try again later."),
      refetch,
    });

    render(<MyCompanies />);

    expect(screen.getByText("Companies could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Please try again later.")).toBeInTheDocument();
    expect(screen.queryByText("Create Your First Company")).not.toBeInTheDocument();
  });

  it("still shows Festival companies when the standard company query fails", () => {
    useCompanies.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Standard companies unavailable"),
      refetch,
    });
    useOwnedFestivalCompanies.mockReturnValue({
      data: [
        {
          festivalCompanyId: "festival-1",
          publicName: "Shock Festival",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchFestivalCompanies,
    });

    render(<MyCompanies />);

    expect(screen.getByText("Companies could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Festival company: Shock Festival")).toBeInTheDocument();
  });

  it("refetches companies when Retry is clicked", async () => {
    useCompanies.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Failed"),
      refetch,
    });

    render(<MyCompanies />);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
