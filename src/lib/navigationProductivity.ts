import type { LucideIcon } from "lucide-react";
import { FM_MODULES } from "@/config/fmNavigation";
import type { UserRole } from "@/hooks/useUserRole";

export type NavigationDestinationKind = "hub" | "page" | "action" | "dynamic";
export type StoredNavigationDestination = {
  id: string;
  label: string;
  path: string;
  hubLabel?: string;
  kind?: NavigationDestinationKind;
  keywords?: string[];
  favouriteEligible?: boolean;
  recentEligible?: boolean;
};
export type NavigationDestination = StoredNavigationDestination & {
  kind: NavigationDestinationKind;
  Icon?: LucideIcon;
  adminOnly?: boolean;
  featureFlag?: string;
};

export const NAV_PRODUCTIVITY_VERSION = 1;
export const MAX_FAVOURITES = 12;
export const MAX_RECENTS = 8;
const STORAGE_PREFIX = "rm-navigation-productivity";

const aliasByPath: Record<string, string[]> = {
  "/wellness": ["health"],
  "/social/messages": ["mail", "inbox", "dm"],
  "/schedule": ["calendar", "today"],
  "/band/gigs": ["gig prep", "gig preparation", "shows"],
  "/business/finances": ["company money", "company finances", "cashflow"],
  "/career/finances": ["money", "cash"],
  "/music/songwriting": ["songs", "write song", "compose"],
  "/world/current-city": ["location", "current city"],
  "/world/travel": ["trip", "fly"],
};

const excludedPatterns = [
  /^\/auth(?:\/|$)/,
  /^\/logout(?:\/|$)/,
  /^\/404(?:\/|$)/,
  /^\/not-found(?:\/|$)/,
  /^\/permission-denied(?:\/|$)/,
  /callback/i,
  /confirmation/i,
  /token=/i,
  /access_token=/i,
  /refresh_token=/i,
  /password/i,
  /returnUrl=/i,
];

const normalize = (value: string) => value.toLowerCase().trim().replace(/[\s_-]+/g, " ");

export const sanitizeInternalPath = (path: string): string | null => {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
  try {
    const url = new URL(path, "https://rockmundo.local");
    if (url.origin !== "https://rockmundo.local") return null;
    for (const key of Array.from(url.searchParams.keys())) {
      if (/token|password|secret|return|redirect|draft|recipient|payment|billing/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    const search = url.searchParams.toString();
    return `${url.pathname}${search ? `?${search}` : ""}`;
  } catch {
    return null;
  }
};

export const isRecentEligiblePath = (path: string) => {
  const safe = sanitizeInternalPath(path);
  return Boolean(safe && !excludedPatterns.some((pattern) => pattern.test(safe)));
};

export const getNavigationDestinations = (role: UserRole | null, flags: Record<string, boolean> = {}): NavigationDestination[] => {
  const entries = new Map<string, NavigationDestination>();
  for (const mod of FM_MODULES) {
    if (mod.id === "admin" && role !== "admin") continue;
    const add = (entry: Omit<NavigationDestination, "kind"> & { kind?: NavigationDestinationKind }) => {
      const path = sanitizeInternalPath(entry.path);
      if (!path) return;
      if (entry.featureFlag && !flags[entry.featureFlag]) return;
      if (entries.has(path)) return;
      entries.set(path, {
        ...entry,
        path,
        kind: entry.kind ?? "page",
        keywords: [...(entry.keywords ?? []), ...(aliasByPath[path] ?? [])],
        favouriteEligible: entry.favouriteEligible ?? path !== "/auth",
        recentEligible: entry.recentEligible ?? isRecentEligiblePath(path),
        adminOnly: mod.id === "admin" || entry.adminOnly,
      });
    };
    add({ id: `${mod.id}:hub`, label: mod.label, path: mod.rootPath, hubLabel: mod.label, Icon: mod.icon, kind: "hub" });
    for (const tab of mod.subTabs) add({ id: `${mod.id}:tab:${tab.path}`, label: tab.label, path: tab.path, hubLabel: mod.label, Icon: tab.icon });
    for (const section of mod.sidebar) {
      for (const item of section.items) add({ id: `${mod.id}:side:${item.path}`, label: item.label, path: item.path, hubLabel: mod.label, Icon: item.icon, keywords: [section.label] });
    }
    for (const action of mod.quickActions ?? []) add({ id: `${mod.id}:action:${action.path}:${action.label}`, label: action.label, path: action.path, hubLabel: mod.label, Icon: action.icon, kind: "action", keywords: action.description ? [action.description] : [] });
  }
  return Array.from(entries.values());
};

const score = (destination: NavigationDestination, query: string) => {
  const q = normalize(query);
  if (!q) return 1;
  const fields = [destination.label, destination.hubLabel ?? "", ...(destination.keywords ?? [])].map(normalize);
  let best = 0;
  for (const field of fields) {
    if (field === q) best = Math.max(best, 100);
    else if (field.startsWith(q)) best = Math.max(best, 75);
    else if (field.includes(q)) best = Math.max(best, 45);
    else if (q.split(" ").every((part) => field.includes(part))) best = Math.max(best, 30);
  }
  return best;
};

export const searchNavigationDestinations = (destinations: NavigationDestination[], query: string, limit = 24) => {
  const q = query.trim();
  return destinations
    .map((destination) => ({ destination, score: score(destination, q) }))
    .filter((result) => (q ? result.score > 0 : result.destination.kind === "hub" || result.destination.kind === "action"))
    .sort((a, b) => b.score - a.score || a.destination.label.localeCompare(b.destination.label))
    .slice(0, limit)
    .map((result) => result.destination);
};

type Store = { version: 1; favourites: StoredNavigationDestination[]; recents: StoredNavigationDestination[] };
const emptyStore = (): Store => ({ version: NAV_PRODUCTIVITY_VERSION, favourites: [], recents: [] });
const storageKey = (userId?: string | null) => `${STORAGE_PREFIX}:v${NAV_PRODUCTIVITY_VERSION}:${userId || "guest"}`;

const validStored = (value: unknown): StoredNavigationDestination | null => {
  const item = value as Partial<StoredNavigationDestination>;
  const path = typeof item.path === "string" ? sanitizeInternalPath(item.path) : null;
  if (!path || typeof item.label !== "string" || !item.label.trim()) return null;
  return { id: typeof item.id === "string" ? item.id : path, label: item.label.slice(0, 80), path, hubLabel: item.hubLabel?.slice(0, 50), kind: item.kind, keywords: [] };
};

export const readNavigationStore = (userId?: string | null): Store => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(userId)) || "null");
    if (!parsed || parsed.version !== NAV_PRODUCTIVITY_VERSION) return emptyStore();
    return {
      version: NAV_PRODUCTIVITY_VERSION,
      favourites: Array.isArray(parsed.favourites) ? parsed.favourites.map(validStored).filter(Boolean).slice(0, MAX_FAVOURITES) as StoredNavigationDestination[] : [],
      recents: Array.isArray(parsed.recents) ? parsed.recents.map(validStored).filter(Boolean).slice(0, MAX_RECENTS) as StoredNavigationDestination[] : [],
    };
  } catch { return emptyStore(); }
};

const writeStore = (userId: string | null | undefined, store: Store) => {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(store)); } catch { /* ignore */ }
};

export const toggleFavourite = (userId: string | null | undefined, destination: StoredNavigationDestination) => {
  const item = validStored(destination);
  const store = readNavigationStore(userId);
  if (!item) return store;
  const exists = store.favourites.some((fav) => fav.path === item.path);
  store.favourites = exists ? store.favourites.filter((fav) => fav.path !== item.path) : [item, ...store.favourites.filter((fav) => fav.path !== item.path)].slice(0, MAX_FAVOURITES);
  writeStore(userId, store);
  return store;
};

export const recordRecentDestination = (userId: string | null | undefined, destination: StoredNavigationDestination) => {
  const item = validStored(destination);
  if (!item || !isRecentEligiblePath(item.path)) return readNavigationStore(userId);
  const store = readNavigationStore(userId);
  if (store.recents[0]?.path === item.path) return store;
  store.recents = [item, ...store.recents.filter((recent) => recent.path !== item.path)].slice(0, MAX_RECENTS);
  writeStore(userId, store);
  return store;
};
