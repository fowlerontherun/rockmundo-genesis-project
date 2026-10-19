import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenMicSongSelector } from "./OpenMicSongSelector";
import { filterBattleOfTheBandsSongs } from "@/lib/botbSongEligibility";
import type { BandAvailableSong } from "@/hooks/useBandAvailableSongs";

const mock = vi.hoisted(() => ({
  fetchBandAvailableSongs: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/hooks/useBandAvailableSongs", () => ({
  fetchBandAvailableSongs: mock.fetchBandAvailableSongs,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mock.from } }));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <section aria-label="song selector">{children}</section> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, disabled }: { checked: boolean; disabled: boolean }) =>
    <input type="checkbox" checked={checked} disabled={disabled} readOnly />,
}));

const bandA = "band-a";
const bandB = "band-b";
const profileA = "profile-a";
const profileB = "profile-b";

function song(id: string, band_id: string | null, archived: boolean | null = false): BandAvailableSong {
  return {
    id, band_id, archived, title: id, genre: "Rock", duration_seconds: 180,
    duration_display: "3:00", quality_score: 75, profile_id: profileA,
    user_id: "account-1", status: "draft", version: null, parent_song_id: null,
  };
}

const fixture = [
  song("assigned-one", bandA),
  song("assigned-two", bandA, null),
  song("other-band", bandB),
  song("member-unassigned", null),
  song("archived-assigned", bandA, true),
];

function mountSelector({
  bandId = bandA, profileId = profileA, performanceType = "battle",
  onConfirm = vi.fn(), onOpenChange = vi.fn(),
}: {
  bandId?: string | null; profileId?: string | null;
  performanceType?: "battle" | "open-mic";
  onConfirm?: ReturnType<typeof vi.fn>; onOpenChange?: ReturnType<typeof vi.fn>;
} = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const props = { open: true, bandId, profileId, performanceType, onConfirm, onOpenChange };
  const view = render(
    <QueryClientProvider client={client}>
      <OpenMicSongSelector {...props} />
    </QueryClientProvider>,
  );
  return {
    ...view, props, client,
    rerenderWith: (change: Partial<typeof props>) => {
      Object.assign(props, change);
      view.rerender(
        <QueryClientProvider client={client}>
          <OpenMicSongSelector {...props} />
        </QueryClientProvider>,
      );
    },
  };
}

describe("Battle of the Bands song eligibility (#4274)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.fetchBandAvailableSongs.mockImplementation(async (bandId: string) =>
      bandId === bandA ? fixture : [song("second-band-one", bandB), song("second-band-two", bandB)],
    );
  });

  it("matches the live entry RPC rule: only unarchived songs assigned to the entering band", () => {
    expect(filterBattleOfTheBandsSongs(fixture, bandA).map((x) => x.id))
      .toEqual(["assigned-one", "assigned-two"]);
    expect(filterBattleOfTheBandsSongs(fixture, bandB).map((x) => x.id))
      .toEqual(["other-band"]);
  });

  it("shows only two valid band-owned songs and confirms their distinct IDs", async () => {
    const onConfirm = vi.fn();
    mountSelector({ onConfirm });
    expect(await screen.findByText("assigned-one")).toBeInTheDocument();
    expect(screen.getByText("assigned-two")).toBeInTheDocument();
    expect(screen.queryByText("member-unassigned")).not.toBeInTheDocument();
    expect(screen.queryByText("other-band")).not.toBeInTheDocument();
    expect(screen.queryByText("archived-assigned")).not.toBeInTheDocument();
    expect(screen.getByText(/must first be assigned to the band/)).toBeInTheDocument();

    await userEvent.click(screen.getByText("assigned-one"));
    expect(screen.getByRole("button", { name: "Confirm Selection" })).toBeDisabled();
    await userEvent.click(screen.getByText("assigned-two"));
    await userEvent.click(screen.getByRole("button", { name: "Confirm Selection" }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("assigned-one", "assigned-two");
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("does not weaken the existing open-mic repertoire policy", async () => {
    mountSelector({ performanceType: "open-mic" });
    expect(await screen.findByText("member-unassigned")).toBeInTheDocument();
    expect(screen.getByText("assigned-one")).toBeInTheDocument();
    expect(screen.getByText(/open mic performance/)).toBeInTheDocument();
  });

  it("explains why unassigned member songs cannot be used when no assigned repertoire exists", async () => {
    mock.fetchBandAvailableSongs.mockResolvedValueOnce([song("only-member", null)]);
    mountSelector();
    expect(await screen.findByText(/No eligible band-assigned songs/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Selection" })).toBeDisabled();
    expect(screen.queryByText("only-member")).not.toBeInTheDocument();
  });

  it("blocks submission and provides an explicit retry when the song query fails", async () => {
    mock.fetchBandAvailableSongs.mockRejectedValueOnce(new Error("Permission denied"));
    mountSelector();
    expect(await screen.findByRole("alert")).toHaveTextContent("Permission denied");
    expect(screen.getByRole("button", { name: "Confirm Selection" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Retry songs" }));
    expect(await screen.findByText("assigned-one")).toBeInTheDocument();
    expect(mock.fetchBandAvailableSongs).toHaveBeenCalledTimes(2);
  });

  it("clears selected songs on band changes, never submitting stale band IDs", async () => {
    const onConfirm = vi.fn();
    const view = mountSelector({ onConfirm });
    await screen.findByText("assigned-one");
    await userEvent.click(screen.getByText("assigned-one"));
    await userEvent.click(screen.getByText("assigned-two"));
    expect(screen.getByRole("button", { name: "Confirm Selection" })).toBeEnabled();
    view.rerenderWith({ bandId: bandB });
    expect(await screen.findByText("second-band-one")).toBeInTheDocument();
    expect(screen.queryByText("assigned-one")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Selection" })).toBeDisabled();
    await userEvent.click(screen.getByText("second-band-one"));
    await userEvent.click(screen.getByText("second-band-two"));
    await userEvent.click(screen.getByRole("button", { name: "Confirm Selection" }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith("second-band-one", "second-band-two");
  });

  it("clears prior selection on character changes without reusing the previous query's selected IDs", async () => {
    const onConfirm = vi.fn();
    const view = mountSelector({ onConfirm });
    await screen.findByText("assigned-one");
    await userEvent.click(screen.getByText("assigned-one"));
    view.rerenderWith({ profileId: profileB });
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirm Selection" })).toBeDisabled());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(mock.fetchBandAvailableSongs).toHaveBeenCalledTimes(2);
  });

  it("never falls back to solo songs when the band or profile becomes unavailable", async () => {
    const onConfirm = vi.fn();
    const view = mountSelector({ onConfirm });
    await screen.findByText("assigned-one");
    view.rerenderWith({ bandId: null });
    expect(screen.getByRole("button", { name: "Confirm Selection" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("prevents selecting the same song twice as both entries", async () => {
    const onConfirm = vi.fn();
    mountSelector({ onConfirm });
    await screen.findByText("assigned-one");
    await userEvent.click(screen.getByText("assigned-one"));
    await userEvent.click(screen.getByText("assigned-one"));
    expect(screen.getByRole("button", { name: "Confirm Selection" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
