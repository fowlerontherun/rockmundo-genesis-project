import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from, rpc },
}));

vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({
    profile: {
      id: "profile-1",
      user_id: "user-1",
      display_name: "Active Player",
      is_active: true,
    },
    profileId: "profile-1",
    userId: "user-1",
    isLoading: false,
  }),
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
    expect(screen.getByText("Legacy balance fallback active")).toBeInTheDocument();
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
            canViewBalance: true,
            canViewDetails: false,
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
            canViewBalance: false,
            canViewDetails: false,
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
            canViewBalance: false,
            canViewDetails: false,
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
            canViewBalance: true,
            canViewDetails: false,
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


  it("reports not_band_member without exposing balances or contributions", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "get_band_treasury_dashboard") {
        return Promise.resolve({
          data: {
            status: "not_band_member",
            canViewBalance: false,
            canViewDetails: false,
            primaryCurrencyCode: "GBP",
            treasuries: [],
            contributions: [],
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: { status: "not_band_member", accounts: [] },
        error: null,
      });
    });

    render(<BandFinancesTab bandId="band-1" />);

    expect(await screen.findByText("Band membership required.")).toBeInTheDocument();
    expect(screen.queryByText("Legacy balance fallback active")).not.toBeInTheDocument();
    expect(screen.getByText("£0.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preview contribution/i })).toBeDisabled();
  });

  it("shows first-contribution previews with treasury creation semantics", async () => {
    rpc.mockImplementation((fn: string) => {
      if (fn === "get_band_treasury_dashboard") {
        return Promise.resolve({ data: { status: "treasury_missing", canViewBalance: true, canViewDetails: false, primaryCurrencyCode: "GBP", treasuries: [], contributions: [] }, error: null });
      }
      if (fn === "get_my_eligible_band_contribution_accounts") {
        return Promise.resolve({ data: { status: "ok", accounts: [{ id: "account-1", displayName: "Current Account", providerName: "Test Bank", accountType: "current", maskedAccountNumber: "•••• 1234", currencyCode: "GBP", currentBalanceMinor: 10000, availableBalanceMinor: 10000, isPrimary: true, eligible: true, ineligibleReason: null }] }, error: null });
      }
      if (fn === "preview_my_band_contribution") {
        return Promise.resolve({ data: { sourceAccountDisplay: "Current Account •••• 1234", currencyCode: "GBP", currentPersonalBalanceMinor: 10000, amountMinor: 2500, resultingPersonalBalanceMinor: 7500, destinationTreasuryName: "Band treasury", currentTreasuryBalanceMinor: 0, resultingTreasuryBalanceMinor: 2500, eligible: true, ineligibleReason: null, warningText: "warning", treasuryWillBeCreated: true }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<BandFinancesTab bandId="band-1" />);
    await screen.findByText("Band treasury is not available yet.");
    fireEvent.change(screen.getByPlaceholderText("50.00"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /Preview contribution/i }));

    expect(await screen.findByText("Band treasury")).toBeInTheDocument();
    expect(screen.getAllByText(/£25.00/).length).toBeGreaterThan(0);
    expect(rpc).toHaveBeenCalledWith("preview_my_band_contribution", expect.objectContaining({ p_amount_minor: 2500 }));
  });

  it("updates contribution balances in minor units without synthetic treasury ids", async () => {
    const dashboardResponses = [
      { status: "treasury_missing", canViewBalance: true, canViewDetails: false, primaryCurrencyCode: "GBP", treasuries: [], contributions: [] },
      { status: "ok", canViewBalance: true, canViewDetails: false, primaryCurrencyCode: "GBP", treasuries: [{ accountId: "treasury-1", currencyCode: "GBP", currentBalanceMinor: 2500, availableBalanceMinor: 2500, isPrimary: true }], contributions: [] },
    ];
    rpc.mockImplementation((fn: string) => {
      if (fn === "get_band_treasury_dashboard") return Promise.resolve({ data: dashboardResponses.shift() ?? dashboardResponses[0], error: null });
      if (fn === "get_my_eligible_band_contribution_accounts") return Promise.resolve({ data: { status: "ok", accounts: [{ id: "account-1", displayName: "Current Account", providerName: "Test Bank", accountType: "current", maskedAccountNumber: "•••• 1234", currencyCode: "GBP", currentBalanceMinor: 10000, availableBalanceMinor: 10000, isPrimary: true, eligible: true, ineligibleReason: null }] }, error: null });
      if (fn === "preview_my_band_contribution") return Promise.resolve({ data: { sourceAccountDisplay: "Current Account •••• 1234", currencyCode: "GBP", currentPersonalBalanceMinor: 10000, amountMinor: 2500, resultingPersonalBalanceMinor: 7500, destinationTreasuryName: "Band treasury", currentTreasuryBalanceMinor: 0, resultingTreasuryBalanceMinor: 2500, eligible: true, ineligibleReason: null, warningText: "warning", treasuryWillBeCreated: true }, error: null });
      if (fn === "contribute_my_personal_funds_to_band") return Promise.resolve({ data: { contributionId: "contribution-1", transactionId: "tx-1", newBandTreasuryBalanceMinor: 2500, newPlayerAvailableBalanceMinor: 7500 }, error: null });
      return Promise.resolve({ data: null, error: null });
    });

    render(<BandFinancesTab bandId="band-1" />);
    await screen.findByText("Band treasury is not available yet.");
    fireEvent.change(screen.getByPlaceholderText("50.00"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /Preview contribution/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirm contribution/i }));

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("contribute_my_personal_funds_to_band", expect.any(Object)));
    expect(screen.queryByText("pending-refresh")).not.toBeInTheDocument();
    expect(await screen.findByText(/£25.00/)).toBeInTheDocument();
  });
});
