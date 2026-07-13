import { describe, expect, it, vi, beforeEach } from "vitest";
import { DEFAULT_DISCOVERY_PAGE_SIZE, MAX_DISCOVERY_PAGE_SIZE, normalizeDiscoveryQuery, searchPlayers } from "../services/playerDiscovery";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

beforeEach(() => rpc.mockReset());

describe("player discovery query normalization", () => {
  it("supports contextual pre-applied filters from recruitment routes", () => {
    const query = normalizeDiscoveryQuery({ mode: "band-recruitment", filters: { instrument: "drums", genre: "rock" }, sort: "highest-fame" });
    expect(query.mode).toBe("band-recruitment");
    expect(query.filters).toMatchObject({ lookingForBand: true, instrument: "drums", genre: "rock" });
    expect(query.sort).toBe("highest-fame");
  });

  it("enforces server pagination limits before the RPC call", () => {
    expect(normalizeDiscoveryQuery({ page: -2, pageSize: 999 }).page).toBe(1);
    expect(normalizeDiscoveryQuery({ pageSize: 999 }).pageSize).toBe(MAX_DISCOVERY_PAGE_SIZE);
    expect(normalizeDiscoveryQuery({}).pageSize).toBe(DEFAULT_DISCOVERY_PAGE_SIZE);
  });
});

describe("searchPlayers", () => {
  it("passes privacy-sensitive filtering to the server-side discovery RPC", async () => {
    rpc.mockResolvedValue({ data: { results: [], has_more: false, approximate_total: null }, error: null });
    await searchPlayers({ mode: "session-work", search: "bas", filters: { instrument: "bass", city: "London", onlineNow: true, skillBand: "skilled" } }, "viewer-1");
    expect(rpc).toHaveBeenCalledWith("search_player_discovery", expect.objectContaining({ viewer_profile_id: "viewer-1", query: expect.objectContaining({ mode: "session-work", filters: expect.objectContaining({ sessionAvailable: true, instrument: "bass", city: "London", onlineNow: true, skillBand: "skilled" }) }) }));
  });

  it("maps match reasons without exposing raw private variables", async () => {
    rpc.mockResolvedValue({ data: { has_more: false, approximate_total: null, results: [{ profile_id: "p1", user_id: "u1", character_name: "Rae", preferred_genres: ["indie rock"], availability: ["Looking for a band"], match: { percentage: 86, category: "Strong match", reasons: ["Same city", "Plays bass"] } }] }, error: null });
    const result = await searchPlayers({ mode: "recommended" }, "viewer-1");
    expect(result.results[0].match).toEqual({ percentage: 86, category: "Strong match", reasons: ["Same city", "Plays bass"] });
    expect(JSON.stringify(result.results[0])).not.toContain("raw");
  });
});
