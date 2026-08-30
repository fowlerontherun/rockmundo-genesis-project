// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchPath } from "react-router-dom";

import { festivalRoutePatterns } from "@/features/festivals/routes";
import { FM_MODULES, resolveModuleForPath } from "../fmNavigation";

const appSource = readFileSync("src/App.tsx", "utf8");
const layoutStart = appSource.indexOf('<Route element={<Layout />}>');
const layoutEnd = appSource.indexOf('<Route path="*" element={<NotFound />} />', layoutStart);
const authenticatedRouteSource = appSource
  .slice(layoutStart, layoutEnd)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const materialisePattern = (pattern: string) => {
  const withParams = pattern.replace(/:[A-Za-z][A-Za-z0-9]*/g, "audit-id");
  return `/${withParams.replace(/\*$/, "audit-child")}`.replace(/\/{2,}/g, "/");
};

const literalAuthenticatedRoutes = Array.from(
  authenticatedRouteSource.matchAll(/<Route\s+path="([^"]+)"/g),
  (match) => match[1],
).filter((path) => path !== "*");

const dynamicAuthenticatedRoutes = Object.values(festivalRoutePatterns);

const adminBoundaryStart = appSource.indexOf("{/* P2 admin route boundary start */}", layoutStart);
const adminBoundaryEnd = appSource.indexOf("{/* P2 admin route boundary end */}", adminBoundaryStart);
const protectedAdminRouteSource = appSource
  .slice(adminBoundaryStart, adminBoundaryEnd)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const protectedLiteralAdminRoutes = Array.from(
  protectedAdminRouteSource.matchAll(/<Route\s+path="([^"]+)"/g),
  (match) => match[1],
);

const matchingModulesAtBestSpecificity = (pathname: string) => {
  const matches = FM_MODULES.flatMap((module) =>
    module.matchPaths
      .filter((pattern) =>
        matchPath({ path: pattern, end: false }, pathname)
        || pathname === pattern
        || pathname.startsWith(`${pattern}/`),
      )
      .map((pattern) => ({ moduleId: module.id, specificity: pattern.length })),
  );
  const bestSpecificity = Math.max(...matches.map((match) => match.specificity));
  return [...new Set(
    matches
      .filter((match) => match.specificity === bestSpecificity)
      .map((match) => match.moduleId),
  )];
};

describe("authenticated route ownership audit", () => {
  it("assigns every literal authenticated App route to an explicit module", () => {
    const unowned = [...literalAuthenticatedRoutes, ...dynamicAuthenticatedRoutes]
      .map(materialisePattern)
      .filter((pathname) => !resolveModuleForPath(pathname));

    expect(unowned).toEqual([]);
  });

  it("does not declare duplicate literal authenticated routes", () => {
    const duplicates = literalAuthenticatedRoutes.filter(
      (route, index) => literalAuthenticatedRoutes.indexOf(route) !== index,
    );

    expect(duplicates).toEqual([]);
  });

  it("does not rely on module declaration order to resolve route ownership", () => {
    const ambiguous = [...literalAuthenticatedRoutes, ...dynamicAuthenticatedRoutes]
      .map(materialisePattern)
      .map((pathname) => ({ pathname, moduleIds: matchingModulesAtBestSpecificity(pathname) }))
      .filter(({ moduleIds }) => moduleIds.length > 1);

    expect(ambiguous).toEqual([]);
  });

  it("protects every admin route with one route-level authority boundary", () => {
    const literalAdminRoutes = literalAuthenticatedRoutes.filter(
      (route) => route === "admin" || route.startsWith("admin/"),
    );

    expect(adminBoundaryStart).toBeGreaterThan(layoutStart);
    expect(adminBoundaryEnd).toBeGreaterThan(adminBoundaryStart);
    expect(protectedLiteralAdminRoutes).toEqual(literalAdminRoutes);
    expect(protectedLiteralAdminRoutes.every(
      (route) => route === "admin" || route.startsWith("admin/"),
    )).toBe(true);

    for (const routeName of ["admin", "adminCompany", "adminEdition"] as const) {
      expect(protectedAdminRouteSource).toContain(`festivalRoutePatterns.${routeName}`);
    }
  });

  it("keeps legacy Social and Media deep links as query-preserving redirects", () => {
    const aliases = [
      ["players/search", "/social/players"],
      ["community/friends", "/social/friends"],
      ["community/players", "/social/players"],
      ["community/bands/recruitment", "/social/recruitment"],
      ["community/invitations", "/social/invitations"],
      ["hub/media", "/media"],
    ] as const;

    for (const [legacyPath, canonicalPath] of aliases) {
      expect(authenticatedRouteSource).toContain(
        `path="${legacyPath}" element={<PreserveQueryRedirect to="${canonicalPath}" />}`,
      );
    }
  });
});
