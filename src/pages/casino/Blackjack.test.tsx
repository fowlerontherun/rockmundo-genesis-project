import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Blackjack from "./Blackjack";

type TestCard = {
  suit: "spades";
  rank: "A" | "2" | "3" | "5" | "6" | "7" | "8" | "9" | "10" | "K";
  faceUp: boolean;
};
const card = (rank: TestCard["rank"], faceUp = true): TestCard => ({ suit: "spades", rank, faceUp });

const mocks = vi.hoisted(() => ({
  cash: 1_000,
  record: vi.fn(),
  navigate: vi.fn(),
  player: [] as TestCard[],
  dealer: [] as TestCard[],
  remaining: [] as TestCard[],
}));

vi.mock("@/hooks/useCasino", () => ({
  useCasino: () => ({ cash: mocks.cash, recordTransaction: mocks.record, isRecording: false }),
}));
vi.mock("@/components/fm/FMPageScaffold", () => ({
  FMPageScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/casino/CasinoCard", () => ({
  CasinoCard: ({ card: shown }: { card: TestCard }) => <span>{shown.faceUp ? shown.rank : "?"}</span>,
}));
vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/casino/blackjack", async (original) => ({
  ...(await original<typeof import("@/lib/casino/blackjack")>()),
  dealInitialHands: () => ({
    playerCards: mocks.player,
    dealerCards: mocks.dealer,
    remainingDeck: mocks.remaining,
  }),
}));

type Outcome = "win" | "push" | "bust";
function cardsFor(outcome: Outcome) {
  mocks.player = outcome === "bust" ? [card("9"), card("7")] : [card("5"), card("6")];
  mocks.dealer = [card("8"), card("8", false)];
  // pop() deals the final card first, then the dealer's card if not busted.
  mocks.remaining = outcome === "win" ? [card("2"), card("10")]
    : outcome === "push" ? [card("3"), card("8")]
    : [card("2"), card("K")];
}

async function doubleHand() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Deal/ }));
  await user.click(screen.getByRole("button", { name: "Double" }));
  return user;
}

describe("Blackjack doubled-stake settlement (#4269)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cash = 1_000;
    cardsFor("win");
    mocks.record.mockImplementation(async (_game, stake: number, payout: number) => ({
      netResult: payout - stake,
      newCash: 1_000 + payout - stake,
    }));
  });

  it.each([
    { outcome: "win" as const, payout: 400, net: 200, label: "WIN!" },
    { outcome: "push" as const, payout: 200, net: 0, label: "PUSH" },
    { outcome: "bust" as const, payout: 0, net: -200, label: "BUST!" },
  ])("charges the full $200 once for a doubled $100 $outcome", async ({ outcome, payout, net, label }) => {
    cardsFor(outcome);
    render(<Blackjack />);
    await doubleHand();
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith("blackjack", 200, payout, {
      result: outcome,
      originalStake: 100,
      effectiveStake: 200,
      doubled: true,
    });
    expect(screen.getByText("Wager: 200 (doubled)")).toBeInTheDocument();
    if (net !== 0) {
      expect(screen.getByText(net > 0 ? "+$200" : "-$200")).toBeInTheDocument();
    }
    // The result uses the confirmed net, not stale React state or a predicted payout.
    expect(screen.getByText(`$${(1_000 + net).toLocaleString()}`)).toBeInTheDocument();
  });

  it("does not double when funds or the server wager cap are insufficient", async () => {
    mocks.cash = 199;
    render(<Blackjack />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Deal/ }));
    expect(screen.getByRole("button", { name: "Double" })).toBeDisabled();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("does not show a result while pending or settle again on repeated clicks", async () => {
    let resolve!: (receipt: { netResult: number; newCash: number }) => void;
    mocks.record.mockImplementation(() => new Promise(r => { resolve = r; }));
    render(<Blackjack />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Deal/ }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Double" }));
    expect(mocks.record).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Confirming");
    expect(screen.queryByText("WIN!")).not.toBeInTheDocument();
    resolve({ netResult: 200, newCash: 1_200 });
    expect(await screen.findByText("WIN!")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "New Hand" }));
    expect(screen.getByRole("button", { name: "Deal — $100" })).toBeInTheDocument();
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });

  it("fails closed for a stale balance or failed RPC without claiming a payout", async () => {
    // The locally displayed balance permits Double; the server rejects it.
    mocks.record.mockRejectedValue(new Error("insufficient_funds"));
    render(<Blackjack />);
    const user = await doubleHand();
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(screen.queryByText("WIN!")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Hand" })).not.toBeInTheDocument();
    expect(mocks.record).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Return to Casino" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/casino");
  });

  it("uses the original wager when standing without doubling", async () => {
    render(<Blackjack />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Deal/ }));
    await user.click(screen.getByRole("button", { name: "Stand" }));
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith("blackjack", 100, expect.any(Number), {
      result: expect.any(String),
      originalStake: 100,
      effectiveStake: 100,
      doubled: false,
    });
  });
});
