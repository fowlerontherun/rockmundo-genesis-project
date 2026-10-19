import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const edge = readFileSync("supabase/functions/lottery-draw/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261019064627_lottery_internal_due_time_draw_guard_20261019.sql",
  "utf8",
);
const sqlHarness = readFileSync(
  "supabase/tests/lottery_cron_only_draw_authority_harness.sql",
  "utf8",
);

describe("lottery draw scheduler-only authority (#4224)", () => {
  it("requires a JWT at the Edge gateway and never processes the draw in HTTP", () => {
    expect(config).toMatch(/\[functions\.lottery-draw\]\s*verify_jwt = true/);
    expect(edge).toMatch(/status: 410/);
    expect(edge).toContain("lottery_draw_scheduler_only");
    expect(edge).not.toMatch(/createClient|SERVICE_ROLE_KEY|\.rpc\(|lottery_tickets|update\(/);
  });

  it("keeps a server-side UTC cutoff, a locked draw and transaction-guarded replay", () => {
    expect(migration).toContain("week_start::timestamp + interval '7 days 5 minutes'");
    expect(migration).toContain("now() at time zone 'UTC'");
    expect(migration).toMatch(/order by week_start asc limit 1 for update/);
    expect(migration).toContain("no_due_draw");
    expect(migration).toContain("lottery_draw_invalid_existing_result");
    expect(migration).toContain("lottery_draw_pending_already_has_result");
    expect(migration).toContain("public.settle_lottery_ticket_atomic");
    expect(migration).toMatch(/revoke all on function public\.process_weekly_lottery_draw\(\) from public,anon,authenticated/);
    expect(migration).toMatch(/grant execute on function public\.process_weekly_lottery_draw\(\) to service_role/);
  });

  it("has an executable rollback-only regression harness", () => {
    expect(sqlHarness).toContain("BEGIN;");
    expect(sqlHarness).toContain("ROLLBACK;");
    expect(sqlHarness).toContain("lottery_pre_due_draw_processed");
    expect(sqlHarness).toContain("lottery_replay_mutated_draw");
    expect(sqlHarness).toContain("lottery_existing_result_was_redrawn");
    expect(sqlHarness).toContain("lottery_draw_invalid_existing_result");
  });
});
