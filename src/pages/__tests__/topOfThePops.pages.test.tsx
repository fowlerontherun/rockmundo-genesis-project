import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { TotpEpisode, TotpInvitation } from "@/features/top-of-the-pops/api";

const { episode, invitation } = vi.hoisted(() => {
const episode: TotpEpisode = {
  id: "11111111-1111-4111-8111-111111111111",
  episode_number: 12,
  episode_date: "2026-09-19",
  status: "locked",
  check_in_at: "2026-09-19T18:00:00Z",
  broadcast_at: "2026-09-19T19:00:00Z",
  presenter_key: "alex_rayne",
  broadcast_profile: "standard",
  performances: [
    {
      performance_id: "22222222-2222-4222-8222-222222222222",
      running_order: 1,
      band_id: "33333333-3333-4333-8333-333333333333",
      band_name: "The Kestrels",
      song_id: "44444444-4444-4444-8444-444444444444",
      song_title: "Opening Night",
      stage_key: "main_stage",
      presenter_intro: "Straight in at number one!",
      qualifying_rank: 1,
    },
  ],
};

const invitation: TotpInvitation = {
  invitation_id: "55555555-5555-4555-8555-555555555555",
  episode_id: episode.id,
  episode_date: episode.episode_date,
  check_in_at: episode.check_in_at,
  broadcast_at: episode.broadcast_at,
  band_id: episode.performances[0].band_id,
  band_name: "The Kestrels",
  song_id: episode.performances[0].song_id,
  song_title: "Opening Night",
  qualifying_rank: 1,
  status: "invited",
  response_deadline: "2026-09-19T17:00:00Z",
  london_city_id: "66666666-6666-4666-8666-666666666666",
  london_city_name: "London",
};
return { episode, invitation };
});

vi.mock("@/features/top-of-the-pops/api", () => ({
  listMyTotpInvitations: vi.fn().mockResolvedValue([invitation]),
  respondToTotpInvitation: vi.fn(),
  checkInToTotp: vi.fn(),
  getTotpEpisode: vi.fn().mockResolvedValue(episode),
  getTotpBroadcastArchive: vi.fn().mockResolvedValue({ episode_id: episode.id, replays: [] }),
  getTotpPublicHistory: vi.fn().mockResolvedValue([]),
  getTotpPerformanceAudio: vi.fn().mockResolvedValue({ audio_url: "https://cdn/a.mp3", audio_generation_status: "complete", duration_seconds: 180 }),
  adminLockTotpRunningOrder: vi.fn(),
  adminBuildTotpBroadcastArchive: vi.fn(),
  adminCompleteTotpPerformance: vi.fn(),
  canRespondToTotpInvitation: () => true,
  canAttemptTotpCheckIn: () => false,
}));

vi.mock("@/features/top-of-the-pops/chartRundownApi", () => ({
  getTotpChartRundown: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/top-of-the-pops/releaseHealthApi", () => ({
  getTotpReleaseHealth: vi.fn().mockResolvedValue({
    healthy: true,
    chart: { latest_date: "2026-09-18", fresh: true, streaming_rows: 40, digital_rows: 40 },
    next_episode: null,
    crons: { prepare: true, uk_chart_refresh: true, broadcast_cycle: true },
    invalid_totp_notifications: 0,
    checked_at: "2026-09-19T09:00:00Z",
  }),
  totpHealthFailures: () => [],
}));

vi.mock("@/features/top-of-the-pops/episodeManifestApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/top-of-the-pops/episodeManifestApi")>();
  return {
    ...actual,
    getStoredTotpEpisodeManifest: vi.fn().mockResolvedValue(null),
    saveTotpEpisodeManifest: vi.fn(),
  };
});

vi.mock("@/features/top-of-the-pops/renderQueueApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/top-of-the-pops/renderQueueApi")>();
  return {
    ...actual,
    getTotpRenderJobs: vi.fn().mockResolvedValue([]),
    enqueueTotpRender: vi.fn(),
    cancelTotpRender: vi.fn(),
  };
});


vi.mock("@/features/top-of-the-pops/TotpArchivePlayer", () => ({ TotpArchivePlayer: () => <div /> }));
vi.mock("@/features/top-of-the-pops/TotpFullEpisodePlayer", () => ({ TotpFullEpisodePlayer: () => <div /> }));
vi.mock("@/features/top-of-the-pops/TotpBroadcastStatusCard", () => ({ TotpBroadcastStatusCard: () => <div /> }));
vi.mock("@/features/top-of-the-pops/TotpBackstageInterviewCard", () => ({ TotpBackstageInterviewCard: () => <div /> }));
vi.mock("@/features/top-of-the-pops/TotpLiveTvExtrasCard", () => ({ TotpLiveTvExtrasCard: () => <div /> }));
vi.mock("@/features/top-of-the-pops/TotpStudioReadinessCard", () => ({ TotpStudioReadinessCard: () => <div /> }));
vi.mock("@/features/top-of-the-pops/TotpTestEpisodeCard", () => ({ TotpTestEpisodeCard: () => <div /> }));
vi.mock("@/features/top-of-the-pops/TotpMediaManager", () => ({ TotpMediaManager: () => <div /> }));

import TopOfThePops from "@/pages/TopOfThePops";
import TopOfThePopsAdmin from "@/pages/admin/TopOfThePopsAdmin";

function renderPage(ui: React.ReactElement, initialEntry = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("Top of the Pops pages", () => {
  it("shows the player's invitation and the scheduled episode", async () => {
    renderPage(<TopOfThePops />);

    await waitFor(() => expect(screen.getAllByText(/The Kestrels/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Opening Night/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/London time/i).length).toBeGreaterThanOrEqual(3);
  });

  it("renders the admin episode with the stored running sheet panel", async () => {
    const { container } = renderPage(<TopOfThePopsAdmin />, "/admin/top-of-the-pops#production");

    await waitFor(() => expect(screen.getByRole("tab", { name: /Production/i })).toHaveAttribute("data-state", "active"));
    await waitFor(() => expect(container.querySelector("[data-totp-running-sheet]")).not.toBeNull());
    expect(screen.getByText(/Episode running sheet/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/Not saved/i).length).toBeGreaterThan(0));
    await waitFor(() => expect(container.querySelector("[data-totp-rehearsal]")).not.toBeNull());
    expect(screen.getByRole("button", { name: /Run full rehearsal render/i })).toBeDisabled();
    await waitFor(() => expect(container.querySelector("[data-totp-render-queue]")).not.toBeNull());
    expect(screen.getByRole("button", { name: /Render episode file/i })).toBeDisabled();
  });
});