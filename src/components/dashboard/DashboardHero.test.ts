import { describe, expect, it } from "vitest";
import { buildNextActions } from "./DashboardHero";

describe("dashboard next action for unfinished music", () => {
  it("sends a returning player to their songwriting projects, with accurate progress", () => {
    const actions = buildNextActions(
      { energy: 100, health: 100, fame: 300, cash: 1_000 },
      {
        unread: 0,
        unreadInbox: 0,
        pendingGigsToday: 0,
        pendingOffers: 0,
        currentProject: { title: "First Single", status: "writing", music_progress: 1_000, lyrics_progress: 500 },
        songCount: 0,
      },
    );

    expect(actions[0]).toMatchObject({
      label: "Continue “First Single”",
      description: "38% complete. Pick up where you left off.",
      to: "/songwriting",
    });
  });

  it("offers a first song before an impossible first gig for a new musician", () => {
    const actions = buildNextActions(
      { energy: 100, health: 100, fame: 0, cash: 1_000 },
      { unread: 0, unreadInbox: 0, pendingGigsToday: 0, pendingOffers: 0, currentProject: null, songCount: 0 },
    );

    expect(actions[0]).toMatchObject({
      label: "Start your first song",
      to: "/songwriting",
      cta: "Create a song",
    });
  });
});
