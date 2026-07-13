import { supabase } from "@/integrations/supabase/client";

export const DISCOVERY_MODES = ["all", "musicians", "band-recruitment", "collaboration", "session-work", "employment", "teaching", "social", "nearby", "recommended"] as const;
export type DiscoveryMode = (typeof DISCOVERY_MODES)[number];
export const DISCOVERY_SORTS = ["best-match", "recently-active", "online-now", "highest-fame", "career-level", "newest", "name", "closest-city", "relevant-skill", "availability"] as const;
export type DiscoverySort = (typeof DISCOVERY_SORTS)[number];
export type SkillBand = "any" | "developing" | "competent" | "skilled" | "expert" | "elite";

export interface PlayerDiscoveryFilters {
  city?: string;
  region?: string;
  travel?: "any" | "same-city" | "nearby" | "same-region" | "willing-to-travel" | "travelling";
  instrument?: string;
  secondaryInstrument?: string;
  vocalCapability?: boolean;
  role?: string;
  genre?: string;
  fameMin?: number;
  fameMax?: number;
  careerLevel?: string;
  bandStatus?: string;
  employmentStatus?: string;
  lookingForBand?: boolean;
  lookingForMembers?: boolean;
  sessionAvailable?: boolean;
  collaborationAvailable?: boolean;
  gigAvailable?: boolean;
  employmentAvailable?: boolean;
  teachingAvailable?: boolean;
  socialAvailable?: boolean;
  onlineNow?: boolean;
  activity?: "online" | "today" | "week" | "recent";
  skillBand?: SkillBand;
}

export interface PlayerMatchSummary {
  percentage: number;
  category: string;
  reasons: string[];
}

export interface PlayerDiscoveryResult {
  id: string;
  userId: string;
  characterName: string;
  avatarUrl: string | null;
  cityName: string | null;
  activityState: "online" | "today" | "recent" | "inactive" | "hidden";
  currentBand: string | null;
  primaryRole: string | null;
  primaryInstrument: string | null;
  preferredGenres: string[];
  fame: number;
  careerLevel: string;
  availability: string[];
  statusMessage: string | null;
  badges: string[];
  match: PlayerMatchSummary;
}

export interface PlayerDiscoveryQuery {
  mode: DiscoveryMode;
  search?: string;
  filters?: PlayerDiscoveryFilters;
  sort?: DiscoverySort;
  page?: number;
  pageSize?: number;
}

export interface PlayerDiscoveryResponse {
  results: PlayerDiscoveryResult[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  approximateTotal: number | null;
}

export interface SavedPlayerSearch {
  id: string;
  userId: string;
  name: string;
  discoveryMode: DiscoveryMode;
  searchQuery: string;
  filters: PlayerDiscoveryFilters;
  sortOrder: DiscoverySort;
  alertsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export const DEFAULT_DISCOVERY_PAGE_SIZE = 18;
export const MAX_DISCOVERY_PAGE_SIZE = 48;
export const SAVED_SEARCH_LIMIT = 20;

export const MODE_DEFAULT_FILTERS: Record<DiscoveryMode, Partial<PlayerDiscoveryFilters>> = {
  all: {}, musicians: { role: "musician" }, "band-recruitment": { lookingForBand: true }, collaboration: { collaborationAvailable: true },
  "session-work": { sessionAvailable: true }, employment: { employmentAvailable: true }, teaching: { teachingAvailable: true },
  social: { socialAvailable: true }, nearby: { travel: "nearby" }, recommended: {},
};

export const DEFAULT_SORT_BY_MODE: Record<DiscoveryMode, DiscoverySort> = {
  all: "recently-active", musicians: "best-match", "band-recruitment": "best-match", collaboration: "best-match", "session-work": "availability",
  employment: "availability", teaching: "relevant-skill", social: "recently-active", nearby: "closest-city", recommended: "best-match",
};

export function normalizeDiscoveryQuery(query: Partial<PlayerDiscoveryQuery>): PlayerDiscoveryQuery {
  const mode = DISCOVERY_MODES.includes(query.mode as DiscoveryMode) ? (query.mode as DiscoveryMode) : "all";
  const pageSize = Math.min(Math.max(Math.trunc(query.pageSize ?? DEFAULT_DISCOVERY_PAGE_SIZE), 1), MAX_DISCOVERY_PAGE_SIZE);
  return {
    mode,
    search: (query.search ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
    filters: { ...MODE_DEFAULT_FILTERS[mode], ...(query.filters ?? {}) },
    sort: DISCOVERY_SORTS.includes(query.sort as DiscoverySort) ? (query.sort as DiscoverySort) : DEFAULT_SORT_BY_MODE[mode],
    page: Math.max(Math.trunc(query.page ?? 1), 1),
    pageSize,
  };
}

function mapResult(row: any): PlayerDiscoveryResult {
  return {
    id: row.profile_id ?? row.id,
    userId: row.user_id,
    characterName: row.character_name ?? row.display_name ?? row.username ?? "Unknown player",
    avatarUrl: row.avatar_url ?? null,
    cityName: row.city_name ?? null,
    activityState: row.activity_state ?? "hidden",
    currentBand: row.current_band ?? null,
    primaryRole: row.primary_role ?? null,
    primaryInstrument: row.primary_instrument ?? null,
    preferredGenres: Array.isArray(row.preferred_genres) ? row.preferred_genres : [],
    fame: row.fame ?? 0,
    careerLevel: row.career_level ?? `Level ${row.level ?? 1}`,
    availability: Array.isArray(row.availability) ? row.availability : [],
    statusMessage: row.status_message ?? row.bio ?? null,
    badges: Array.isArray(row.badges) ? row.badges : [],
    match: row.match ?? { percentage: row.match_percentage ?? 50, category: row.match_category ?? "Potential match", reasons: row.match_reasons ?? [] },
  };
}

export async function searchPlayers(query: Partial<PlayerDiscoveryQuery>, viewerProfileId?: string | null): Promise<PlayerDiscoveryResponse> {
  const normalized = normalizeDiscoveryQuery(query);
  const { data, error } = await (supabase as any).rpc("search_player_discovery", { viewer_profile_id: viewerProfileId ?? null, query: normalized });
  if (error) throw new Error("Player discovery is unavailable right now. Try again or broaden your filters.");
  const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  return { results: rows.map(mapResult), page: normalized.page!, pageSize: normalized.pageSize!, hasMore: Boolean(data?.has_more), approximateTotal: data?.approximate_total ?? null };
}

export async function getRecommendedPlayers(query: Partial<PlayerDiscoveryQuery>, viewerProfileId?: string | null) { return searchPlayers({ ...query, mode: "recommended" }, viewerProfileId); }
export async function getPlayerDiscoveryFilterOptions() { const { data, error } = await (supabase as any).rpc("get_player_discovery_filter_options"); if (error) throw new Error("Could not load discovery filters."); return data ?? {}; }
export async function listSavedPlayerSearches(viewerProfileId?: string | null): Promise<SavedPlayerSearch[]> { const { data, error } = await (supabase as any).rpc("list_player_saved_searches", { viewer_profile_id: viewerProfileId ?? null }); if (error) throw new Error("Could not load saved searches."); return data ?? []; }
export async function savePlayerSearch(input: Omit<SavedPlayerSearch, "id" | "userId" | "createdAt" | "updatedAt" | "lastUsedAt">, viewerProfileId?: string | null) { const { data, error } = await (supabase as any).rpc("save_player_search", { viewer_profile_id: viewerProfileId ?? null, saved_search: input }); if (error) throw new Error(/limit/i.test(error.message) ? "Saved search limit reached." : "Could not save this search."); return data as SavedPlayerSearch; }
export async function updateSavedPlayerSearch(id: string, patch: Partial<SavedPlayerSearch>, viewerProfileId?: string | null) { const { data, error } = await (supabase as any).rpc("update_player_saved_search", { viewer_profile_id: viewerProfileId ?? null, saved_search_id: id, patch }); if (error) throw new Error("Could not update this saved search."); return data as SavedPlayerSearch; }
export async function deleteSavedPlayerSearch(id: string, viewerProfileId?: string | null) { const { error } = await (supabase as any).rpc("delete_player_saved_search", { viewer_profile_id: viewerProfileId ?? null, saved_search_id: id }); if (error) throw new Error("Could not delete this saved search."); }
export async function getRecentPlayerSearches() { return JSON.parse(localStorage.getItem("rockmundo:recent-player-searches") ?? "[]"); }
export async function clearRecentPlayerSearches() { localStorage.removeItem("rockmundo:recent-player-searches"); }
export function recordRecentPlayerSearch(entry: unknown) { const recent = JSON.parse(localStorage.getItem("rockmundo:recent-player-searches") ?? "[]"); localStorage.setItem("rockmundo:recent-player-searches", JSON.stringify([entry, ...recent].slice(0, 8))); }
export function trackPlayerDiscoveryEvent(event: string, payload: Record<string, unknown>) { window.dispatchEvent(new CustomEvent("rockmundo:analytics", { detail: { event, area: "player_discovery", ...payload } })); }
