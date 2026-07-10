import { describe, expect, it } from "vitest";
import { getNotificationRoute, normalizeNotification } from "./notificationModels";
import type { PersistedNotification } from "@/hooks/useNotificationsFeed";

const base = (metadata: Record<string, unknown> = {}, action_path: string | null = "/bands/band-1?tab=applications"): PersistedNotification => ({
  id: "n1",
  user_id: "u1",
  profile_id: "p1",
  category: "band",
  type: "band_request",
  title: "New band application",
  message: "A player applied.",
  action_path,
  metadata: { band_id: "band-1", band_application_id: "app-1", ...metadata },
  read_at: null,
  created_at: "2026-07-10T00:00:00Z",
});

describe("notification recruitment normalization", () => {
  it("shows pending application notifications with a valid route", () => {
    const display = normalizeNotification(base({ band_application_status: "pending" }));
    expect(display.statusLabel).toBe("Pending");
    expect(display.routePath).toBe("/bands/band-1");
    expect(display.actionLabel).toBe("Open recruitment");
  });

  it.each([
    ["accepted", "Accepted"],
    ["rejected", "Rejected"],
    ["withdrawn", "Withdrawn"],
  ])("shows final application status %s", (status, label) => {
    const display = normalizeNotification(base({ band_application_status: status }));
    expect(display.statusLabel).toBe(label);
    expect(display.routePath).toBe("/bands/band-1");
  });

  it("normalizes stale legacy application routes when band metadata exists", () => {
    const display = normalizeNotification(base({}, "/bands/band-1?tab=applications"));
    expect(display.routePath).toBe("/bands/band-1");
  });

  it("keeps a controlled null route when a deleted band notification has no destination", () => {
    const display = normalizeNotification(base({ band_id: undefined }, null));
    expect(display.routePath).toBeNull();
    expect(display.actionLabel).toBeNull();
    expect(display.statusLabel).toBe("Pending");
  });

  it("routes applicant notifications to the band profile and manager notifications to recruitment context", () => {
    expect(getNotificationRoute(base({ band_application_status: "accepted" }, "/bands/band-1"))).toBe("/bands/band-1");
    expect(getNotificationRoute(base({ band_application_status: "pending" }, "/bands/band-1?tab=applications"))).toBe("/bands/band-1");
  });

  it("shows invitation final status without inventing actions", () => {
    const display = normalizeNotification(base({ band_invitation_id: "invite-1", band_application_id: undefined, band_invitation_status: "cancelled" }, "/band-manager"));
    expect(display.statusLabel).toBe("Cancelled");
    expect(display.routePath).toBe("/band-manager");
  });
});
