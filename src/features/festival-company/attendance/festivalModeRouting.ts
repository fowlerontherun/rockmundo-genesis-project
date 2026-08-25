export const festivalModeSupportRoutes = [
  "/inbox",
  "/settings/safety/reports",
  "/settings/privacy/blocked-players",
] as const;

export type FestivalModeLocation = {
  pathname: string;
  search?: string;
  hash?: string;
};

type FestivalModeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const isSafeRelativePath = (value: string) => value.startsWith("/") && !value.startsWith("//");

export const isFestivalModeSupportPath = (pathname: string) =>
  festivalModeSupportRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

export const buildFestivalModeLocation = ({
  pathname,
  search = "",
  hash = "",
}: FestivalModeLocation) => `${pathname}${search}${hash}`;

export const festivalModeReturnStorageKey = (profileId: string) =>
  `rockmundo:festival-mode:return:${profileId}`;

export const readFestivalModeReturnPath = (
  storage: FestivalModeStorage,
  profileId: string | null | undefined,
) => {
  if (!profileId) return null;
  const stored = storage.getItem(festivalModeReturnStorageKey(profileId));
  if (!stored || !isSafeRelativePath(stored) || isFestivalModeSupportPath(stored.split(/[?#]/, 1)[0])) {
    return null;
  }
  return stored;
};

export const rememberFestivalModeReturnPath = (
  storage: FestivalModeStorage,
  profileId: string | null | undefined,
  location: FestivalModeLocation,
) => {
  if (!profileId) return null;

  // The first route interrupted by the attending session is the return target
  // for the whole Festival Mode lifecycle. Refreshes and support navigation
  // must never replace it.
  const existing = readFestivalModeReturnPath(storage, profileId);
  if (existing) return existing;

  if (isFestivalModeSupportPath(location.pathname) || location.pathname === "/auth") {
    return null;
  }

  const returnPath = buildFestivalModeLocation(location);
  if (!isSafeRelativePath(returnPath)) return null;

  storage.setItem(festivalModeReturnStorageKey(profileId), returnPath);
  return returnPath;
};

export const clearFestivalModeReturnPath = (
  storage: FestivalModeStorage,
  profileId: string | null | undefined,
) => {
  if (!profileId) return;
  storage.removeItem(festivalModeReturnStorageKey(profileId));
};
