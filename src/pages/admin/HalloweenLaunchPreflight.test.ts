import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Prevent future UI refactors from exposing a one-click unchecked launch.
// The isolated PostgreSQL workflow exercises the actual SQL permissions.
const root = path.resolve(__dirname, "../../..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const ui = read("src/pages/admin/SystemStatus.tsx");
const sql = read("supabase/migrations/20261016120000_halloween_2026_admin_launch_preflight.sql");
const serviceRoleFix = read("supabase/migrations/20261016121000_halloween_2026_preflight_service_role_console.sql");

describe("Halloween live-event launch protection", () => {
  it("uses a database-backed preflight and separately confirms real-world gig checks", () => {
    expect(ui).toContain('rpc("admin_halloween_2026_launch_preflight")');
    expect(ui).toContain("halloweenPreflight?.database_ready");
    expect(ui).toContain("confirmedLiveGig");
    expect(ui).toContain("I verified the deployed Edge Functions, automated XP/achievement tests and a genuine gig-start/replay");
    expect(ui).toContain("setHalloweenRewardsReady");
    expect(ui).toContain('rewards_live: halloweenRewardsReady');
  });

  it("will not publish public event announcements while rewards are unarmed", () => {
    expect(ui).toContain("if (halloweenEnabled && !halloweenRewardsReady)");
    expect(ui).toContain('Cannot announce Halloween while server-side gig rewards are disabled.');
    expect(ui).toContain('if (halloweenRewardsReady && !halloweenPreflight?.database_ready)');
    expect(ui).toContain("if (halloweenRewardsReady && !data.halloween.rewards_live && !confirmedLiveGig)");
  });

  it("does not mistake DB readiness for deployed function or stage playback sign-off", () => {
    expect(sql).toContain("It cannot certify an Edge Function deployment or a visual smoke test");
    expect(ui).toContain("database checks alone");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.admin_halloween_2026_launch_preflight()");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.admin_halloween_2026_launch_preflight()");
    expect(sql).toContain("public.has_role((SELECT auth.uid()), 'admin'::public.app_role)");
    expect(sql).toContain("RAISE EXCEPTION 'admin_only'");
    expect(sql).not.toContain("UPDATE public.system_settings");
    expect(serviceRoleFix).toContain("pg_catalog.current_setting('role',true) IS DISTINCT FROM 'service_role'");
    expect(serviceRoleFix).toContain("public.has_role((SELECT auth.uid()), 'admin'::public.app_role)");
  });
});
