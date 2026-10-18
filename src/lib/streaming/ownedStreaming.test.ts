import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOwnedStreamingReleases,
  getStreamingAnalyticsForReleases,
  getStreamingBandIds,
  STREAMING_QUERY_PAGE_SIZE,
} from "./ownedStreaming";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const user = uuid(1);
const profileA = uuid(2);
const profileB = uuid(3);
const bandA = uuid(4);
const bandB = uuid(5);
const personal = uuid(6);
const other = uuid(7);

type Entry = Record<string, any>;
const db = vi.hoisted(() => ({
  members: [] as Entry[],
  releases: [] as Entry[],
  analytics: [] as Entry[],
  requested: [] as Array<{ table: string; eq: Record<string, unknown>; inFilters: Record<string, string[]>; or: string | null; start: number; end: number }>,
  failingTable: "" as string,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const eq: Record<string, unknown> = {};
      const inFilters: Record<string, string[]> = {};
      let or: string | null = null;
      let start = 0;
      let end = 999;
      const builder = {
        select: (_columns: string) => builder,
        eq: (field: string, value: unknown) => { eq[field] = value; return builder; },
        in: (field: string, values: string[]) => { inFilters[field] = values; return builder; },
        or: (filter: string) => { or = filter; return builder; },
        order: (_field: string, _options?: unknown) => builder,
        range: (from: number, to: number) => { start = from; end = to; return builder; },
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
          db.requested.push({ table, eq: { ...eq }, inFilters: { ...inFilters }, or, start, end });
          if (db.failingTable === table) {
            return Promise.resolve({ data: null, error: new Error("Forbidden or unavailable") }).then(resolve, reject);
          }
          let data: Entry[] = table === "band_members" ? db.members
            : table === "song_releases" ? db.releases : db.analytics;
          data = data.filter((row) => Object.entries(eq).every(([key, value]) => row[key] === value));
          data = data.filter((row) => Object.entries(inFilters).every(([key, ids]) => ids.includes(row[key])));
          if (or) {
            const match = /^user_id\.eq\.([\da-f-]+),band_id\.in\.\(([\da-f,-]+)\)$/.exec(or);
            if (!match) throw new Error("Unsupported PostgREST filter: " + or);
            const bandIds = match[2].split(",");
            data = data.filter((row) => row.user_id === match[1] || bandIds.includes(row.band_id));
          }
          return Promise.resolve({ data: data.slice(start, end + 1), error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  },
}));

describe("character-scoped streaming filters and pagination (#4244)", () => {
  beforeEach(() => {
    db.members = [];
    db.releases = [];
    db.analytics = [];
    db.requested = [];
    db.failingTable = "";
  });

  it("loads an account-owned solo streaming release without needing a band membership", async () => {
    db.releases = [
      { id: uuid(10), user_id: user, band_id: null, release_type: "streaming" },
      { id: uuid(11), user_id: other, band_id: null, release_type: "streaming" },
      { id: uuid(12), user_id: user, band_id: null, release_type: "physical" },
    ];
    const rows = await getOwnedStreamingReleases(user, profileA);
    expect(rows.map((row) => row.id)).toEqual([uuid(10)]);
    expect(db.requested.find((q) => q.table === "song_releases")).toMatchObject({
      eq: { user_id: user, release_type: "streaming" }, or: null,
    });
  });

  it("uses two separate, authenticated, CURRENT-character active band memberships", async () => {
    db.members = [
      { user_id: user, profile_id: profileA, member_status: "active", band_id: bandA },
      { user_id: user, profile_id: profileA, member_status: "active", band_id: bandB },
      { user_id: user, profile_id: profileA, member_status: "inactive", band_id: uuid(8) },
      { user_id: user, profile_id: profileB, member_status: "active", band_id: uuid(9) },
      { user_id: other, profile_id: profileA, member_status: "active", band_id: uuid(10) },
    ];
    db.releases = [
      { id: uuid(20), user_id: user, band_id: null, release_type: "streaming" },
      { id: uuid(21), user_id: other, band_id: bandA, release_type: "streaming" },
      { id: uuid(22), user_id: other, band_id: bandB, release_type: "streaming" },
      { id: uuid(23), user_id: other, band_id: uuid(9), release_type: "streaming" },
      { id: uuid(24), user_id: other, band_id: uuid(8), release_type: "streaming" },
    ];
    expect(await getStreamingBandIds(user, profileA)).toEqual([bandA, bandB]);
    const releases = await getOwnedStreamingReleases(user, profileA);
    expect(releases.map((r) => r.id)).toEqual([uuid(20), uuid(21), uuid(22)]);
    const filter = db.requested.find((q) => q.table === "song_releases")?.or;
    expect(filter).toBe(`user_id.eq.${user},band_id.in.(${bandA},${bandB})`);
    expect(filter).not.toMatch(/select|band_members/i);
  });

  it("does not combine memberships across switched characters", async () => {
    db.members = [
      { user_id: user, profile_id: profileA, member_status: "active", band_id: bandA },
      { user_id: user, profile_id: profileB, member_status: "active", band_id: bandB },
    ];
    db.releases = [
      { id: uuid(25), user_id: other, band_id: bandA, release_type: "streaming" },
      { id: uuid(26), user_id: other, band_id: bandB, release_type: "streaming" },
    ];
    expect((await getOwnedStreamingReleases(user, profileA)).map((r) => r.id)).toEqual([uuid(25)]);
    expect((await getOwnedStreamingReleases(user, profileB)).map((r) => r.id)).toEqual([uuid(26)]);
  });

  it("paginates more than 500 releases, without truncating or duplicating", async () => {
    db.releases = Array.from({ length: 1001 }, (_, n) => ({
      id: uuid(100 + n), user_id: user, band_id: null, release_type: "streaming",
    }));
    const releases = await getOwnedStreamingReleases(user, profileA);
    expect(releases).toHaveLength(1001);
    expect(new Set(releases.map((row) => row.id)).size).toBe(1001);
    expect(db.requested.filter((q) => q.table === "song_releases").map((q) => q.start)).toEqual([0, 500, 1000]);
  });

  it("returns over 5,000 analytics rows across all pages and release batches", async () => {
    const first = uuid(80);
    const second = uuid(81);
    db.analytics = Array.from({ length: 5207 }, (_, n) => ({
      id: uuid(2000 + n), song_release_id: n % 2 === 0 ? first : second,
      analytics_date: "2026-10-17", daily_streams: 1, daily_revenue: 2,
    }));
    const rows = await getStreamingAnalyticsForReleases([first, second], "id, song_release_id, analytics_date, daily_streams, daily_revenue");
    expect(rows).toHaveLength(5207);
    expect(rows.reduce((total, row) => total + row.daily_revenue, 0)).toBe(10414);
    const pages = db.requested.filter((q) => q.table === "streaming_analytics_daily");
    expect(pages).toHaveLength(11);
    expect(pages[0]).toMatchObject({ start: 0, end: STREAMING_QUERY_PAGE_SIZE - 1 });
    expect(pages.at(-1)).toMatchObject({ start: 5000, end: 5499 });
    expect(pages.every((query) => query.inFilters.song_release_id?.length === 2)).toBe(true);
  });

  it("returns no owned data without an active selected character", async () => {
    expect(await getOwnedStreamingReleases(user, "")).toEqual([]);
    expect(await getStreamingAnalyticsForReleases([], "*")).toEqual([]);
    expect(db.requested).toEqual([]);
  });

  it("propagates denied membership and analytics requests instead of returning false empty results", async () => {
    db.failingTable = "band_members";
    await expect(getOwnedStreamingReleases(user, profileA)).rejects.toThrow("Forbidden or unavailable");
    db.failingTable = "streaming_analytics_daily";
    await expect(getStreamingAnalyticsForReleases([uuid(20)], "*")).rejects.toThrow("Forbidden or unavailable");
  });
});
