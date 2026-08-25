import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const hookSource = fs.readFileSync(
  path.resolve("src/hooks/useBandObjectivesAndLineups.ts"),
  "utf8",
);
const uiSource = fs.readFileSync(
  path.resolve("src/components/bands/BandObjectivesLineupsTab.tsx"),
  "utf8",
);
const managementSource = fs.readFileSync(
  path.resolve("src/pages/bands/[bandId]/management.tsx"),
  "utf8",
);

describe("D5 band objectives and lineup authority", () => {
  it("routes high-value band mutations through authoritative RPCs", () => {
    for (const rpc of [
      "create_band_objective",
      "cancel_band_objective",
      "set_gig_lineup",
      "finalise_gig_lineup",
      "request_gig_lineup_correction",
      "resolve_gig_lineup_correction",
      "get_band_operation_permissions",
    ]) {
      expect(hookSource).toContain(rpc);
    }

    expect(hookSource).not.toContain('.insert(');
    expect(hookSource).not.toContain('.update(');
    expect(hookSource).not.toContain('.delete(');
  });

  it("shows verified objectives, role authority, finalised lineups and correction workflow", () => {
    expect(uiSource).toContain("Progress advances only from verified rehearsals, recording sessions, and gig performances.");
    expect(uiSource).toContain("Roles & authority");
    expect(uiSource).toContain("Authoritative gig lineups");
    expect(uiSource).toContain("Finalise lineup");
    expect(uiSource).toContain("Lineup corrections");
    expect(uiSource).toContain("Chemistry & cohesion history");
  });

  it("keeps post-finalisation changes on the correction path", () => {
    expect(uiSource).toContain("Once finalised, changes require an auditable correction request.");
    expect(uiSource).toContain("Request correction");
    expect(uiSource).toContain("Approve");
    expect(uiSource).toContain("Reject");
  });

  it("exposes D5 in canonical band management", () => {
    expect(managementSource).toContain('import { BandObjectivesLineupsTab }');
    expect(managementSource).toContain('value: "objectives-lineups"');
    expect(managementSource).toContain("<BandObjectivesLineupsTab bandId={bandId} />");
  });
});
