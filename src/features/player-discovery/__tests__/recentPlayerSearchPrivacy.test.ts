import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearRecentPlayerSearches,
  getRecentPlayerSearches,
  recentPlayerSearchStorageKey,
  recordRecentPlayerSearch,
} from "../services/playerDiscovery";

const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  });
});

describe("recent player discovery account boundaries", () => {
  it("never shows one signed-in account another account's recent searches", async () => {
    recordRecentPlayerSearch(alice, { search: "private person" });
    expect(await getRecentPlayerSearches(bob)).toEqual([]);
    recordRecentPlayerSearch(bob, { search: "other person" });
    expect(await getRecentPlayerSearches(alice)).toEqual([{ search: "private person" }]);
    expect(await getRecentPlayerSearches(bob)).toEqual([{ search: "other person" }]);
  });
  it("does not import a shared legacy search history into any account", async () => {
    store.set("rockmundo:recent-player-searches", '[{"search":"legacy secret"}]');
    expect(await getRecentPlayerSearches(alice)).toEqual([]);
    recordRecentPlayerSearch(alice, { search: "own query" });
    expect(store.has("rockmundo:recent-player-searches")).toBe(false);
  });
  it("clears only the specified account and tolerates malformed local storage", async () => {
    recordRecentPlayerSearch(alice, { search: "a" });
    recordRecentPlayerSearch(bob, { search: "b" });
    await clearRecentPlayerSearches(alice);
    expect(await getRecentPlayerSearches(alice)).toEqual([]);
    expect(await getRecentPlayerSearches(bob)).toEqual([{ search: "b" }]);
    store.set(recentPlayerSearchStorageKey(bob), "{corrupted");
    expect(await getRecentPlayerSearches(bob)).toEqual([]);
  });
  it("does not write unauthenticated browser sessions", () => {
    expect(() => recordRecentPlayerSearch("", { search: "orphan" })).toThrow("authenticated");
    expect(store.size).toBe(0);
  });
});
