export const LEGACY_TUTORIAL_ROUTE_REDIRECTS: Record<string, string> = {
  "/band/rehearsals": "/rehearsals",
  "/skill-tree": "/skills",
  "/equipment": "/gear-shop",
  "/merch": "/merchandise",
  "/tours": "/tour-manager",
  "/charts": "/music/charts",
};

export const resolveTutorialRoute = (route?: string | null) => {
  if (!route) return null;
  return LEGACY_TUTORIAL_ROUTE_REDIRECTS[route] ?? route;
};
