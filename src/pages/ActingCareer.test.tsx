import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActingCareer from "./ActingCareer";

const mocks = vi.hoisted(() => ({
  user: { id: "account-1" } as { id: string } | null,
  profileId: "character-1" as string | null,
  profileLoading: false,
  queryStates: {} as Record<string, Record<string, unknown>>,
  queries: {} as Record<string, { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled: boolean }>,
  retry: vi.fn(),
  from: vi.fn(),
}));

function state(data: unknown[] = [], overrides: Record<string, unknown> = {}) {
  return {
    data, isSuccess: true, isLoading: false, isError: false, error: null,
    refetch: mocks.retry, ...overrides,
  };
}

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown[]; queryFn: () => Promise<unknown>; enabled: boolean }) => {
    const key = options.queryKey[0] as string;
    mocks.queries[key] = options;
    return mocks.queryStates[key] ?? state();
  },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/hooks/use-auth-context", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ profileId: mocks.profileId, isLoading: mocks.profileLoading }),
}));
vi.mock("@/components/fm/FMPageScaffold", () => ({
  FMPageScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/acting/FilmBreakdownCard", () => ({
  FilmBreakdownCard: ({ contract }: { contract: { title: string } }) => <div>Film: {contract.title}</div>,
}));
vi.mock("@/components/acting/SeriesBreakdownCard", () => ({
  SeriesBreakdownCard: ({ contract }: { contract: { title: string } }) => <div>Series: {contract.title}</div>,
}));
vi.mock("@/components/acting/RenewalOfferCard", () => ({
  RenewalOfferCard: ({ renewal }: { renewal: { title: string } }) => <div>Renewal: {renewal.title}</div>,
}));
vi.mock("@/components/acting/NegotiateOfferDialog", () => ({
  NegotiateOfferDialog: () => <div>Negotiation dialog</div>,
}));

describe("ActingCareer data failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryStates = {};
    mocks.queries = {};
    mocks.user = { id: "account-1" };
    mocks.profileId = "character-1";
    mocks.profileLoading = false;
  });

  it("shows genuine empty state only when BOTH offer queries succeeded", () => {
    render(<ActingCareer />);
    expect(screen.getByText(/No active acting offers/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never reports no offers when the offers request fails, while preserving successful renewals", () => {
    mocks.queryStates["acting-offers"] = state([], {
      data: undefined, isSuccess: false, isError: true, error: new Error("Offers request failed"),
    });
    mocks.queryStates["acting-renewals"] = state([{ id: "renew-1", title: "Space Heroes" }]);
    render(<ActingCareer />);

    expect(screen.getByRole("alert")).toHaveTextContent("Offers request failed");
    expect(screen.getByText("Renewal: Space Heroes")).toBeInTheDocument();
    expect(screen.queryByText(/No active acting offers/)).not.toBeInTheDocument();
  });

  it("shows a retry control for just the failing offers source", async () => {
    mocks.queryStates["acting-renewals"] = state([], {
      data: undefined, isSuccess: false, isError: true, error: new Error("Renewal query timeout"),
    });
    render(<ActingCareer />);
    await userEvent.click(screen.getByRole("button", { name: "Retry renewal offers" }));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/No active acting offers/)).not.toBeInTheDocument();
  });

  it("shows loading state rather than an empty message while either offer query is loading", () => {
    mocks.queryStates["acting-offers"] = state([], {
      data: undefined, isSuccess: false, isLoading: true,
    });
    render(<ActingCareer />);
    expect(screen.getByText("Loading acting offers...")).toBeInTheDocument();
    expect(screen.queryByText(/No active acting offers/)).not.toBeInTheDocument();
  });

  it("keeps film contract failures separate from the successfully loaded series tab", async () => {
    mocks.queryStates["acting-contracts-films"] = state([], {
      data: undefined, isSuccess: false, isError: true, error: new Error("Films unavailable"),
    });
    mocks.queryStates["acting-contracts-series"] = state([{ id: "series-1", title: "Stage School" }]);
    render(<ActingCareer />);

    await userEvent.click(screen.getByRole("tab", { name: /My Films/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Films unavailable");
    expect(screen.queryByText("No films yet.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /My Series/ }));
    expect(screen.getByText("Series: Stage School")).toBeInTheDocument();
  });

  it("does not show a false empty series state when the series request fails", async () => {
    mocks.queryStates["acting-contracts-series"] = state([], {
      data: undefined, isSuccess: false, isError: true, error: new Error("Series denied"),
    });
    render(<ActingCareer />);
    await userEvent.click(screen.getByRole("tab", { name: /My Series/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Series denied");
    expect(screen.queryByText("No series contracts yet.")).not.toBeInTheDocument();
  });

  it("keys all four requests to the active account AND character, and disables them without a character", () => {
    const view = render(<ActingCareer />);
    for (const query of Object.values(mocks.queries)) {
      expect(query.queryKey.slice(1)).toEqual(["account-1", "character-1"]);
      expect(query.enabled).toBe(true);
    }
    mocks.profileId = null;
    view.rerender(<ActingCareer />);
    expect(screen.getByText(/Select an active character/)).toBeInTheDocument();
    for (const query of Object.values(mocks.queries)) expect(query.enabled).toBe(false);
  });

  it("throws Supabase query failures instead of converting them to empty arrays", async () => {
    const failure = new Error("RLS or database error");
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => void) => Promise.resolve({ data: null, error: failure }).then(resolve),
    };
    for (const name of ["select", "eq", "in", "order"]) builder[name] = vi.fn(() => builder);
    mocks.from.mockReturnValue(builder);
    render(<ActingCareer />);

    for (const query of Object.values(mocks.queries)) {
      await expect(query.queryFn()).rejects.toThrow("RLS or database error");
    }
    expect(mocks.from).toHaveBeenCalledTimes(4);
  });
});
