import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TotpBroadcastRecoveryBoundary } from "./TotpBroadcastRecoveryBoundary";

function BrokenPicture({ broken }: { broken: boolean }) {
  if (broken) throw new Error("webgl context lost");
  return <div data-testid="picture">studio picture</div>;
}

describe("TotpBroadcastRecoveryBoundary", () => {
  it("keeps a programme-shaped fallback on screen when the 3D renderer fails", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <TotpBroadcastRecoveryBoundary
        resetKey="act-1"
        bandName="Test Band"
        songTitle="Test Song"
        chartRank={4}
        presenterName="Alex Rayne"
        presenterText="Up next, Test Band."
      >
        <BrokenPicture broken />
      </TotpBroadcastRecoveryBoundary>,
    );

    expect(screen.getByText("Test Band")).toBeInTheDocument();
    expect(screen.getByText("“Test Song”")).toBeInTheDocument();
    expect(screen.getByText(/studio picture temporarily unavailable/i)).toBeInTheDocument();
    expect(document.querySelector("[data-totp-broadcast-recovery]")).toBeTruthy();
    consoleSpy.mockRestore();
  });

  it("can retry without remounting the whole programme", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let broken = true;
    const { rerender } = render(
      <TotpBroadcastRecoveryBoundary
        resetKey="act-1"
        bandName="Test Band"
        songTitle="Test Song"
      >
        <BrokenPicture broken={broken} />
      </TotpBroadcastRecoveryBoundary>,
    );

    broken = false;
    fireEvent.click(screen.getByRole("button", { name: /retry studio picture/i }));
    rerender(
      <TotpBroadcastRecoveryBoundary
        resetKey="act-1"
        bandName="Test Band"
        songTitle="Test Song"
      >
        <BrokenPicture broken={broken} />
      </TotpBroadcastRecoveryBoundary>,
    );

    expect(screen.getByTestId("picture")).toHaveTextContent("studio picture");
    consoleSpy.mockRestore();
  });
});
