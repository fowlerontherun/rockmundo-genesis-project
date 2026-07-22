import logger from "@/lib/logger";

export const CORE_PROJECT_COLUMNS = "id, profile_id, user_id, title, initial_lyrics, lyrics, music_progress, lyrics_progress, total_sessions, sessions_completed, estimated_sessions, quality_score, song_rating, status, is_locked, locked_until, song_id, genres, created_at, updated_at, theme_id, chord_progression_id, creative_brief, purpose, mode";
export const OPTIONAL_PROJECT_COLUMNS = "id, arrangement_progress, polish_progress, consistency_score, songwriting_breakdown, calculation_version, completed_at";
export const STABLE_SESSION_COLUMNS = "id, project_id, user_id, session_start, session_end, music_progress_gained, lyrics_progress_gained, xp_earned, notes, locked_until";
export const OPTIONAL_SESSION_COLUMNS = "id, completed_at, progress_breakdown, session_type, effort_hours";

export type QueryFailure = {
  queryName: string;
  tableOrRpc: string;
  httpStatus?: number | null;
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  selectedColumns?: string;
  profileId?: string | null;
  userId?: string | null;
  legacyUserFallbackAttempted?: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value?: string | null): value is string => typeof value === "string" && UUID_RE.test(value);

export const normalizeFailure = (queryName: string, tableOrRpc: string, error: any, ctx: { selectedColumns?: string; profileId?: string | null; userId?: string | null; legacyUserFallbackAttempted?: boolean } = {}): QueryFailure => ({
  queryName,
  tableOrRpc,
  httpStatus: typeof error?.status === "number" ? error.status : null,
  code: typeof error?.code === "string" ? error.code : null,
  message: typeof error?.message === "string" ? error.message : null,
  details: typeof error?.details === "string" ? error.details : null,
  hint: typeof error?.hint === "string" ? error.hint : null,
  ...ctx,
});

const logFailure = (failure: QueryFailure, level: "warn" | "error" = "error") => {
  logger[level]("Songwriting data request failed", failure as Record<string, unknown>);
};

export const withOwnership = (query: any, profileId?: string | null, userId?: string | null) => {
  const validProfileId = isUuid(profileId) ? profileId : null;
  const validUserId = isUuid(userId) ? userId : null;
  // Character isolation: when a profile is active, ONLY show that character's projects.
  // Falling back to user_id would leak sibling characters' songwriting on the same account.
  if (validProfileId) return query.eq("profile_id", validProfileId);
  if (validUserId) return query.eq("user_id", validUserId);
  return query;
};

const defaultProjectEnhancements = (project: any) => ({
  arrangement_progress: project.arrangement_progress ?? 0,
  polish_progress: project.polish_progress ?? 0,
  consistency_score: project.consistency_score ?? 0,
  songwriting_breakdown: project.songwriting_breakdown ?? null,
  calculation_version: project.calculation_version ?? null,
  completed_at: project.completed_at ?? null,
});

export async function loadSongwritingProjectsResilient(client: any, profileId?: string | null, userId?: string | null) {
  const failures: QueryFailure[] = [];
  const legacyUserFallbackAttempted = Boolean(isUuid(profileId) && isUuid(userId));
  let coreQuery = client.from("songwriting_projects").select(CORE_PROJECT_COLUMNS).order("updated_at", { ascending: false }).limit(100);
  coreQuery = withOwnership(coreQuery, profileId, userId);
  const core = await coreQuery;
  if (core.error) {
    const failure = normalizeFailure("core projects", "songwriting_projects", core.error, { selectedColumns: CORE_PROJECT_COLUMNS, profileId, userId, legacyUserFallbackAttempted });
    logFailure(failure);
    throw Object.assign(core.error, { songwritingFailure: failure, songwritingFailures: [failure] });
  }
  const projects = Array.isArray(core.data) ? core.data : [];
  const ids = projects.map((p: any) => p.id).filter(isUuid);

  let optionalById = new Map<string, any>();
  if (ids.length) {
    const optional = await client.from("songwriting_projects").select(OPTIONAL_PROJECT_COLUMNS).in("id", ids);
    if (optional.error) {
      const failure = normalizeFailure("optional project details", "songwriting_projects", optional.error, { selectedColumns: OPTIONAL_PROJECT_COLUMNS, profileId, userId, legacyUserFallbackAttempted });
      failures.push(failure); logFailure(failure, "warn");
    } else optionalById = new Map((optional.data || []).map((row: any) => [row.id, row]));
  }

  let sessionsByProject = new Map<string, any[]>();
  if (ids.length) {
    const stableSessions = await client.from("songwriting_sessions").select(STABLE_SESSION_COLUMNS).in("project_id", ids);
    if (stableSessions.error) {
      const failure = normalizeFailure("stable sessions", "songwriting_sessions", stableSessions.error, { selectedColumns: STABLE_SESSION_COLUMNS, profileId, userId });
      failures.push(failure); logFailure(failure, "warn");
    } else {
      const sessions = (stableSessions.data || []).filter((s: any) => s && s.id && s.project_id);
      let optionalSessionById = new Map<string, any>();
      const sessionIds = sessions.map((s: any) => s.id).filter(isUuid);
      if (sessionIds.length) {
        const opt = await client.from("songwriting_sessions").select(OPTIONAL_SESSION_COLUMNS).in("id", sessionIds);
        if (opt.error) {
          const failure = normalizeFailure("optional session details", "songwriting_sessions", opt.error, { selectedColumns: OPTIONAL_SESSION_COLUMNS, profileId, userId });
          failures.push(failure); logFailure(failure, "warn");
        } else optionalSessionById = new Map((opt.data || []).map((row: any) => [row.id, row]));
      }
      for (const s of sessions) {
        const merged = { completed_at: null, progress_breakdown: null, session_type: null, effort_hours: 1, ...s, ...(optionalSessionById.get(s.id) || {}) };
        sessionsByProject.set(merged.project_id, [...(sessionsByProject.get(merged.project_id) || []), merged]);
      }
    }
  }

  const now = new Date().toISOString();
  const merged = projects.map((p: any) => {
    const isExpired = p.is_locked && p.locked_until && p.locked_until < now;
    return {
      ...defaultProjectEnhancements(p),
      ...p,
      ...(optionalById.get(p.id) || {}),
      songwriting_sessions: (sessionsByProject.get(p.id) || []).sort((a, b) => new Date(b.session_start).getTime() - new Date(a.session_start).getTime()),
      is_locked: isExpired ? false : p.is_locked,
      locked_until: isExpired ? null : p.locked_until,
    };
  });
  return { projects: merged, failures };
}

export async function loadSongsByOwnership(client: any, columns: string, profileId?: string | null, userId?: string | null) {
  const validProfileId = isUuid(profileId) ? profileId : null;
  const validUserId = isUuid(userId) ? userId : null;
  const rows: any[] = [];
  const failures: QueryFailure[] = [];
  const run = async (name: string, field: "profile_id" | "user_id", id: string) => {
    const res = await client.from("songs").select(columns).eq(field, id).order("updated_at", { ascending: false });
    if (res.error) { const f = normalizeFailure(name, "songs", res.error, { selectedColumns: columns, profileId, userId, legacyUserFallbackAttempted: Boolean(validUserId) }); failures.push(f); logFailure(f, "warn"); }
    else rows.push(...(res.data || []));
  };
  if (validProfileId) await run("songs by profile", "profile_id", validProfileId);
  if (validUserId) await run("songs by legacy user", "user_id", validUserId);
  const byId = new Map<string, any>();
  for (const row of rows) if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  return { songs: Array.from(byId.values()), failures };
}
