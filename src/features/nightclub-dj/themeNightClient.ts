export type ThemeNightAction = "set" | "disable";
export type ThemeNightAttempt = {
  fingerprint: string;
  requestId: string;
};

const uuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Form intent determines retry identity; cosmetic edits get a different key. */
export function themeNightFingerprint(
  ownedClubId: string,
  weekday: number,
  action: ThemeNightAction,
  title?: string | null,
  genre?: string | null,
) {
  return JSON.stringify([
    ownedClubId, weekday, action,
    action === "set" ? (title ?? "").trim() : null,
    action === "set" ? (genre ?? "").trim() : null,
  ]);
}

export function parseThemeNightAttempt(value: string | null): ThemeNightAttempt | null {
  if (!value) return null;
  try {
    const attempt = JSON.parse(value) as Partial<ThemeNightAttempt>;
    if (typeof attempt.fingerprint !== "string" ||
        !uuidFormat.test(attempt.requestId ?? "")) return null;
    return { fingerprint: attempt.fingerprint, requestId: attempt.requestId! };
  } catch {
    return null;
  }
}

export function resolveThemeNightAttempt(
  previous: ThemeNightAttempt | null,
  fingerprint: string,
  createId: () => string,
): ThemeNightAttempt {
  if (previous?.fingerprint === fingerprint && uuidFormat.test(previous.requestId)) {
    return previous;
  }
  return { fingerprint, requestId: createId() };
}
