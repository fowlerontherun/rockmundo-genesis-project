import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const apiSource = readFileSync("src/lib/api/tourOperations.ts", "utf8");
const panelSource = readFileSync("src/components/tours/LiveTourHQPanel.tsx", "utf8");
const detailSource = readFileSync("src/components/tours/TourDetailPanel.tsx", "utf8");

describe("Live Tour HQ authority boundary", () => {
  it("routes every operation through the seven authenticated RPCs", () => {
    const requiredRpcs = [
      "get_tour_operations_workspace",
      "save_tour_operation_template",
      "save_tour_operations_plan",
      "apply_tour_operation_template",
      "record_tour_logistics_event",
      "resolve_tour_logistics_event",
      "complete_tour_operations_report",
    ];

    for (const rpc of requiredRpcs) {
      expect(apiSource, `missing RPC: ${rpc}`).toContain(`supabase.rpc("${rpc}"`);
    }

    expect(apiSource).not.toMatch(/\.from\(["']tour_(?:operation|crew|equipment|merchandise|sponsor|logistics|budget|completion)/);
    expect(panelSource).not.toContain("supabase.from");
    expect(panelSource).not.toContain("as any");
  });

  it("keeps reconnect, optimistic-version and read-only behaviour explicit", () => {
    expect(panelSource).toContain("refetchInterval: 60_000");
    expect(panelSource).toContain("refetchOnWindowFocus: true");
    expect(panelSource).toContain("workspace.state.plan_version !== draftVersion");
    expect(panelSource).toContain("only a band leader or manager");
    expect(panelSource).toContain("canonical cost, fatigue and morale effects");
  });

  it("mounts the same workspace for every supported tour-history state", () => {
    expect(detailSource).toContain('import { LiveTourHQPanel }');
    expect(detailSource).toContain('["scheduled", "active", "completed", "cancelled"]');
    expect(detailSource).toContain("<LiveTourHQPanel tourId={tour.id} tourStatus={tour.status} />");
  });
});
