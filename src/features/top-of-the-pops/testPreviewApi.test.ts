import { describe, expect, it } from "vitest";
import { isTotpTestPreviewSafe, type TotpAdminTestPreview } from "./testPreviewApi";

const safePreview: TotpAdminTestPreview = {
  mode: "dry_run",
  safe: true,
  chart_snapshot_date: "2026-09-07",
  generated_at: "2026-09-17T20:08:09.000Z",
  seed: "admin-test",
  max_performances: 10,
  eligible_count: 2,
  selected_count: 2,
  previous_episode_id: null,
  side_effects: {
    invitations: false,
    notifications: false,
    rewards: false,
    history: false,
    chart_changes: false,
  },
  performances: [],
};

describe("Top of the Pops admin test preview safety", () => {
  it("accepts only a dry-run response with every gameplay side effect disabled", () => {
    expect(isTotpTestPreviewSafe(safePreview)).toBe(true);
  });

  it("rejects a preview if any gameplay side effect is enabled", () => {
    expect(isTotpTestPreviewSafe({
      ...safePreview,
      side_effects: { ...safePreview.side_effects, rewards: true },
    })).toBe(false);
  });

  it("rejects a response that is not explicitly marked as a safe dry run", () => {
    expect(isTotpTestPreviewSafe({ ...safePreview, safe: false })).toBe(false);
  });
});
