import { describe, expect, it } from "vitest";

import { isHubNavigationItemActive } from "@/components/hub/HubLayout";
import { bandHubNavigation } from "../hubNavigation";

const byId = (id: string) => {
  const item = bandHubNavigation.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing band navigation item ${id}`);
  return item;
};

describe("band hub navigation consolidation", () => {
  it("uses /band as the canonical overview landing route", () => {
    const overview = byId("overview");
    expect(overview.path).toBe("/band");
    expect(isHubNavigationItemActive("/band", overview)).toBe(true);
    expect(isHubNavigationItemActive("/band/overview", overview)).toBe(true);
  });

  it("selects consolidated child pages and legacy aliases", () => {
    expect(isHubNavigationItemActive("/band/members", byId("members"))).toBe(true);
    expect(isHubNavigationItemActive("/band/repertoire", byId("repertoire"))).toBe(true);
    expect(isHubNavigationItemActive("/setlists", byId("repertoire"))).toBe(true);
    expect(isHubNavigationItemActive("/rehearsals", byId("rehearsals"))).toBe(true);
    expect(isHubNavigationItemActive("/gigs/perform/gig-1", byId("gigs"))).toBe(true);
    expect(isHubNavigationItemActive("/tour-manager", byId("tours"))).toBe(true);
    expect(isHubNavigationItemActive("/band-crew", byId("equipment"))).toBe(true);
    expect(isHubNavigationItemActive("/chemistry", byId("chemistry"))).toBe(true);
  });

  it("keeps music-owned creation routes out of band navigation", () => {
    const paths = bandHubNavigation.flatMap((item) => [item.path, ...(item.matchPaths ?? [])]);
    expect(paths).not.toContain("/songwriting");
    expect(paths).not.toContain("/recording-studio");
    expect(paths).not.toContain("/release-manager");
  });
});
