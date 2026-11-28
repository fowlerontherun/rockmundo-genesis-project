import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { isTrackedGameRoute, recordPlayerOpen } from "./playerEngagement";

describe("daily player engagement tracking", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: true, error: null });
  });

  it("counts game and mobile routes but not public or admin traffic", () => {
    expect(isTrackedGameRoute("/dashboard")).toBe(true);
    expect(isTrackedGameRoute("/songwriting")).toBe(true);
    expect(isTrackedGameRoute("/mobile/chat")).toBe(true);
    for (const path of ["/", "/auth", "/about", "/admin/analytics", "/internal/totp-render-frame", "/song/abc"]) {
      expect(isTrackedGameRoute(path)).toBe(false);
    }
  });

  it("records at most one visit per account and UTC day, even across routes", () => {
    recordPlayerOpen("first-account", new Date("2026-11-28T23:59:59Z"));
    recordPlayerOpen("first-account", new Date("2026-11-28T12:00:00Z"));
    recordPlayerOpen("first-account", new Date("2026-11-29T00:00:00Z"));
    recordPlayerOpen("second-account", new Date("2026-11-28T23:59:59Z"));
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledWith("record_player_open");
  });

  it("never records unauthenticated visits", () => {
    recordPlayerOpen("", new Date("2026-11-28T00:00:00Z"));
    expect(rpc).not.toHaveBeenCalled();
  });

  it("allows a later attempt after a telemetry error", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    const time = new Date("2026-12-01T12:00:00Z");
    recordPlayerOpen("retry-account", time);
    await Promise.resolve();
    recordPlayerOpen("retry-account", time);
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
