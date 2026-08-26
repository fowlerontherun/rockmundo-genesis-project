import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const panelPath = path.resolve(process.cwd(), "src/components/tours/LiveTourHQPanel.tsx");
const detailPath = path.resolve(process.cwd(), "src/components/tours/TourDetailPanel.tsx");
const panel = fs.readFileSync(panelPath, "utf8");
const detail = fs.readFileSync(detailPath, "utf8");

describe("E1 live Tour HQ authority", () => {
  it("loads Tour HQ through the permission checked RPC", () => {
    expect(panel).toContain('rpc("get_tour_hq_live"');
    expect(panel).not.toContain('.from("tour_venues")');
    expect(panel).not.toContain('.from("tour_logistics")');
    expect(panel).not.toContain('.from("tour_travel_legs")');
  });

  it("provides loading, retry and periodic refresh behaviour", () => {
    expect(panel).toContain("query.isLoading");
    expect(panel).toContain("query.isError");
    expect(panel).toContain("query.refetch()");
    expect(panel).toContain("refetchInterval: 60_000");
  });

  it("is wired into the existing tour detail journey", () => {
    expect(detail).toContain('import { LiveTourHQPanel }');
    expect(detail).toContain("<LiveTourHQPanel tourId={tour.id} />");
  });
});
