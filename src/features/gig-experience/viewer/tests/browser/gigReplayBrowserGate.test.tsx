import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GigViewerShell } from "../../GigViewerShell";
import type { GigViewerReplayResult } from "../../../services/GigViewerReplayService";
import type { GigViewerReplay } from "../../../events/types";
import type { GigExperienceDTO } from "../../../types";

let replayResult: GigViewerReplayResult = { state: "ready", replay: null };
const refetch = vi.fn();

vi.mock("../../../hooks", () => ({
  useGigViewerReplay: () => ({ data: replayResult, isLoading: false, isError: false, error: null, refetch }),
}));

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: ResizeObserverMock });
Object.defineProperty(window, "ResizeObserver", { configurable: true, value: ResizeObserverMock });
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn((query: string) => ({ matches: false, media: query, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })),
});

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(), clip: vi.fn(), arc: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn(), rect: vi.fn(),
  moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
  setTransform: vi.fn(), setLineDash: vi.fn(), fillText: vi.fn(), measureText: vi.fn(() => ({ width: 20 })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  set fillStyle(_v: string) {}, set strokeStyle(_v: string) {}, set lineWidth(_v: number) {}, set globalAlpha(_v: number) {},
  set font(_v: string) {}, set textAlign(_v: string) {}, set textBaseline(_v: string) {},
})) as any;

const mkEvent = (sequence: number, offset: number, eventType: string, phase: string, visualPayload: any, messageKey = "gig.viewer.venue_opened") => ({
  id: `event-${sequence}`, gigId: "gig-release", sequence, scheduledOffsetMs: offset, durationMs: 500, phase, eventType,
  importance: sequence === 4 ? "critical" : "normal", messageKey, messageParams: { title: "Beta Anthem", attendance: 120 }, visualPayload,
});

const readyReplay: GigViewerReplay = {
  id: "replay-release", gigId: "gig-release", gigOutcomeId: "outcome-release", viewerVersion: 1, eventSchemaVersion: 1,
  simulationSeed: "release-seed", durationMs: 9000, generatedAt: "2026-07-11T12:00:00.000Z", checksum: null, status: "ready",
  crowdTuning: { densityMultiplier: 1, depthSpread: 1, lateralSpread: 1, stagePull: 0.5, randomness: 0.5, fanScale: 1, arrivalSpeed: 1 },
  events: [
    mkEvent(0, 0, "venue_opened", "venue_opening", { type: "venue_open", entranceIds: ["main"], lightLevel: 0.4 }),
    mkEvent(1, 1000, "performer_entered", "band_entrance", { type: "performer_enter", performerId: "p1", displayName: "Ari", roleOrInstrument: "vocals", startPosition: { x: 0.5, y: 0.5, zone: "front_center" } }, "gig.viewer.performer_entered"),
    mkEvent(2, 2000, "song_started", "song_performance", { type: "song_start", songId: "song-1", title: "Beta Anthem", position: 0, montage: false }, "gig.viewer.song_started"),
    mkEvent(3, 4000, "song_highlight", "song_performance", { type: "spotlight", performerId: "p1", intensity: 0.9 }, "gig.viewer.song_highlight"),
    mkEvent(4, 7000, "result_revealed", "result_reveal", { type: "result_reveal", overallRating: 20, attendance: 120, netProfit: 400, verdictKey: "great" }, "gig.viewer.result_reveal"),
    mkEvent(5, 8500, "replay_completed", "completed", { type: "crowd_reaction", reaction: "disperse", intensity: 0.1 }, "gig.viewer.completed"),
  ] as any,
};

const experience: GigExperienceDTO = {
  gig: { id: "gig-release", bandId: "band-1", status: "completed", scheduledDate: "2026-07-11T10:00:00Z", startedAt: "2026-07-11T10:00:00Z", completedAt: "2026-07-11T12:00:00Z", ticketPrice: { status: "available", value: 20 }, venue: { id: "venue-1", name: "Beta Hall", location: "Test City", capacity: 150 } },
  headline: { rating: { status: "available", value: 20 }, grade: { status: "available", value: "A" }, attendance: { status: "available", value: 120 }, attendancePercent: { status: "available", value: 80 }, netProfit: { status: "available", value: 400 }, fameGained: { status: "available", value: 10 } },
  financials: { ticketRevenue: { status: "available", value: 2400 }, merchRevenue: { status: "available", value: 100 }, totalRevenue: { status: "available", value: 2500 }, crewCost: { status: "available", value: 100 }, equipmentCost: { status: "available", value: 50 }, venueCost: { status: "available", value: 200 }, totalCosts: { status: "available", value: 350 }, netProfit: { status: "available", value: 400 } },
  fanImpact: { newFollowers: { status: "available", value: 10 }, casualFans: { status: "available", value: 5 }, dedicatedFans: { status: "available", value: 3 }, superfans: { status: "available", value: 1 }, conversions: { status: "available", value: 9 } },
  performance: { chemistryChange: { status: "available", value: 1 }, xpAwarded: { status: "available", value: 30 }, equipmentQuality: { status: "available", value: 10 }, crewSkill: { status: "available", value: 10 }, bandChemistry: { status: "available", value: 10 }, memberSkill: { status: "available", value: 10 }, merchItemsSold: { status: "available", value: 8 }, crowdEnergyPeak: { status: "available", value: 90 }, stageBehavior: { status: "available", value: "balanced" } },
  story: { summary: "Great beta show", highlights: ["Encore"], factors: [] }, songs: [], viewer: { ready: true, outcomeId: "outcome-release", resultReadyAt: "2026-07-11T12:00:00Z", replayAvailable: true, replay: { viewerVersion: 1, durationMs: 9000, generationStatus: "ready" } },
} as any;

afterEach(() => { cleanup(); localStorage.clear(); refetch.mockClear(); replayResult = { state: "ready", replay: readyReplay }; });

function renderViewer(props: Partial<React.ComponentProps<typeof GigViewerShell>> = {}) {
  localStorage.clear();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <GigViewerShell gigId="gig-release" experience={experience} open mode="analysis" onViewResult={vi.fn()} onClose={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe("Phase 5 browser release gate surrogate", () => {
  it("keeps the player stage focused on the animated song performance", () => {
    replayResult = { state: "ready", replay: readyReplay };
    const onClose = vi.fn();

    renderViewer({ mode: "player", onClose });

    const stage = screen.getByRole("region", { name: /player gig stage view/i });
    expect(stage).toBeInTheDocument();
    expect(stage.className).not.toContain("fixed");
    expect(stage).toHaveAttribute("data-fullscreen", "false");
    expect(stage.querySelector("[data-player-stage-viewport]")).toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe("hidden");
    expect(screen.getByRole("img", { name: /song performance stage showing the band and crowd/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/replay controls/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^play$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^restart$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous event/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next event/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous song/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next song/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next highlight/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip to result/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /playback speed/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /reduced motion/i })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /pyrotechnics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pop out full screen stage view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view result/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/song timeline/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /performers/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /crowd mood/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/setlist audio controls/i)).not.toBeInTheDocument();
    expect(screen.getByText("Beta Anthem")).toBeInTheDocument();
    expect(screen.getByText("Song 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("0:00 / 0:20")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /close viewer/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("loads a completed replay lazily and exposes canvas, panels, timeline, graph, controls, and result access", () => {
    replayResult = { state: "ready", replay: readyReplay };
    renderViewer();
    expect(screen.getByRole("heading", { name: /gig replay/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /top-down replay canvas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^play$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip to next song/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip to next highlight/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /skip to result reveal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view result/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/song timeline/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /performers/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /waiting for the first song|beta anthem/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /crowd mood/i })).toBeInTheDocument();
  });

  it("supports keyboard-only control flow and keeps focus available after close", async () => {
    replayResult = { state: "ready", replay: readyReplay };
    const user = userEvent.setup(); const onResult = vi.fn(); const onClose = vi.fn();
    renderViewer({ onViewResult: onResult, onClose });
    await user.tab();
    expect(screen.getByRole("button", { name: /^play$/i })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /^pause$/i })).toBeInTheDocument();
    await user.keyboard("{Enter}");
    const doubleSpeed = screen.getByRole("button", { name: "2×" });
    doubleSpeed.focus();
    await user.keyboard("{Enter}");
    expect(doubleSpeed).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /skip to next song/i }));
    fireEvent.click(screen.getByRole("button", { name: /skip to next highlight/i }));
    fireEvent.click(screen.getByRole("button", { name: /skip to result reveal/i }));
    fireEvent.click(screen.getByRole("button", { name: /view result/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /close viewer/i })[0]);
    expect(onResult).toHaveBeenCalled(); expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ["generating", "Replay processing"], ["failed", "Replay generation failed"], ["unsupported_version", "Unsupported replay version"], ["unavailable", "Replay unavailable"],
  ] as const)("keeps result access available for %s fallbacks", (state, title) => {
    replayResult = { state, replay: null } as GigViewerReplayResult;
    renderViewer();
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view report/i })).toBeInTheDocument();
  });

  it("validates mobile viewport controls, touch target classes, reduced motion, and lifecycle open/close stability", () => {
    replayResult = { state: "ready", replay: readyReplay };
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
    for (let i = 0; i < 10; i++) {
      const onClose = vi.fn(); const { unmount } = renderViewer({ onClose });
      const controls = screen.getByLabelText(/replay controls/i);
      expect(controls.className).toContain("flex-wrap");
      const reduced = screen.getByRole("switch", { name: /reduced motion/i });
      fireEvent.click(reduced);
      expect(reduced).toHaveAttribute("aria-checked", "true");
      fireEvent.click(screen.getByRole("button", { name: /close viewer/i }));
      expect(onClose).toHaveBeenCalled();
      unmount();
    }
  });

  it("exposes semantic timeline state and graph seek targets for automated accessibility checks", () => {
    replayResult = { state: "ready", replay: readyReplay };
    renderViewer();
    const timeline = screen.getByLabelText(/song timeline/i);
    expect(within(timeline).getByRole("button", { name: /1\. beta anthem/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /playback speed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1×" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: /top-down replay canvas/i })).toBeInTheDocument();
  });

  it("renders live presentation playback without result events or result controls", () => {
    const events = readyReplay.events
      .filter((event) => event.eventType !== "result_revealed")
      .map((event, sequence) => ({ ...event, sequence, id: `live-${sequence}` }));
    const presentationReplay: GigViewerReplay = {
      ...readyReplay,
      id: "presentation-release",
      gigOutcomeId: "presentation-gig-release",
      resultAvailable: false,
      durationMs: 9000,
      events,
    };
    const liveExperience = {
      ...experience,
      gig: { ...experience.gig, status: "in_progress", completedAt: null },
      viewer: { ...experience.viewer, ready: false, outcomeId: null, resultReadyAt: null, replayAvailable: false },
    } as GigExperienceDTO;

    renderViewer({ experience: liveExperience, replayOverride: presentationReplay });

    expect(screen.getByRole("heading", { name: /gig viewer/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /top-down replay canvas/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /result/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/result revealed/i)).not.toBeInTheDocument();
  });
});
