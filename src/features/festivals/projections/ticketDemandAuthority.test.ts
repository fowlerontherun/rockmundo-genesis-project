import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260823094830_festival_server_authoritative_ticket_demand.sql",
  "utf8",
);
const ticketPlanner = readFileSync(
  "src/features/festival-company/ui/FestivalTicketPlanner.tsx",
  "utf8",
);

describe("Festival ticket demand authority", () => {
  it("calculates demand on the server from game-owned inputs", () => {
    expect(migration).toContain("_festival_ticket_demand_basis_points");
    expect(migration).toContain("marketingDemandBasisPoints");
    expect(migration).toContain("reputation_score");
    expect(migration).toContain("marketing_media");
    expect(migration).toContain("v_benchmark_price_minor");
    expect(migration).toMatch(/RETURN greatest\(\s*2500,[\s\S]*least\(\s*9800,/i);
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
      /REVOKE ALL ON FUNCTION public\._festival_ticket_demand_basis_points\(uuid, uuid, bigint\) FROM PUBLIC/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\._festival_ticket_demand_basis_points\(uuid, uuid, bigint\) FROM authenticated/i,
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
