import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const migration = read("../../../supabase/migrations/20261013190000_one_current_random_event.sql");
const attendance = read("../../../supabase/functions/book-reading-attendance/index.ts");

describe("event and reading safeguards", () => {
  it("#2612 rejects concurrent current-event assignments per account", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS player_events_one_current_event_per_account");
    expect(migration).toContain("ON public.player_events(user_id)");
    expect(migration).toContain("status IN ('pending_choice','awaiting_outcome')");
    expect(migration).toContain("2026-10-09");
  });

  it("#2652 prevents untrusted global reading requests", () => {
    expect(attendance).toContain('const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")');
    expect(attendance).toContain('req.headers.get("x-cron-secret")');
    expect(attendance).toContain('rpc("verify_internal_cron_secret"');
    expect(attendance).toContain('if ((!serviceRoleKey || bearer !== serviceRoleKey) && !cronAuthorized)');
    expect(attendance).toContain("status: 403");
    expect(attendance).toContain(".eq(\"user_id\", auth.user.id)");
  });
});
