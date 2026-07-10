import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
  },
}));

import { awardActionXp } from "./progression";

describe("awardActionXp", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue({
      data: {
        success: true,
        action: "award_action_xp",
        profile: {},
        wallet: null,
        attributes: null,
        cooldowns: {},
      },
      error: null,
    });
  });

  it("passes a unique event id to the progression edge function for idempotency", async () => {
    await awardActionXp({
      amount: 15,
      category: "education",
      actionKey: "youtube_video",
      uniqueEventId: "education-video:profile-1:lesson-1:123",
      metadata: { video_id: "lesson-1" },
    });

    expect(invoke).toHaveBeenCalledWith("progression", {
      body: expect.objectContaining({
        action: "award_action_xp",
        amount: 15,
        category: "education",
        action_key: "youtube_video",
        event_id: "education-video:profile-1:lesson-1:123",
        metadata: { video_id: "lesson-1" },
      }),
    });
  });

  it("surfaces failed authoritative XP awards", async () => {
    invoke.mockResolvedValueOnce({
      data: { success: false, message: "Failed to log XP in ledger" },
      error: null,
    });

    await expect(
      awardActionXp({ amount: 15, uniqueEventId: "duplicate-safe-ref" }),
    ).rejects.toThrow("Failed to log XP in ledger");
  });
});
