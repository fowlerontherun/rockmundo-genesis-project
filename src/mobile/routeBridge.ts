import { matchPath } from "react-router-dom";

/**
 * Desktop route -> dedicated mobile route bridge.
 *
 * Mobile users who land on a desktop path (deep link, notification, legacy
 * bookmark) are forwarded to a supported companion screen instead of mounting
 * the desktop gameplay page inside MobileShell.
 *
 * Ordering matters: the first matching pattern wins, so put specific patterns
 * before generic/catch-all patterns.
 */
export const mobileRouteBridge: Array<[pattern: string, target: string]> = [
  // Home / schedule
  ["/home", "/mobile"],
  ["/dashboard", "/mobile"],
  ["/schedule", "/mobile/career/schedule"],
  ["/schedule/*", "/mobile/career/schedule"],

  // Social discovery routes must beat generic /bands/:bandId/* management matching.
  ["/bands/finder", "/mobile/social/friends"],
  ["/bands/browse", "/mobile/social/friends"],
  ["/bands/search", "/mobile/social/friends"],

  // Career
  ["/stage-practice", "/mobile/career/practice"],
  ["/songwriting", "/mobile/career/songwriting"],
  ["/song-manager", "/mobile/career/songs"],
  ["/song/:id/manage", "/mobile/career/songs"],
  ["/rehearsals", "/mobile/career/rehearsals"],
  ["/recording-studio", "/mobile/career/recording"],
  ["/setlists", "/mobile/career/setlists"],
  ["/gigs/booking", "/mobile/career/gigs"],
  ["/gigs", "/mobile/career/gigs"],
  ["/gigs/*", "/mobile/career/gigs"],
  ["/tour-manager", "/mobile/career/tours"],
  ["/release-manager", "/mobile/career/releases"],
  ["/streaming-platforms", "/mobile/career/streaming"],
  ["/streaming", "/mobile/career/streaming"],
  ["/streaming/*", "/mobile/career/streaming"],
  ["/competitive-charts", "/mobile/career/charts"],
  ["/country-charts", "/mobile/career/charts"],
  ["/music/charts", "/mobile/career/charts"],
  ["/music/*", "/mobile/career"],
  ["/awards", "/mobile/career/awards"],
  ["/band", "/mobile/career/band"],
  ["/band/overview", "/mobile/career/band"],
  ["/band/members", "/mobile/career/band"],
  ["/band/fame", "/mobile/career/band"],
  ["/band/repertoire", "/mobile/career/band"],
  ["/band/history", "/mobile/career/band"],
  ["/band/finances", "/mobile/career/band"],
  ["/band/chemistry", "/mobile/career/band"],
  ["/band/settings", "/mobile/career/band"],
  ["/band/rehearsals", "/mobile/career/rehearsals"],
  ["/band/setlists", "/mobile/career/setlists"],
  ["/band/gigs", "/mobile/career/gigs"],
  ["/band/tours", "/mobile/career/tours"],
  ["/band/equipment", "/mobile/career/band"],
  ["/band/:bandId", "/mobile/social"],
  ["/bands/:bandId/*", "/mobile/career/band"],
  ["/booking/*", "/mobile/career"],
  ["/career", "/mobile/career"],
  ["/career/*", "/mobile/career"],

  // World
  ["/travel", "/mobile/world/travel"],
  ["/world/travel", "/mobile/world/travel"],
  ["/venues", "/mobile/world/venues"],
  ["/gear-shop", "/mobile/world/shops"],
  ["/clothing-shop", "/mobile/world/shops"],
  ["/marketplace", "/mobile/world/marketplace"],
  ["/companies/directory", "/mobile/world/companies"],
  ["/companies/*", "/mobile/world/companies"],
  ["/company/*", "/mobile/world/companies"],
  ["/world-companies", "/mobile/world/companies"],
  ["/my-companies", "/mobile/world/companies"],
  ["/business", "/mobile/world/companies"],
  ["/business/*", "/mobile/world/companies"],
  ["/jobs", "/mobile/world/jobs"],
  ["/employment", "/mobile/world/jobs"],
  ["/major-events", "/mobile/world/events"],
  ["/major-events/*", "/mobile/world/events"],
  ["/festivals", "/mobile/world/festivals"],
  ["/festivals/*", "/mobile/world/festivals"],
  ["/cities", "/mobile/world/city"],
  ["/cities/*", "/mobile/world/city"],
  ["/world/current-city", "/mobile/world/city"],
  ["/world/cities/*", "/mobile/world/city"],
  ["/world/venues", "/mobile/world/venues"],
  ["/world/companies", "/mobile/world/companies"],
  ["/world/events", "/mobile/world/events"],
  ["/world/pulse", "/mobile/world/charts"],
  ["/world/leaderboards", "/mobile/world/charts"],
  ["/world", "/mobile/world"],
  ["/world/*", "/mobile/world"],

  // Social
  ["/inbox", "/mobile/social/mail"],
  ["/twaater", "/mobile/social/twaater"],
  ["/twaater/*", "/mobile/social/twaater"],
  ["/relationships", "/mobile/social/friends"],
  ["/community/players", "/mobile/social/friends"],
  ["/community/invitations", "/mobile/social/requests"],
  ["/community/*", "/mobile/social"],
  ["/band-rankings", "/mobile/social"],
  ["/band-fame-map", "/mobile/social"],
  ["/social/messages", "/mobile/social/messages"],
  ["/social", "/mobile/social"],
  ["/social/*", "/mobile/social"],

  // Me
  ["/wellness", "/mobile/me/wellness"],
  ["/character/wellness", "/mobile/me/wellness"],
  ["/inventory", "/mobile/me/inventory"],
  ["/skills", "/mobile/me/skills"],
  ["/education", "/mobile/me/education"],
  ["/achievements", "/mobile/me/achievements"],
  ["/clothing-designer", "/mobile/me/wardrobe"],
  ["/character", "/mobile/me"],
  ["/character/*", "/mobile/me"],
  ["/me", "/mobile/me"],
  ["/me/*", "/mobile/me"],

  // Any newly added authenticated desktop route is contained by default.
  ["/*", "/mobile"],
];

const isPublicMobileSafePath = (pathname: string) => {
  if (pathname === "/" || pathname === "/auth" || pathname === "/about") return true;
  return Boolean(matchPath({ path: "/song/:songId", end: true }, pathname));
};

const getPlayerProfileTarget = (pathname: string): string | null => {
  for (const pattern of ["/player/:playerId", "/players/:playerId"]) {
    const match = matchPath({ path: pattern, end: true }, pathname);
    const playerId = match?.params?.playerId;
    if (playerId) return `/mobile/social/profile/${encodeURIComponent(playerId)}`;
  }
  return null;
};

/** Returns the dedicated mobile route for a desktop pathname, if one exists. */
export function getMobileBridgeTarget(pathname: string): string | null {
  if (pathname.startsWith("/mobile") || isPublicMobileSafePath(pathname)) return null;

  const playerTarget = getPlayerProfileTarget(pathname);
  if (playerTarget) return playerTarget;

  const hit = mobileRouteBridge.find(([pattern]) =>
    matchPath({ path: pattern, end: true }, pathname),
  );
  return hit ? hit[1] : "/mobile";
}
