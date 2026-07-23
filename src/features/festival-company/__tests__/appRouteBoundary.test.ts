import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.tsx", "utf8");

const legacyFestivalRoutes = [
  "world/festivals",
  "world/festivals/:festivalId",
  "festivals",
  "festivals/marketplace",
  "festivals/directory",
  "festivals/:festivalId",
  "festivals/simulation",
  "festivals/perform/:participationId",
  "festivals/:festivalId/manage",
  "festivals/:festivalId/manage/editions/:editionId",
  "festivals/sessions/:sessionId",
  "festivals/:festivalId/calendar",
  "festivals/:festivalId/run",
];

describe("legacy festival route boundary", () => {
  it("wraps every player-facing legacy festival route in LegacyFestivalGate", () => {
    for (const route of legacyFestivalRoutes) {
      const pattern = new RegExp(
        `<Route\\s+path=\\"${route.replace(/[/:]/g, (match) => `\\${match}`)}\\"\\s+element=\\{<LegacyFestivalGate`,
      );
      expect(appSource, `${route} must be feature gated`).toMatch(pattern);
    }
  });

  it("leaves the admin diagnostic route reachable while aliases redirect to it", () => {
    expect(appSource).toContain('path="admin/festivals" element={<FestivalsAdminPage />}');
    expect(appSource).toContain('path="admin/festival" element={<Navigate to="/admin/festivals" replace />}');
    expect(appSource).toContain('path="admin/festival-admin" element={<Navigate to="/admin/festivals" replace />}');
    expect(appSource).toContain('path="admin/city-festivals" element={<Navigate to="/admin/festivals" replace />}');
  });
});
