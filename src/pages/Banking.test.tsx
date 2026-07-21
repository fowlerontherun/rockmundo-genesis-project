import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Banking from "./Banking";
import { fetchBankingDashboard } from "@/services/banking/bankingService";

vi.mock("@/services/banking/bankingService", () => ({
  fetchBankingDashboard: vi.fn(),
  formatCurrencyMinor: ({ amountMinor, currencyCode }: { amountMinor: number; currencyCode: string }) => `${currencyCode} ${amountMinor}`,
}));

function renderBanking() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <Banking />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("Banking page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a successful empty-state dashboard with empty arrays", async () => {
    vi.mocked(fetchBankingDashboard).mockResolvedValue({
      accounts: [],
      loans: [],
      creditProfile: { band: "Building", positiveFactors: [], negativeFactors: [] },
      recentActivity: [],
      savingsGoals: [],
      notifications: [],
    });

    renderBanking();

    expect(await screen.findByText("No linked bank accounts yet.")).toBeInTheDocument();
    expect(screen.getByText("No active loans.")).toBeInTheDocument();
    expect(screen.getByText(/No savings goals yet/)).toBeInTheDocument();
    expect(fetchBankingDashboard).toHaveBeenCalledTimes(1);
  });

  it("retries by refetching and does not expose raw Supabase schema-cache errors", async () => {
    vi.mocked(fetchBankingDashboard)
      .mockRejectedValueOnce(new Error("Banking is temporarily unavailable while the finance service is being updated. Please try again shortly."))
      .mockResolvedValueOnce({ accounts: [], loans: [], recentActivity: [] });

    renderBanking();

    expect(await screen.findByText("Banking unavailable")).toBeInTheDocument();
    expect(screen.getByText("Banking is temporarily unavailable while the finance service is being updated. Please try again shortly.")).toBeInTheDocument();
    expect(screen.queryByText(/get_banking_dashboard|PGRST202|schema cache|Could not find/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(fetchBankingDashboard).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No linked bank accounts yet.")).toBeInTheDocument();
  });
});
