import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

import { pushNotification } from "../notify";

describe("event notification payload identity", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: "notification-id", error: null });
  });

  it("sends a stable event ID for server-enforced cross-tab deduplication", async () => {
    const result = await pushNotification({
      userId: "user-one",
      profileId: "profile-one",
      category: "achievement",
      title: "Achievement Unlocked",
      eventKey: "achievement:source-row-id",
      metadata: { categoryDetail: "career", event_key: "caller-override" },
    });
    expect(result).toBe("notification-id");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_notification",
      expect.objectContaining({
        p_user_id: "user-one",
        p_profile_id: "profile-one",
        p_metadata: {
          categoryDetail: "career",
          event_key: "achievement:source-row-id",
        },
      }),
    );
  });

  it("supports account-wide VIP notifications without forging a character ID", async () => {
    await pushNotification({
      userId: "user-one",
      profileId: null,
      category: "achievement",
      title: "VIP active",
      eventKey: "vip_activation:subscription-one",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_notification",
      expect.objectContaining({
        p_profile_id: null,
        p_metadata: { event_key: "vip_activation:subscription-one" },
      }),
    );
  });
});
