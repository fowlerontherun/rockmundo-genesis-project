/**
 * Tracks the most recently visited path inside each FM module so the
 * ModuleTabs and the Quick Actions "Home" button can restore the
 * player's last context instead of always dumping them on the hub.
 *
 * Storage shape: { [moduleId]: "/last/path" }
 * Persisted to localStorage so it survives reloads / Electron restarts.
 */
const KEY = "rm-fm-last-path-by-module";

type Store = Record<string, string>;

const read = (): Store => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
};

const write = (s: Store) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode — ignore */
  }
};

export const recordModulePath = (moduleId: string, pathname: string) => {
  if (!moduleId || !pathname) return;
  const s = read();
  if (s[moduleId] === pathname) return;
  s[moduleId] = pathname;
  write(s);
};

export const getLastModulePath = (moduleId: string): string | null => {
  return read()[moduleId] ?? null;
};

export const clearModulePath = (moduleId: string) => {
  const s = read();
  if (moduleId in s) {
    delete s[moduleId];
    write(s);
  }
};
