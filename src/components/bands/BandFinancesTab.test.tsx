import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from, rpc },
}));

vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ profileId: "profile-1", userId: "user-1" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { BandFinancesTab } from "./BandFinancesTab";

const band = {
  id: "band-1",
  name: "The Fallbacks",
  band_balance: 1234,
  weekly_pay_percent: 10,
  leader_id: "profile-1",
};

const earnings = [
  {
    id: "earn-1",
    band_id: "band-1",
    amount: 200,
    source: "gig",
    created_at: "2026-07-20T10:00:00Z",
  },
  {
    id: "earn-2",
    band_id: "band-1",
    amount: -50,
    source: "rehearsal",
    created_at: "2026-07-20T11:00:00Z",
  },
];

function mockCoreQueries() {
  from.mockImplementation((table: string) => {
    if (table === "bands") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: band, error: null }),
      };
    }
    if (table === "band_earnings") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: earnings, error: null }),
      };
    }
    if (table === "band_members") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: "member-1", is_touring_member: false, user_id: "user-1" },
          ],
          error: null,
        }),
      };
    }
    throw new Error(`Unexpected table ${table}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCoreQueries();
  rpc.mockImplementation((fn: string) => {
    if (fn === "get_band_treasury_dashboard") {
      return Promise.resolve({
        data: null,
        error: { message: "invalid input value for enum" },
      });
    }
    if (fn === "get_my_eligible_band_contribution_accounts") {
      return Promise.resolve({
        data: { status: "no_eligible_accounts", accounts: [] },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
});

describe("BandFinancesTab treasury regression handling", () => {
  it("keeps core finances visible when the treasury dashboard RPC fails", async () => {
    render(<BandFinancesTab bandId="band-1" />);

    expect(
      await screen.findByText("Band treasury could not be loaded."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your other finance information is still available."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("invalid input value for enum"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Unable to load band finances"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Legacy balance fallback active"),
    ).toBeInTheDocument();
    expect(screen.getByText("Add Money to Band")).toBeInTheDocument();
    expect(screen.getByText("Weekly Member Pay")).toBeInTheDocument();
    expect(screen.getByText(/£1,234.00/)).toBeInTheDocument();
  });

  it("does not replace a legacy balance with zero when no treasury exists", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "get_band_treasury_dashboard") {
        return Promise.resolve({
          data: {
            status: "treasury_missing",
            primaryCurrencyCode: "GBP",
            treasuries: [],
            contributions: [],
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: { status: "no_eligible_accounts", accounts: [] },
        error: null,
      });
    });

    render(<BandFinancesTab bandId="band-1" />);

    expect(
      await screen.findByText("Band treasury is not available yet."),
    ).toBeInTheDocument();
    expect(screen.getByText(/£1,234.00/)).toBeInTheDocument();
    expect(screen.queryByText(/£0\.00/)).not.toBeInTheDocument();
  });

  it("does not activate legacy fallback after treasury permission denial", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "get_band_treasury_dashboard") {
        return Promise.resolve({
          data: {
            status: "permission_denied",
            primaryCurrencyCode: "GBP",
            treasuries: [],
            contributions: [
              {
                id: "hidden",
                amountMinor: 5000,
                currencyCode: "GBP",
                contributionType: "voluntary_deposit",
                refundableStatus: "not_refundable",
                notes: "protected",
                createdAt: "2026-07-20T12:00:00Z",
                contributorDisplayName: "Hidden Member",
                contributorAvatarUrl: null,
              },
            ],
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: { status: "no_eligible_accounts", accounts: [] },
        error: null,
      });
    });

    render(<BandFinancesTab bandId="band-1" />);

    expect(
      await screen.findByText("Band treasury permission required."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Legacy balance fallback active"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden Member")).not.toBeInTheDocument();
    expect(screen.getByText("£0.00")).toBeInTheDocument();
  });

  it("shows active profile errors without contribution controls enabled", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "get_band_treasury_dashboard") {
        return Promise.resolve({
          data: {
            status: "profile_missing",
            primaryCurrencyCode: "GBP",
            treasuries: [],
            contributions: [],
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: { status: "profile_missing", accounts: [] },
        error: null,
      });
    });

    render(<BandFinancesTab bandId="band-1" />);

    expect(
      await screen.findByText("Active profile required."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Legacy balance fallback active"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Preview contribution/i }),
    ).toBeDisabled();
  });

  it("isolates personal account RPC failures to the contribution section", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "get_band_treasury_dashboard") {
        return Promise.resolve({
          data: {
            status: "ok",
            primaryCurrencyCode: "GBP",
            treasuries: [],
            contributions: [],
          },
          error: null,
        });
      }
      if (fn === "get_my_eligible_band_contribution_accounts") {
        return Promise.resolve({
          data: null,
          error: { message: "accounts unavailable" },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<BandFinancesTab bandId="band-1" />);

    await waitFor(() =>
      expect(
        screen.getByText(/Unable to load accounts: accounts unavailable/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Unable to load band finances"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Add Money to Band")).toBeInTheDocument();
    expect(screen.getByText("Revenue Breakdown")).toBeInTheDocument();
  });
});
