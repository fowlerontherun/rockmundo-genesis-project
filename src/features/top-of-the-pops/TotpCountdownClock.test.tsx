import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TotpCountdownClock } from "./TotpCountdownClock";

describe("TotpCountdownClock accessibility", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes a timer label and a polite spoken countdown", () => {
    vi.useFakeTimers();
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameCallback = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(<TotpCountdownClock durationMs={10_000} label="On air in" />);

    expect(screen.getByRole("timer")).toHaveAttribute("aria-label", expect.stringContaining("On air in"));
    expect(screen.getByText(/On air in 10 seconds/i)).toHaveClass("sr-only");

    act(() => {
      frameCallback?.(performance.now() + 5_100);
    });

    expect(screen.getByText(/On air in 5 seconds/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
