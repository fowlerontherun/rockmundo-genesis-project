import { matchPath } from "react-router-dom";

/**
 * Desktop route -> dedicated mobile route bridge.
 *
 * Mobile users who land on a desktop path (deep link, notification, legacy
 * bookmark) are forwarded to the dedicated mobile screen when one exists,
 * instead of rendering the contained desktop fallback inside MobileShell.
 *
 * Ordering matters: the first matching pattern wins, so put specific patterns
 * before generic ones.
 */
export const mobileRouteBridge: Array<[pattern: string, target: string]> = [
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
  ["/tour-manager", "/mobile/career/tours"],
  ["/release-manager", "/mobile/career/releases"],
  ["/streaming-platforms", "/mobile/career/streaming"],
  ["/streaming", "/mobile/career/streaming"],
  ["/competitive-charts", "/mobile/career/charts"],
  ["/country-charts", "/mobile/career/charts"],
  ["/music/charts", "/mobile/career/charts"],
  ["/awards", "/mobile/career/awards"],
  ["/band", "/mobile/career/band"],
  ["/career", "/mobile/career"],
  ["/career/overview", "/mobile/career"],

  // World
  ["/travel", "/mobile/world/travel"],
  ["/venues", "/mobile/world/venues"],
  ["/gear-shop", "/mobile/world/shops"],
  ["/clothing-shop", "/mobile/world/shops"],
  ["/marketplace", "/mobile/world/marketplace"],
  ["/companies/directory", "/mobile/world/companies"],
  ["/world-companies", "/mobile/world/companies"],
  ["/my-companies", "/mobile/world/companies"],
  ["/jobs", "/mobile/world/jobs"],
  ["/employment", "/mobile/world/jobs"],
  ["/major-events", "/mobile/world/events"],
  ["/festivals", "/mobile/world/festivals"],
  ["/cities", "/mobile/world/city"],
  ["/world/current-city", "/mobile/world/city"],
  ["/world", "/mobile/world"],
  ["/world/overview", "/mobile/world"],

  // Social
  ["/inbox", "/mobile/social/mail"],
  ["/twaater", "/mobile/social/twaater"],
  ["/relationships", "/mobile/social/friends"],
  ["/community/players", "/mobile/social/friends"],
  ["/community/invitations", "/mobile/social/requests"],
  ["/social/messages", "/mobile/social/messages"],
  ["/social", "/mobile/social"],
  ["/social/overview", "/mobile/social"],

  // Me
  ["/wellness", "/mobile/me/wellness"],
  ["/inventory", "/mobile/me/inventory"],
  ["/skills", "/mobile/me/skills"],
  ["/education", "/mobile/me/education"],
  ["/achievements", "/mobile/me/achievements"],
  ["/clothing-designer", "/mobile/me/wardrobe"],
  ["/character", "/mobile/me"],
  ["/character/overview", "/mobile/me"],
  ["/me", "/mobile/me"],
];

/** Returns the dedicated mobile route for a desktop pathname, if one exists. */
export function getMobileBridgeTarget(pathname: string): string | null {
  if (pathname.startsWith("/mobile")) return null;
  const hit = mobileRouteBridge.find(([pattern]) =>
    matchPath({ path: pattern, end: true }, pathname),
  );
  return hit ? hit[1] : null;
}
