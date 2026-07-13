import { describe, expect, it } from "vitest";
import { BAND_PERMISSION_CATALOGUE, BandPermissionService, DEFAULT_BAND_ROLE_TEMPLATES } from "../band-permissions";

describe("band permissions", () => {
  it("defines stable unique permission keys and default role templates", () => {
    const keys = BAND_PERMISSION_CATALOGUE.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(DEFAULT_BAND_ROLE_TEMPLATES.map((role) => role.roleType)).toContain("band_leader");
    expect(DEFAULT_BAND_ROLE_TEMPLATES.map((role) => role.roleType)).toContain("trial_member");
  });

  it("resolves multiple roles, temporary delegation and direct deny precedence", () => {
    const result = BandPermissionService.resolveEffectivePermissions({
      isActiveMember: true,
      rolePermissions: ["scheduling.create_rehearsal", "finance.view_summary"],
      temporaryPermissions: [{ key: "tours.book_transport", expiresAt: "2030-01-01" }],
      overrides: [{ key: "finance.view_summary", effect: "deny" }],
      now: new Date("2026-07-13"),
    });
    expect(result.allowed.has("scheduling.create_rehearsal")).toBe(true);
    expect(result.allowed.has("tours.book_transport")).toBe(true);
    expect(result.allowed.has("finance.view_summary")).toBe(false);
    expect(result.denied.has("finance.view_summary")).toBe(true);
  });

  it("expires delegations and strips suspended member permissions", () => {
    expect(BandPermissionService.resolveEffectivePermissions({
      isActiveMember: true,
      temporaryPermissions: [{ key: "tours.book_transport", expiresAt: "2026-01-01" }],
      now: new Date("2026-07-13"),
    }).allowed.has("tours.book_transport")).toBe(false);

    expect(BandPermissionService.resolveEffectivePermissions({
      isActiveMember: true,
      isSuspended: true,
      isOwner: true,
    }).allowed.size).toBe(0);
  });

  it("prevents grants at equal or higher risk by default", () => {
    expect(BandPermissionService.canGrant(["finance.view_transactions"], "finance.manage_revenue_splits")).toBe(false);
    expect(BandPermissionService.canGrant(["admin.manage_permissions"], "finance.view_transactions")).toBe(true);
  });
});
