import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Blackjack from "./Blackjack";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  recordTransaction: vi.fn(),
}));

vi.mock("@/components/fm/FMPageScaffold", () => ({
  FMPageScaffold: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock("react-router-dom", async original => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/hooks/useCasino", () => ({
  useCasino: () => ({ cash: 1000, recordTransaction: mocks.recordTransaction, isRecording: false }),
}));

describe("P0 #4222 blackjack fail-closed until server-managed cards are ready", () => {
  it("does not offer Deal, Hit, Stand or Double buttons or claim a payout", () => {
    render(<Blackjack />);
    expect(screen.getByRole("alert")).toHaveTextContent("temporarily unavailable");
    for (const action of ["Deal", "Hit", "Stand", "Double"]) {
      expect(screen.queryByRole("button", { name: action })).not.toBeInTheDocument();
    }
    expect(mocks.recordTransaction).not.toHaveBeenCalled();
  });

  it("lets players return to the casino without risking a balance change", async () => {
    mocks.navigate.mockClear();
    render(<Blackjack />);
    await userEvent.click(screen.getByRole("button", { name: "Back to Casino" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/casino");
    expect(mocks.recordTransaction).not.toHaveBeenCalled();
  });
});
