import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GigViewerControls } from "../GigViewerControls";

function renderControls(overrides: Partial<Parameters<typeof GigViewerControls>[0]> = {}) {
  const handlers = {
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onRestart: vi.fn(),
    onSpeed: vi.fn(),
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    onPreviousSong: vi.fn(),
    onNextSong: vi.fn(),
    onNextHighlight: vi.fn(),
    onSkipResult: vi.fn(),
    onResult: vi.fn(),
    onClose: vi.fn(),
    onReducedMotion: vi.fn(),
    onPyrotechnics: vi.fn(),
    onCameraMode: vi.fn(),
    onFullscreen: vi.fn(),
    onPerformancePreference: vi.fn(),
  };

  render(
    <GigViewerControls
      playing={false}
      complete={false}
      speed={1}
      reducedMotion={false}
      pyrotechnics
      cameraMode="auto"
      performancePreference="auto"
      canPreviousSong
      canNextSong
      canNextHighlight
      canResult
      {...handlers}
      {...overrides}
    />,
  );

  return handlers;
}

describe("gig viewer controls accessibility", () => {
  it("names every grouped control set and exposes pressed state", () => {
    renderControls();

    expect(screen.getByRole("group", { name: "Playback speed" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Camera mode" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Graphics quality" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Graphics quality automatic" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("switch", { name: "Reduced motion" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Pyrotechnics and fireworks" })).toBeInTheDocument();
  });

  it("operates camera, quality, reduced motion and pyrotechnics with the keyboard only", async () => {
    const user = userEvent.setup();
    const handlers = renderControls();

    await user.tab();
    let guard = 0;
    while (
      document.activeElement?.getAttribute("aria-label") !== "Graphics quality low" &&
      guard < 60
    ) {
      await user.tab();
      guard += 1;
    }
    expect(guard).toBeLessThan(60);
    await user.keyboard("{Enter}");
    expect(handlers.onPerformancePreference).toHaveBeenCalledWith("low");

    screen.getByRole("button", { name: "Stage Focus" }).focus();
    await user.keyboard("{Enter}");
    expect(handlers.onCameraMode).toHaveBeenCalledWith("stage_focus");

    screen.getByRole("switch", { name: "Reduced motion" }).focus();
    await user.keyboard("{ }");
    expect(handlers.onReducedMotion).toHaveBeenCalledWith(true);

    screen.getByRole("switch", { name: "Pyrotechnics and fireworks" }).focus();
    await user.keyboard("{ }");
    expect(handlers.onPyrotechnics).toHaveBeenCalledWith(false);
  });

  it("keeps compact controls named for touch and screen reader use", () => {
    renderControls({ compact: true, fullscreen: true });

    expect(screen.getByRole("button", { name: "Play replay" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart replay" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Graphics quality" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit full screen stage view" })).toBeInTheDocument();
  });
});
