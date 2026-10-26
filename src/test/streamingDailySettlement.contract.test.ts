import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "supabase/functions/update-daily-streams/index.ts"), "utf8");
const settlement = readFileSync(resolve(process.cwd(), "supabase/migrations/20261026091300_streaming_release_atomic_settlement.sql"), "utf8");
const aggregate = readFileSync(resolve(process.cwd(), "supabase/migrations/20261026092000_aggregate_streaming_analytics_per_platform.sql"), "utf8");

describe("daily streaming settlement recovery contract", () => {
  it("claims a single release per UTC date, rather than the entire catalogue", () => {
    expect(source).toContain('rpc(\n      "claim_next_streaming_release"');
    expect(source).toContain(".eq('id', claimedReleaseId)");
    expect(source).not.toContain('"claim_streaming_simulation_day"');
  });

  it("settles stream counters, analytics, band and label revenues within one transaction", () => {
    expect(source).toContain('"settle_streaming_release_day"');
    expect(source).not.toContain('rpc("increment_song_release_stream_totals"');
    expect(source).not.toContain('rpc("credit_label_revenue_atomic"');
    expect(settlement).toContain("primary key(run_date,song_release_id)");
    expect(settlement).toContain("if v_status='completed' then return false;");
    expect(settlement).toContain("perform public.credit_label_revenue_atomic(");
    expect(settlement).toContain("status='completed', finished_at=now()");
  });

  it("does not restart a warm instance's deadline from an earlier request", () => {
    expect(source).not.toContain("const functionStartedAt = Date.now()");
    expect(source).toContain("if (Date.now() - startedAt > WALL_CLOCK_LIMIT_MS)");
  });

  it("preserves regional analytics without violating the release/day/platform uniqueness rule", () => {
    expect(aggregate).toContain("region_breakdown=p_analytics");
    expect(aggregate).toContain("'all','all'");
  });

  it("only exposes claims and settlements to the service role", () => {
    expect(settlement).toContain("alter table public.streaming_release_day_claims enable row level security");
    expect(settlement).toContain("if auth.role() <> 'service_role'");
    expect(settlement).toContain("revoke all on function public.settle_streaming_release_day");
  });
});
