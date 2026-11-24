import { matchPath } from "react-router-dom";

export const mobileRouteBridge: Array<[pattern: string, target: string]> = [
  ["/home", "/mobile"], ["/dashboard", "/mobile"], ["/schedule", "/mobile"], ["/schedule/*", "/mobile"],
  ["/booking/education", "/mobile/education"],
  ["/booking/*", "/mobile?view=book"],
  ["/inbox", "/mobile/inbox"],
  ["/social/chat", "/mobile/chat"], ["/chat", "/mobile/chat"],
  ["/education", "/mobile/education"],
  ["/skills", "/mobile/progression"], ["/character/skills", "/mobile/progression"], ["/progression", "/mobile/progression"],
  ["/*", "/mobile"],
];
const isPublicMobileSafePath = (pathname: string) => pathname === "/" || pathname === "/auth" || pathname === "/about" || Boolean(matchPath({ path: "/song/:songId", end: true }, pathname));
export function getMobileBridgeTarget(pathname: string): string | null {
  if (pathname.startsWith("/mobile") || isPublicMobileSafePath(pathname)) return null;
  if (pathname === "/world/festivals" || pathname === "/festivals") return "/mobile/festivals";
  const festival = matchPath({ path: "/world/festivals/:festivalCompanyIdentifier", end: true }, pathname);
  if (festival?.params.festivalCompanyIdentifier) {
    return `/mobile/festivals/${encodeURIComponent(festival.params.festivalCompanyIdentifier)}`;
  }
  // Keep university detail routes reachable in the companion with the same ID.
  if (matchPath({ path: "/university/:id", end: true }, pathname)) return `/mobile${pathname}`;
  const hit = mobileRouteBridge.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  return hit ? hit[1] : "/mobile";
}
