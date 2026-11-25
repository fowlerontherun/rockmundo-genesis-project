/**
 * Staging-only, READ-ONLY Festival V2 public RPC load/reconnect probe.
 * Never calls ticks, purchases, admissions, settlements or owner RPCs.
 * Run with --help for the explicit staging confirmation requirements.
 */
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const ACTIVE_STATES = new Set(["gates_open", "live", "paused"]);
const PUBLIC_RPC = "/rest/v1/rpc/get_public_festival_edition_live_status";
const PRIVATE_KEYS = new Set(["staff", "incidents", "privatepayload", "exactcrowd", "medical", "securitynotes", "backstage"]);

export function positiveInteger(value, name, maximum) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return parsed;
}

export function percentile(values, percentage) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * percentage) - 1] * 10) / 10;
}

export function festivalLocalDay(instant, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(instant));
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function validatePublicSnapshot(data, expectedIdentity, now, maxAgeMs, timeZone) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { reason: "missing_public_snapshot" };
  const identity = [data.editionId, data.festivalLaunchId];
  if (identity.some((value) => typeof value !== "string" || !value.trim())) return { reason: "missing_edition_identity" };
  if (expectedIdentity && identity.some((value, index) => value !== expectedIdentity[index])) return { reason: "cross_edition_snapshot" };
  if (typeof data.runtimeStatus !== "string" || !Array.isArray(data.performances) || !Array.isArray(data.stageCrowds)) {
    return { reason: "malformed_public_snapshot" };
  }
  // Check projection keys, including nested arrays, without copying payloads into reports.
  const stack = [data];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== "object") continue;
    for (const [key, entry] of Object.entries(value)) {
      if (PRIVATE_KEYS.has(key.toLowerCase())) return { reason: "private_projection_field" };
      if (entry && typeof entry === "object") stack.push(entry);
    }
  }
  if (ACTIVE_STATES.has(data.runtimeStatus)) {
    if (typeof data.currentDay !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.currentDay)) {
      return { reason: "missing_active_festival_day" };
    }
    if (typeof data.updatedAt !== "string") return { reason: "missing_runtime_timestamp" };
    const updated = Date.parse(data.updatedAt);
    if (!Number.isFinite(updated) || updated > now + 120_000 || now - updated > maxAgeMs) {
      return { reason: "stale_runtime_snapshot" };
    }
    // A published snapshot for a different edition day must not become
    // 'today's live festival' when visitors are in another timezone.
    if (timeZone && festivalLocalDay(now, timeZone) !== data.currentDay) {
      return { reason: "cross_day_runtime_snapshot" };
    }
    for (const observation of data.stageCrowds) {
      if (observation && typeof observation === "object" &&
        typeof observation.festivalDate === "string" && observation.festivalDate !== data.currentDay) {
        return { reason: "cross_day_stage_observation" };
      }
    }
  }
  return { identity, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Each simulated visitor makes ordinary HTTP requests, pauses as if offline,
 * then reconnects. External staging ticks can run at the same time: the probe
 * observes their published results, but never creates ticks itself.
 */
export async function probePublicEditionLoad({ endpoint, apiKey, bearerToken, slug, viewers = 12,
  cycles = 4, timeoutMs = 5000, slowViewerDelayMs = 250, reconnectDelayMs = 500,
  maxAgeMs = 30 * 60_000, p95LimitMs = 3000, requireTickChange = false, timeZone,
  fetchImpl = fetch, nowImpl = Date.now, clockImpl = () => performance.now(), waitImpl = wait }) {
  positiveInteger(viewers, "viewers", 25);
  positiveInteger(cycles, "cycles", 20);
  if (cycles < 2) throw new Error("at least two cycles are required to verify reconnect");
  positiveInteger(timeoutMs, "timeoutMs", 30000);
  positiveInteger(maxAgeMs, "maxAgeMs", 3600000);
  positiveInteger(p95LimitMs, "p95LimitMs", 30000);
  if (!Number.isSafeInteger(slowViewerDelayMs) || slowViewerDelayMs < 0 || slowViewerDelayMs > 10000) throw new Error("invalid slowViewerDelayMs");
  if (!Number.isSafeInteger(reconnectDelayMs) || reconnectDelayMs < 0 || reconnectDelayMs > 10000) throw new Error("invalid reconnectDelayMs");
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{1,99}$/.test(slug)) throw new Error("invalid public festival slug");
  if (timeZone) festivalLocalDay(nowImpl(), timeZone); // fail early on invalid IANA zones
  if (typeof apiKey !== "string" || !apiKey.length) throw new Error("staging publishable key required");
  if (new URL(endpoint).pathname !== PUBLIC_RPC) throw new Error("only the canonical read-only public-status RPC is permitted");

  const samples = [];
  const reasons = {};
  const identities = [];
  const observedVersions = new Set();
  let expectedIdentity = null;
  let peakInFlight = 0;
  let inFlight = 0;
  let recovered = 0;
  let mobileRequests = 0;

  const observe = async (viewer, cycle) => {
    const mobile = viewer % 2 === 1;
    const started = clockImpl();
    const headers = {
      apikey: apiKey,
      "Content-Type": "application/json",
      "User-Agent": mobile ? "RockMundo-Staging-Mobile-Probe/1.0" : "RockMundo-Staging-Desktop-Probe/1.0",
    };
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
    inFlight += 1;
    peakInFlight = Math.max(inFlight, peakInFlight);
    if (mobile) mobileRequests += 1;
    let reason = null;
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST", headers, body: JSON.stringify({ p_slug: slug }), signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) reason = `http_${response.status}`;
      else {
        const result = validatePublicSnapshot(await response.json(), expectedIdentity, nowImpl(), maxAgeMs, timeZone);
        if (result.reason) reason = result.reason;
        else {
          if (!expectedIdentity) expectedIdentity = result.identity;
          identities.push(result.identity.join(":"));
          if (result.updatedAt) observedVersions.add(result.updatedAt);
          if (cycle === cycles - 1) recovered += 1;
        }
      }
    } catch (error) {
      reason = error?.name === "TimeoutError" ? "timeout" : "network_or_invalid_json";
    } finally {
      inFlight -= 1;
    }
    const latencyMs = Math.max(0, clockImpl() - started);
    samples.push({ latencyMs, ok: !reason, mobile });
    if (reason) reasons[reason] = (reasons[reason] || 0) + 1;
  };

  await Promise.all(Array.from({ length: viewers }, async (_, viewer) => {
    const midpoint = Math.max(1, Math.floor(cycles / 2));
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      if (cycle === midpoint) await waitImpl(reconnectDelayMs);
      if (viewer % 2 === 1 && cycle > 0) await waitImpl(slowViewerDelayMs);
      await observe(viewer, cycle);
    }
  }));

  const latencies = samples.map((sample) => sample.latencyMs);
  const status = samples.every((sample) => sample.ok) && recovered === viewers &&
    peakInFlight <= viewers && percentile(latencies, 0.95) <= p95LimitMs &&
    (!requireTickChange || observedVersions.size > 1) ? "passed" : "failed";
  // Report only aggregate metrics; no credentials, response bodies, identities or player data.
  return {
    status, requests: samples.length, viewers, cycles, peakInFlight, mobileRequests,
    successful: samples.filter((sample) => sample.ok).length,
    errors: { ...reasons }, reconnectRecovered: recovered,
    p50Ms: percentile(latencies, 0.5), p95Ms: percentile(latencies, 0.95), p99Ms: percentile(latencies, 0.99),
    distinctPublishedTimestamps: observedVersions.size, identityStable: new Set(identities).size <= 1,
    note: "Read-only RPC HTTP probe; actual device rendering, websocket reconnect, scheduler ticks and rewards require separate staging certification.",
  };
}

export function assertStagingTarget(baseUrl, allowlistedHost, confirmation) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("staging base URL must be a clean HTTPS origin");
  }
  if (confirmation !== "I_CONFIRM_STAGING_ONLY" || !allowlistedHost || url.host !== allowlistedHost) {
    throw new Error("staging confirmation and exact hostname allowlist required");
  }
  return new URL(PUBLIC_RPC, url).href;
}

const help = `Staging-only, read-only Festival V2 public status probe.\n\n` +
  `Required: FESTIVAL_STAGING_URL=https://<staging-host>/\n` +
  `          FESTIVAL_STAGING_HOST=<exact-staging-host>\n` +
  `          FESTIVAL_STAGING_PUBLISHABLE_KEY=<publishable-key>\n` +
  `          FESTIVAL_STAGING_CONFIRM=I_CONFIRM_STAGING_ONLY\n` +
  `          FESTIVAL_STAGING_SLUG=<published-test-edition-slug>\n` +
  `          FESTIVAL_STAGING_TIMEZONE=<edition IANA timezone>\n` +
  `Optional: FESTIVAL_STAGING_AUTH_TOKEN (a *staging-only* user token)\n` +
  `          FESTIVAL_LOAD_VIEWERS (1-25), FESTIVAL_LOAD_CYCLES (1-20)\n` +
  `          FESTIVAL_LOAD_REQUIRE_TICK_CHANGE=1 (external tick must update the status)\n\n` +
  `This does not create ticks or modify any database state. No production target is authorized.\n`;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--help")) {
    process.stdout.write(help);
  } else {
    const env = process.env;
    if (!env.FESTIVAL_STAGING_TIMEZONE) throw new Error("staging edition IANA timezone required");
    const endpoint = assertStagingTarget(env.FESTIVAL_STAGING_URL ?? "", env.FESTIVAL_STAGING_HOST, env.FESTIVAL_STAGING_CONFIRM);
    if (env.VITE_SUPABASE_URL && new URL(env.VITE_SUPABASE_URL).host === new URL(endpoint).host) {
      throw new Error("refusing to probe the application's configured Supabase origin; use an isolated staging project");
    }
    const result = await probePublicEditionLoad({
      endpoint, apiKey: env.FESTIVAL_STAGING_PUBLISHABLE_KEY,
      bearerToken: env.FESTIVAL_STAGING_AUTH_TOKEN,
      slug: env.FESTIVAL_STAGING_SLUG,
      timeZone: env.FESTIVAL_STAGING_TIMEZONE,
      viewers: positiveInteger(env.FESTIVAL_LOAD_VIEWERS ?? 12, "viewers", 25),
      cycles: positiveInteger(env.FESTIVAL_LOAD_CYCLES ?? 4, "cycles", 20),
      requireTickChange: env.FESTIVAL_LOAD_REQUIRE_TICK_CHANGE === "1",
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status !== "passed") process.exitCode = 1;
  }
}
