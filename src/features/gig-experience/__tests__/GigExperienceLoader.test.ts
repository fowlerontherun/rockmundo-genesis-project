import { describe, expect, it, vi } from "vitest";
import { getGigExperience } from "../services/GigExperienceService";
import {
  GigExperienceLoadError,
  getGigExperienceErrorDisplay,
} from "../diagnostics";

vi.mock("@/lib/logger", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const gigId = "11111111-1111-4111-8111-111111111111";
const outcomeId = "22222222-2222-4222-8222-222222222222";

const gig = {
  id: gigId,
  band_id: "band-1",
  venue_id: "venue-1",
  setlist_id: "setlist-1",
  status: "completed",
  scheduled_date: "2026-08-10T20:00:00Z",
  started_at: "2026-08-10T20:00:00Z",
  completed_at: "2026-08-10T22:00:00Z",
  ticket_price: 20,
  venues: { id: "venue-1", name: "Legacy Hall", location: "London", capacity: 100, venue_type: "club", city_id: "city-1" },
};

const outcome = {
  id: outcomeId,
  gig_id: gigId,
  band_id: "band-1",
  venue_id: "venue-1",
  venue_name: "Legacy Hall",
  venue_capacity: 100,
  completed_at: "2026-08-10T22:00:00Z",
  created_at: "2026-08-10T22:00:00Z",
  overall_rating: 20,
  performance_grade: "A",
  actual_attendance: 80,
  attendance_percentage: 80,
  ticket_revenue: 1600,
  merch_revenue: 100,
  total_revenue: 1700,
  crew_cost: 100,
  equipment_cost: 50,
  venue_cost: 300,
  total_costs: 450,
  net_profit: 1250,
  fame_gained: 5,
  new_followers: 3,
  casual_fans_gained: 2,
  dedicated_fans_gained: 1,
  superfans_gained: 0,
  fan_conversions: 6,
  chemistry_change: 1,
  total_xp_awarded: 50,
  equipment_quality_avg: 10,
  crew_skill_avg: 10,
  band_chemistry_level: 10,
  member_skill_avg: 10,
  merch_items_sold: 4,
  crowd_energy_peak: 80,
  stage_behavior_used: "balanced",
  band_synergy_modifier: 0,
  social_buzz_impact: 0,
  audience_memory_impact: 0,
  promoter_modifier: 0,
  venue_loyalty_bonus: 0,
};

type QueryState = {
  table: string;
  select: string;
  filters: Array<["eq", string, unknown]>;
  orders: Array<[string, unknown]>;
  limit: number | null;
  maybeSingle: boolean;
};
type MockResponse = { data: unknown; error: unknown };
type Route = (state: QueryState) => MockResponse;
type MockBuilder = {
  select(columns: string): MockBuilder;
  eq(column: string, value: unknown): MockBuilder;
  order(column: string, options?: unknown): MockBuilder;
  limit(value: number): MockBuilder;
  maybeSingle(): Promise<MockResponse>;
  then(onFulfilled: (value: MockResponse) => unknown, onRejected?: (reason: unknown) => unknown): Promise<unknown>;
};

function response(data: unknown, error: unknown = null): MockResponse {
  return { data, error };
}

function createClient(routes: Record<string, Route>) {
  return {
    from(table: string) {
      const state: QueryState = { table, select: "", filters: [], orders: [], limit: null, maybeSingle: false };
      const resolve = () => Promise.resolve((routes[table] ?? (() => response([])))(state));
      const builder: MockBuilder = {
        select(columns: string) { state.select = columns; return builder; },
        eq(column: string, value: unknown) { state.filters.push(["eq", column, value]); return builder; },
        order(column: string, options?: unknown) { state.orders.push([column, options]); return builder; },
        limit(value: number) { state.limit = value; return builder; },
        maybeSingle() { state.maybeSingle = true; return resolve(); },
        then(onFulfilled: (value: MockResponse) => unknown, onRejected?: (reason: unknown) => unknown) {
          return resolve().then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };
}

function legacyCompatibilityClient(overrides: Record<string, Route> = {}) {
  return createClient({
    gigs: (state) => state.select.includes("result_ready_at")
      ? response(null, { status: 400, code: "42703", message: "column gigs.result_ready_at does not exist" })
      : response(gig),
    gig_outcomes: () => response([outcome]),
    gig_song_performances: () => response([]),
    gig_setlists: () => response(null, { status: 404, code: "PGRST205", message: "Could not find public.gig_setlists in the schema cache" }),
    setlist_songs: () => response([
      { song_id: "song-1", position: 1, songs: { id: "song-1", title: "Legacy Opener" } },
      { song_id: "song-2", position: 2, songs: { id: "song-2", title: "Legacy Finale" } },
    ]),
    gig_performers: () => response(null, { status: 404, code: "PGRST205", message: "Could not find public.gig_performers in the schema cache" }),
    gig_viewer_replays: () => response(null, { status: 404, code: "PGRST205", message: "Could not find public.gig_viewer_replays in the schema cache" }),
    gig_post_processing: () => response(null, { status: 404, code: "PGRST205", message: "Could not find public.gig_post_processing in the schema cache" }),
    gig_consequence_snapshots: () => response(null, { status: 404, code: "PGRST205", message: "Could not find public.gig_consequence_snapshots in the schema cache" }),
    band_members: () => response([{ id: "member-1", profile_id: "profile-1", instrument_role: "vocals", role: null, member_status: "active", profiles: { display_name: "Alex" } }]),
    ...overrides,
  });
}

describe("gig experience resilient loader", () => {
  it("loads the stage view against the deployed legacy schema", async () => {
    const experience = await getGigExperience(gigId, legacyCompatibilityClient());

    expect(experience?.songs.map((song) => song.title)).toEqual(["Legacy Opener", "Legacy Finale"]);
    expect(experience?.performers.map((performer) => performer.displayName)).toEqual(["Alex"]);
    expect(experience?.viewer.ready).toBe(true);
    expect(experience?.viewer.replayAvailable).toBe(false);
    expect(experience?.analysis.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("gig (42703)"),
      expect.stringContaining("gig setlist (PGRST205)"),
      expect.stringContaining("replay descriptor (PGRST205)"),
    ]));
  });

  it("uses the newest outcome when historical duplicates exist", async () => {
    const newest = { ...outcome, id: "newest", net_profit: 2222 };
    const older = { ...outcome, id: "older", net_profit: 1111, completed_at: "2026-08-09T22:00:00Z" };
    const experience = await getGigExperience(gigId, legacyCompatibilityClient({
      gig_outcomes: () => response([newest, older]),
    }));

    expect(experience?.viewer.outcomeId).toBe("newest");
    expect(experience?.finances.netProfit).toMatchObject({ status: "available", value: 2222 });
    expect(experience?.analysis.warnings).toContain("Viewer compatibility fallback used for outcome (DUPLICATE_OUTCOME).");
  });

  it("keeps an exact diagnostic reference when the legacy core query also fails", async () => {
    const client = legacyCompatibilityClient({
      gigs: (state) => state.select.includes("result_ready_at")
        ? response(null, { status: 400, code: "42703", message: "column gigs.result_ready_at does not exist" })
        : response(null, { status: 403, code: "42501", message: "permission denied for gigs" }),
    });

    let caught: unknown;
    try {
      await getGigExperience(gigId, client);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(GigExperienceLoadError);
    expect(caught).toMatchObject({
      gigExperienceFailure: {
        stage: "gig",
        code: "42501",
        reference: "GIGVIEW-GIG-42501-11111111",
      },
    });
    expect(getGigExperienceErrorDisplay(caught, gigId)).toMatchObject({
      body: expect.stringContaining("account could not read"),
      reference: "GIGVIEW-GIG-42501-11111111",
    });
  });
});
