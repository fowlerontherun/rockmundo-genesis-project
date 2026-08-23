import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20291218250300_festival_server_authoritative_ticket_demand.sql",
  "utf8",
);
const reconciliation = readFileSync(
  "supabase/reconciliation/festival/20260823_festival_server_ticket_demand.sql",
  "utf8",
);
const ticketPlanner = readFileSync(
  "src/features/festival-company/ui/FestivalTicketPlanner.tsx",
  "utf8",
);

describe("Festival ticket demand authority", () => {
  it("calculates demand on the server from game-owned inputs", () => {
    for (const source of [migration, reconciliation]) {
      expect(source).toContain("_festival_ticket_demand_basis_points");
      expect(source).toContain("marketingDemandBasisPoints");
      expect(source).toContain("reputation_score");
      expect(source).toContain("marketing_media");
      expect(source).toContain("v_benchmark_price_minor");
      expect(source).toMatch(
        /RETURN greatest\(\s*2500,[\s\S]*least\(\s*9800,/i,
      );
    }
  });

  it("does not read a client supplied sell-through percentage in the save RPC", () => {
    expect(migration).not.toMatch(
      /p_ticket_plan\s*->>\s*'expectedSellThroughBasisPoints'/i,
    );
    expect(migration).toMatch(
      /sellthrough := public\._festival_ticket_demand_basis_points\(/i,
    );
  });

  it("keeps the demand helper private", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\._festival_ticket_demand_basis_points\(uuid, uuid, bigint\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
  });

  it("backfills open forecasts without consuming an owner planning version", () => {
    expect(migration).toMatch(/WHERE e\.status = 'draft'/i);
    expect(migration).toContain("expected_sell_through_basis_points");
    expect(migration).not.toMatch(
      /SET[\s\S]*planning_version\s*=\s*planning_version\s*\+\s*1[\s\S]*FROM recalculated/i,
    );
  });

  it("shows demand as a read-only forecast in the simplified owner flow", () => {
    expect(ticketPlanner).toContain("Forecast sell-through");
    expect(ticketPlanner).toContain(
      "Save your price and availability to recalculate demand.",
    );
    expect(ticketPlanner).not.toContain('id="festival-expected-demand"');
    expect(ticketPlanner).not.toContain("Expected sell-through (%)");
  });
});
