import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.tsx", "utf8");

const retiredLegacyFestivalRoutes = [
  "festivals/marketplace",
  "festivals/directory",
  "festivals/perform/:participationId",
  "festivals/sessions/:sessionId",
];

describe("legacy festival route boundary", () => {
  it("retires every legacy festival gameplay route with a redirect instead of a legacy page", () => {
    for (const route of retiredLegacyFestivalRoutes) {
      expect(appSource, `${route} must redirect to the canonical directory`).toContain(
        `path="${route}" element={<PreserveQueryRedirect to={festivalRoutes.publicDirectory()} />}`,
      );
    }
    expect(appSource).toContain(
      'path="festivals/:festivalId" element={<LegacyFestivalRedirect target="overview" />}',
    );
    expect(appSource).not.toContain("LegacyFestivalGate");
  });

  it("redirects retired discovery routes without mounting a legacy writer", () => {
    expect(appSource).toContain(
      'path="festivals/simulation" element={<PreserveQueryRedirect to={festivalRoutes.publicDirectory()} />}',
    );
    expect(appSource).not.toMatch(/festivals\/simulation[^\n]+<FestivalsNew/);
  });

  it("leaves the admin diagnostic route reachable while aliases redirect to it", () => {
    expect(appSource).toContain('path={festivalRoutePatterns.admin} element={<FestivalsAdminPage />}');
    expect(appSource).toContain('path="admin/festival" element={<Navigate to="/admin/festivals" replace />}');
    expect(appSource).toContain('path="admin/festival-admin" element={<Navigate to="/admin/festivals" replace />}');
    expect(appSource).toContain('path="admin/city-festivals" element={<Navigate to="/admin/festivals" replace />}');
  });
});
