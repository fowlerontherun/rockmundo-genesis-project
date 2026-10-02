import { matchPath } from "react-router-dom";

export const mobileRouteBridge: Array<[pattern: string, target: string]> = [
  ["/home", "/mobile"], ["/dashboard", "/mobile"], ["/schedule", "/mobile"], ["/schedule/*", "/mobile"],
  ["/booking/*", "/mobile?view=book"],
  ["/inbox", "/mobile/inbox"],
  ["/social/chat", "/mobile/chat"], ["/chat", "/mobile/chat"],
  ["/skills", "/mobile/progression"], ["/character/skills", "/mobile/progression"], ["/progression", "/mobile/progression"],
  ["/*", "/mobile"],
];
const isPublicMobileSafePath = (pathname: string) => pathname === "/" || pathname === "/auth" || pathname === "/about" || Boolean(matchPath({ path: "/song/:songId", end: true }, pathname));
export function getMobileBridgeTarget(pathname: string): string | null {
  if (pathname.startsWith("/mobile") || isPublicMobileSafePath(pathname)) return null;
  const hit = mobileRouteBridge.find(([pattern]) => matchPath({ path: pattern, end: true }, pathname));
  return hit ? hit[1] : "/mobile";
}
