import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import BankingApply from "./BankingApply";

const mocks = vi.hoisted(() => ({
  profileId: "profile-1" as string | null,
  userId: "user-1" as string | null,
  create: vi.fn(),
  result: vi.fn(),
  accept: vi.fn(),
  getLoan: vi.fn(),
  listProducts: vi.fn(),
  listAccounts: vi.fn(),
}));

vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({
    profileId: mocks.profileId, userId: mocks.userId, isLoading: false,
  }),
}));
vi.mock("@/components/fm/FMPageScaffold", () => ({
  FMPageScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/services/banking/bankingService", () => ({
  createLoanApplication: mocks.create,
  getLoanApplicationResult: mocks.result,
  acceptLoanOffer: mocks.accept,
  getLoanDetails: mocks.getLoan,
  listEligibleLoanProducts: mocks.listProducts,
  listPlayerBankAccounts: mocks.listAccounts,
  formatCurrencyMinor: (n: number) => `$${n}`,
  estimateEqualPrincipalSchedule: () => [{ totalDueMinor: 100 }],
}));

const product = {
  id: "product-1", providerName: "Local", productName: "Starter", minimumAmountMinor: 1000,
  maximumAmountMinor: 100000, minimumTermMonths: 1, maximumTermMonths: 24,
  supportedCurrencies: ["USD"], allowedPurposes: ["personal_emergency"],
  originationFeeBps: 0, originationFeeFlatMinor: 0, interestRateBps: 1000,
};
const account = { id: "account-1", providerName: "Local", accountType: "current", status: "active", currencyCode: "USD", balanceMinor: 200000 };
const offered = { status: "approved", offer: { id: "offer-1", principalMinor: 50000, currencyCode: "USD", interestRateBps: 1000, originationFeeMinor: 0 } };

const page = () => render(<MemoryRouter><BankingApply /></MemoryRouter>);
const submit = () => screen.getByRole("button", { name: /Submit application|Retry application/ });

describe("BankingApply request correctness (#4254)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileId = "profile-1";
    mocks.userId = "user-1";
    mocks.listProducts.mockResolvedValue([product]);
    mocks.listAccounts.mockResolvedValue([account]);
    mocks.create.mockResolvedValue("application-1");
    mocks.result.mockResolvedValue(offered);
    mocks.accept.mockResolvedValue("contract-1");
    mocks.getLoan.mockResolvedValue({ id: "contract-1", status: "active" });
  });

  it("prevents rapid duplicate application clicks while pending", async () => {
    let finish: (value: string) => void = () => {};
    mocks.create.mockImplementation(() => new Promise<string>((resolve) => { finish = resolve; }));
    page();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(submit()).toBeDisabled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    finish("application-1");
    await screen.findByText(/Application received/);
    expect(mocks.create).toHaveBeenCalledTimes(1);
  });

  it("reuses the SAME key after a timeout rather than creating a new application", async () => {
    mocks.create.mockRejectedValueOnce(new Error("Request timed out")).mockResolvedValue("application-1");
    page();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Request timed out");
    await userEvent.click(submit());
    await screen.findByText(/Application received/);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    const one = mocks.create.mock.calls[0][0];
    const two = mocks.create.mock.calls[1][0];
    expect(one.idempotencyKey).toBe(two.idempotencyKey);
    expect(one.borrowerId).toBe("profile-1");
  });

  it("checks application status again rather than recreating it after a result fetch failure", async () => {
    mocks.result.mockRejectedValueOnce(new Error("Status unavailable")).mockResolvedValue(offered);
    page();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent("Status unavailable");
    await userEvent.click(submit());
    await screen.findByText(/Application received/);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.result).toHaveBeenCalledTimes(2);
  });

  it("validates an application against product limits before touching the bank", async () => {
    page();
    await waitFor(() => expect(submit()).toBeEnabled());
    const amount = screen.getByLabelText("Amount (minor units)");
    await userEvent.clear(amount);
    await userEvent.type(amount, "99999999");
    expect(submit()).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not confirm acceptance until the persisted contract is returned", async () => {
    mocks.getLoan.mockRejectedValueOnce(new Error("Refresh failed"));
    page();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    await screen.findByText(/Application received/);
    const accept = screen.getByRole("button", { name: /Confirm and accept offer/ });
    await userEvent.click(accept);
    expect(await screen.findByRole("alert")).toHaveTextContent("Refresh failed");
    expect(screen.queryByText(/Loan accepted. The contract has been verified./)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry offer acceptance" }));
    expect(await screen.findByText(/Loan accepted. The contract has been verified./)).toBeInTheDocument();
    expect(mocks.accept).toHaveBeenCalledTimes(1);
    expect(mocks.getLoan).toHaveBeenCalledTimes(2);
  });

  it("reuses the acceptance key after an ambiguous RPC error", async () => {
    mocks.accept.mockRejectedValueOnce(new Error("504 timeout")).mockResolvedValue("contract-1");
    page();
    await waitFor(() => expect(submit()).toBeEnabled());
    await userEvent.click(submit());
    await screen.findByText(/Application received/);
    await userEvent.click(screen.getByRole("button", { name: /Confirm and accept offer/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("504 timeout");
    await userEvent.click(screen.getByRole("button", { name: "Retry offer acceptance" }));
    await screen.findByText(/Loan accepted. The contract has been verified./);
    expect(mocks.accept.mock.calls[0][0].idempotencyKey).toBe(mocks.accept.mock.calls[1][0].idempotencyKey);
  });

  it("requires an active character and never submits for a missing one", async () => {
    mocks.profileId = null;
    page();
    await screen.findByRole("button", { name: "Submit application" });
    expect(submit()).toBeDisabled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.listAccounts).not.toHaveBeenCalled();
  });
});
