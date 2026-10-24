/**
 * Shared, side-effect-free guards for disposable staging browser certification.
 *
 * A frontend can point its Supabase client to a CUSTOM domain, not only a
 * project-ref.supabase.co hostname. Catch API-shaped requests by PATH as well
 * as by known provider host to avoid sending staging credentials to production.
 *
 * Playwright page.route() blocks browser requests only; direct APIRequestContext
 * requests in these tests are built solely from the prevalidated staging origin.
 */
export const ROCKMUNDO_PRODUCTION_SUPABASE_REF = "yztogmdixmchsmimtent";

const providerDomain = (hostname: string) =>
  hostname === "supabase.co" || hostname.endsWith(".supabase.co");
const gameDomain = (hostname: string) =>
  hostname === "rockmundo.uk" || hostname.endsWith(".rockmundo.uk");
const localHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
const namedStagingHost = (hostname: string) => {
  // Ignore the public suffix. A generic game.example.test is NOT an
  // explicitly staged app merely because its TLD happens to be ".test".
  const labelsWithoutSuffix = hostname.split(".").slice(0, -1).join(".");
  return /(?:^|[.-])(?:staging|test|preview)(?:[.-]|$)/i.test(labelsWithoutSuffix);
};
const apiPath = (pathname: string) =>
  /^\/(?:auth|rest|functions|storage|realtime|graphql|pg)\/v1(?:\/|$)/i.test(pathname);

export function validateCookingStagingOrigins(appInput: string, apiInput: string) {
  const app = new URL(appInput);
  const api = new URL(apiInput);
  for (const [role, url] of [["app", app], ["API", api]] as const) {
    if (!["https:", "http:"].includes(url.protocol) ||
        (url.protocol === "http:" && !localHost(url.hostname)) ||
        url.username || url.password ||
        url.search || url.hash ||
        url.pathname !== "/" ||
        gameDomain(url.hostname) ||
        url.hostname.includes(ROCKMUNDO_PRODUCTION_SUPABASE_REF)) {
      throw new Error(`Cooking staging ${role} origin is unsafe`);
    }
  }
  // The UI must be an explicitly named disposable staging/preview/local host.
  // A production app pointed at staging auth is still a dangerous test target.
  if (!localHost(app.hostname) && !namedStagingHost(app.hostname)) {
    throw new Error("Cooking staging frontend must be a staging/test/preview origin");
  }
  if (providerDomain(app.hostname)) {
    throw new Error("Cooking staging frontend cannot be the Supabase API host");
  }
  if (providerDomain(api.hostname) && api.hostname.split(".").length < 3) {
    throw new Error("Cooking staging API must name an isolated Supabase project");
  }
  if (!providerDomain(api.hostname) && !localHost(api.hostname) &&
      !namedStagingHost(api.hostname)) {
    throw new Error("Custom-domain staging API must explicitly identify staging/preview");
  }
  // A protected GitHub environment and the manually verified isolated DB are
  // still required: no URL-only heuristic can certify a production clone.
  return { appOrigin: app.origin, apiOrigin: api.origin };
}

export function forbiddenCookingStagingRequest(requestUrl: string, approvedApiOrigin: string) {
  const url = new URL(requestUrl);
  const allowed = new URL(approvedApiOrigin);
  if (gameDomain(url.hostname) ||
      url.hostname.includes(ROCKMUNDO_PRODUCTION_SUPABASE_REF)) {
    return true;
  }
  // Do NOT just compare *.supabase.co: custom-domain APIs otherwise escape
  // the fail-closed guard during login, payments and Edge Function requests.
  return (providerDomain(url.hostname) || apiPath(url.pathname)) &&
    url.origin !== allowed.origin;
}
