import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_FAVOURITES,
  getNavigationDestinations,
  isRecentEligiblePath,
  readNavigationStore,
  recordRecentDestination,
  sanitizeInternalPath,
  searchNavigationDestinations,
  toggleFavourite,
} from "../navigationProductivity";

beforeEach(() => localStorage.clear());

describe("navigation productivity metadata", () => {
  it("searches labels, hubs and aliases without exposing admin destinations", () => {
    const userDestinations = getNavigationDestinations("user");
    expect(searchNavigationDestinations(userDestinations, "wellness")[0].path).toBe("/wellness");
    expect(searchNavigationDestinations(userDestinations, "health")[0].path).toBe("/wellness");
    expect(searchNavigationDestinations(userDestinations, "calendar")[0].path).toBe("/schedule");
    expect(searchNavigationDestinations(userDestinations, "admin").some((item) => item.path.startsWith("/admin"))).toBe(false);

    const adminDestinations = getNavigationDestinations("admin");
    expect(adminDestinations.some((item) => item.path.startsWith("/admin"))).toBe(true);
  });

  it("sanitizes internal paths and rejects external injection", () => {
    expect(sanitizeInternalPath("https://evil.example/path")).toBeNull();
    expect(sanitizeInternalPath("//evil.example/path")).toBeNull();
    expect(sanitizeInternalPath("/social/messages?token=secret&tab=inbox")).toBe("/social/messages?tab=inbox");
  });

  it("excludes unsafe routes from recents", () => {
    expect(isRecentEligiblePath("/auth")).toBe(false);
    expect(isRecentEligiblePath("/booking/payment-confirmation")).toBe(false);
    expect(isRecentEligiblePath("/music/songwriting")).toBe(true);
  });
});

describe("navigation productivity persistence", () => {
  it("adds, removes, deduplicates and caps favourites per account", () => {
    for (let i = 0; i < MAX_FAVOURITES + 2; i += 1) {
      toggleFavourite("user-a", { id: `item-${i}`, label: `Item ${i}`, path: `/item-${i}` });
    }
    expect(readNavigationStore("user-a").favourites).toHaveLength(MAX_FAVOURITES);
    toggleFavourite("user-a", { id: "item-3", label: "Item 3", path: "/item-3" });
    expect(readNavigationStore("user-a").favourites.some((item) => item.path === "/item-3")).toBe(false);
    expect(readNavigationStore("user-b").favourites).toHaveLength(0);
  });

  it("records safe recents, moves revisits to the top and recovers from corrupted data", () => {
    recordRecentDestination("user-a", { id: "songwriting", label: "Songwriting", path: "/music/songwriting?draft=secret" });
    recordRecentDestination("user-a", { id: "wellness", label: "Wellness", path: "/wellness" });
    recordRecentDestination("user-a", { id: "auth", label: "Auth", path: "/auth" });
    recordRecentDestination("user-a", { id: "songwriting", label: "Songwriting", path: "/music/songwriting" });
    expect(readNavigationStore("user-a").recents.map((item) => item.path)).toEqual(["/music/songwriting", "/wellness"]);

    localStorage.setItem("rm-navigation-productivity:v1:user-a", "not json");
    expect(readNavigationStore("user-a").recents).toEqual([]);
  });
});
