import { describe, expect, it, vi } from "vitest";
import { loadSongwritingProjectsResilient, loadSongsByOwnership, isUuid } from "./songwritingResilientLoader";

vi.mock("@/lib/logger", () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const profileId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const projectId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const songId = "55555555-5555-4555-8555-555555555555";

function response(data: any, error: any = null) { return { data, error }; }
function createClient(routes: Record<string, (state: any) => any>) {
  return {
    from(table: string) {
      const state: any = { table, select: "", filters: [] };
      const builder: any = {
        select(cols: string) { state.select = cols; return builder; },
        order(col: string, opts?: any) { state.order = [col, opts]; return builder; },
        limit(n: number) { state.limit = n; return builder; },
        eq(col: string, val: any) { state.filters.push(["eq", col, val]); return builder; },
        in(col: string, val: any[]) { state.filters.push(["in", col, val]); return builder; },
        or(expr: string) { state.or = expr; return builder; },
        then(resolve: any) { return Promise.resolve((routes[table] || (() => response([])))(state)).then(resolve); },
      };
      return builder;
    }
  };
}

const coreProject = { id: projectId, profile_id: profileId, user_id: userId, title: "Draft", initial_lyrics: null, lyrics: null, music_progress: 1, lyrics_progress: 2, total_sessions: 0, sessions_completed: 0, estimated_sessions: 3, quality_score: 0, song_rating: null, status: "draft", is_locked: false, locked_until: null, song_id: null, genres: [], created_at: "2026-01-01", updated_at: "2026-01-02" };

describe("songwriting resilient loader", () => {
  it("renders projects when optional progression columns fail", async () => {
    const client = createClient({
      songwriting_projects: (s) => s.select.includes("arrangement_progress") ? response(null, { status: 400, code: "42703", message: "column missing" }) : response([coreProject]),
      songwriting_sessions: () => response([]),
    });
    const result = await loadSongwritingProjectsResilient(client, profileId, userId);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0].arrangement_progress).toBe(0);
    expect(result.failures[0].code).toBe("42703");
  });

  it("throws a diagnostic full-page failure when the core ownership query fails", async () => {
    const client = createClient({ songwriting_projects: () => response(null, { status: 406, code: "PGRST205", message: "table missing" }) });
    await expect(loadSongwritingProjectsResilient(client, profileId, userId)).rejects.toMatchObject({ songwritingFailure: { code: "PGRST205", httpStatus: 406 } });
  });

  it("keeps other projects when optional session metadata fails", async () => {
    const client = createClient({
      songwriting_projects: (s) => s.select.includes("arrangement_progress") ? response([{ id: projectId }]) : response([coreProject]),
      songwriting_sessions: (s) => s.select.includes("progress_breakdown") ? response(null, { code: "PGRST204", message: "schema cache" }) : response([{ id: sessionId, project_id: projectId, user_id: userId, session_start: "2026-01-03", session_end: null, music_progress_gained: 1, lyrics_progress_gained: 1, xp_earned: 1, notes: null }]),
    });
    const result = await loadSongwritingProjectsResilient(client, profileId, userId);
    expect(result.projects[0].songwriting_sessions).toHaveLength(1);
    expect(result.projects[0].songwriting_sessions[0].effort_hours).toBe(1);
  });

  it("finds modern profile-owned songs", async () => {
    const client = createClient({ songs: (s) => s.filters.some((f: any[]) => f[1] === "profile_id") ? response([{ id: songId, title: "Modern" }]) : response([]) });
    const result = await loadSongsByOwnership(client, "id,title", profileId, null);
    expect(result.songs[0].title).toBe("Modern");
  });

  it("finds legacy user-owned songs", async () => {
    const client = createClient({ songs: (s) => s.filters.some((f: any[]) => f[1] === "user_id") ? response([{ id: songId, title: "Legacy" }]) : response([]) });
    const result = await loadSongsByOwnership(client, "id,title", null, userId);
    expect(result.songs[0].title).toBe("Legacy");
  });

  it("deduplicates songs returned by both ownership models", async () => {
    const client = createClient({ songs: () => response([{ id: songId, title: "Same" }]) });
    const result = await loadSongsByOwnership(client, "id,title", profileId, userId);
    expect(result.songs).toHaveLength(1);
  });

  it("drops malformed sessions without breaking project loading", async () => {
    const client = createClient({
      songwriting_projects: (s) => s.select.includes("arrangement_progress") ? response([{ id: projectId }]) : response([coreProject]),
      songwriting_sessions: (s) => s.select.includes("progress_breakdown") ? response([]) : response([{ project_id: projectId }, { id: sessionId, project_id: projectId, user_id: userId, session_start: "2026-01-03", session_end: null, music_progress_gained: 1, lyrics_progress_gained: 1, xp_earned: 1, notes: null }]),
    });
    const result = await loadSongwritingProjectsResilient(client, profileId, userId);
    expect(result.projects[0].songwriting_sessions).toHaveLength(1);
  });

  it("returns legacy songs when profile song lookup fails", async () => {
    const client = createClient({ songs: (s) => s.filters.some((f: any[]) => f[1] === "profile_id") ? response(null, { code: "PGRST205", message: "profile lookup failed" }) : response([{ id: songId, title: "Legacy survives" }]) });
    const result = await loadSongsByOwnership(client, "id,title", profileId, userId);
    expect(result.songs).toHaveLength(1);
    expect(result.failures[0].code).toBe("PGRST205");
  });

  it("re-running after a core failure can recover with the same core query", async () => {
    let attempts = 0;
    const client = createClient({ songwriting_projects: (s) => {
      if (!s.select.includes("arrangement_progress") && attempts++ === 0) return response(null, { code: "PGRST205", message: "stale cache" });
      return s.select.includes("arrangement_progress") ? response([{ id: projectId }]) : response([coreProject]);
    }, songwriting_sessions: () => response([]) });
    await expect(loadSongwritingProjectsResilient(client, profileId, userId)).rejects.toBeTruthy();
    const recovered = await loadSongwritingProjectsResilient(client, profileId, userId);
    expect(recovered.projects).toHaveLength(1);
  });

  it("does not build ownership filters for invalid UUID values", () => {
    expect(isUuid("profile_id.eq.bad")).toBe(false);
  });
});
