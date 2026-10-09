import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CharacterProfileShareMoment } from "./characterProfile";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  onCanvasReady: null as null | ((canvas: HTMLCanvasElement) => void),
  appearance: {} as object | null,
}));

vi.mock("@/features/player-model/usePlayerModel", () => ({
  usePlayerModel: () => ({ profileId: "player-1", query: { data: mocks.appearance ? { appearance: mocks.appearance } : null } }),
  useEquippedRichClothing: () => ({ data: [] }),
  useEquippedStageLuthieryInstruments: () => ({ data: [] }),
  usePlayerStageTattoos: () => ({ data: [] }),
}));
vi.mock("@/features/player-model/useAvatarMerchWearables", () => ({
  useAvatarMerchWearables: () => ({ query: { data: null } }),
}));
vi.mock("@/features/player-model/PlayerModelPreview", () => ({
  PlayerModelPreview: ({ onCanvasReady }: { onCanvasReady: (canvas: HTMLCanvasElement) => void }) => {
    mocks.onCanvasReady = onCanvasReady;
    return <div data-testid="mock-avatar-preview" />;
  },
}));
vi.mock("./avatarCapture", () => ({ captureAvatarCanvas: mocks.capture }));
vi.mock("./ShareMomentSheet", () => ({
  ShareMomentSheet: () => <div data-testid="share-sheet" />,
}));

import { AvatarShareStudio } from "./CharacterShareStudio";

const moment: CharacterProfileShareMoment = {
  version: 1,
  type: "character_profile",
  id: "player-1",
  headline: "Artist",
  createdAt: "2026-10-09T00:00:00Z",
};

describe("AvatarShareStudio capture lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.capture.mockReset();
    mocks.onCanvasReady = null;
    mocks.appearance = {};
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not start the capture timeout before appearance data loads", () => {
    mocks.appearance = null;
    const { rerender } = render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(20000); });
    expect(screen.queryByRole("button", { name: "Retry avatar capture" })).not.toBeInTheDocument();
    mocks.appearance = {};
    rerender(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(15000); });
    expect(screen.getByRole("button", { name: "Retry avatar capture" })).toBeInTheDocument();
  });

  it("offers retry when the avatar renderer stalls", () => {
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Retry avatar capture" })).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(15000); });
    expect(screen.getByRole("button", { name: "Retry avatar capture" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry avatar capture" }));
    expect(screen.queryByRole("button", { name: "Retry avatar capture" })).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(15000); });
    expect(screen.getByRole("button", { name: "Retry avatar capture" })).toBeInTheDocument();
  });

  it("offers retry after capture throws and recovers on the next attempt", () => {
    mocks.capture.mockImplementationOnce(() => { throw new Error("WebGL capture failed"); });
    mocks.capture.mockReturnValue({ dataUrl: "data:image/png;base64,AA==", width: 720, height: 1080 });
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    act(() => { mocks.onCanvasReady?.(document.createElement("canvas")); });
    expect(screen.getByRole("button", { name: "Retry avatar capture" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry avatar capture" }));
    act(() => { mocks.onCanvasReady?.(document.createElement("canvas")); });
    expect(screen.queryByRole("button", { name: "Retry avatar capture" })).not.toBeInTheDocument();
    expect(mocks.capture).toHaveBeenCalledTimes(2);
  });

  it("clears the timeout when the share studio closes", () => {
    const { rerender } = render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    rerender(<AvatarShareStudio open={false} moment={moment} onOpenChange={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(15000); });
    expect(screen.queryByRole("button", { name: "Retry avatar capture" })).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not report a timeout after successful capture", () => {
    mocks.capture.mockReturnValue({ dataUrl: "data:image/png;base64,AA==", width: 720, height: 1080 });
    render(<AvatarShareStudio open moment={moment} onOpenChange={vi.fn()} />);
    act(() => { mocks.onCanvasReady?.(document.createElement("canvas")); });
    act(() => { vi.advanceTimersByTime(15000); });
    expect(screen.queryByRole("button", { name: "Retry avatar capture" })).not.toBeInTheDocument();
  });
});
