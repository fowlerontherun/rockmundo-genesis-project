import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BankingLoanDetail from "./BankingLoanDetail";

const mocks = vi.hoisted(() => ({
  loanId: "loan-1",
  profileId: "profile-1" as string | null,
  userId: "user-1" as string | null,
  details: vi.fn(), schedule: vi.fn(), attempts: vi.fn(), retry: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useParams: () => ({ loanId: mocks.loanId }) }));
vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({ profileId: mocks.profileId, userId: mocks.userId }),
}));
vi.mock("@/components/fm/FMPageScaffold", () => ({
  FMPageScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/services/banking/bankingService", () => ({
  formatCurrencyMinor: (amount: number) => `$${amount}`,
  getLoanDetails: mocks.details, getLoanSchedule: mocks.schedule,
  listLoanPaymentAttempts: mocks.attempts, retryLoanPayment: mocks.retry,
}));

const loan = {
  id: "loan-1", status: "active", providerName: "Bank", principalMinor: 100000,
  outstandingPrincipalMinor: 10000, currencyCode: "USD", interestRateBps: 1000,
  originationFeeMinor: 0, nextPaymentMinor: 5000, nextPaymentDate: "2026-11-01",
};
const unpaid = {
  id: "line-1", instalmentNumber: 1, dueDate: "2026-10-15",
  status: "failed", totalDueMinor: 5000, amountPaidMinor: 0,
};
const paid = { ...unpaid, status: "paid", amountPaidMinor: 5000 };

describe("BankingLoanDetail repayment retries (#4254)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loanId = "loan-1";
    mocks.profileId = "profile-1";
    mocks.userId = "user-1";
    mocks.details.mockResolvedValue(loan);
    mocks.schedule.mockResolvedValue([unpaid]);
    mocks.attempts.mockResolvedValue([]);
    mocks.retry.mockResolvedValue({ status: "paid" });
  });

  it("prevents two rapid repayment attempts while a request is unresolved", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.retry.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<BankingLoanDetail />);
    const button = await screen.findByRole("button", { name: "Retry" });
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Checking..." })).toBeDisabled();
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    finish({ status: "paid" });
    await screen.findByText(/Payment request processed/);
    expect(mocks.retry).toHaveBeenCalledTimes(1);
  });

  it("reuses the original idempotency key when a network timeout requires retry", async () => {
    mocks.retry.mockRejectedValueOnce(new Error("Network timeout")).mockResolvedValue({ status: "pending" });
    render(<BankingLoanDetail />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network timeout");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/Payment request processed/);
    expect(mocks.retry).toHaveBeenCalledTimes(2);
    expect(mocks.retry.mock.calls[0][0].idempotencyKey).toBe(mocks.retry.mock.calls[1][0].idempotencyKey);
  });

  it("does not claim confirmed payment without re-reading the persisted schedule", async () => {
    mocks.schedule.mockResolvedValueOnce([unpaid]).mockRejectedValueOnce(new Error("Refresh failed"));
    render(<BankingLoanDetail />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh failed");
    expect(screen.queryByText("Payment confirmed by the bank.")).not.toBeInTheDocument();
  });

  it("shows confirmed payment only after the actual schedule changes to paid", async () => {
    mocks.schedule.mockResolvedValueOnce([unpaid]).mockResolvedValueOnce([paid]);
    render(<BankingLoanDetail />);
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Payment confirmed by the bank.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("hides repayment actions when active profile is not established", async () => {
    mocks.profileId = null;
    render(<BankingLoanDetail />);
    expect(await screen.findByText(/Select an active character/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("shows a load failure instead of a fake empty payment schedule", async () => {
    mocks.details.mockRejectedValueOnce(new Error("Loan access denied"));
    render(<BankingLoanDetail />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Loan access denied");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("does not reuse a previous character's loan after switching profiles", async () => {
    const view = render(<BankingLoanDetail />);
    expect(await screen.findByText("Bank")).toBeInTheDocument();
    mocks.profileId = null;
    view.rerender(<BankingLoanDetail />);
    expect(await screen.findByText(/Select an active character/)).toBeInTheDocument();
    expect(screen.queryByText("Bank")).not.toBeInTheDocument();
  });
  it("recovers from an initial loan fetch failure using the explicit reload action", async () => {
    mocks.details.mockRejectedValueOnce(new Error("Server unavailable"));
    render(<BankingLoanDetail />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
    await userEvent.click(screen.getByRole("button", { name: "Retry loading loan" }));
    expect(await screen.findByText("Bank")).toBeInTheDocument();
    expect(mocks.details).toHaveBeenCalledTimes(2);
  });

});
