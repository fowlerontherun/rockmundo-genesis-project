import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertStagingTarget, percentile, positiveInteger,
  probePublicEditionLoad, validatePublicSnapshot,
} from "./probe-public-edition-load.mjs";

const endpoint = "https://rockmundo-disposable-staging.supabase.co/rest/v1/rpc/get_public_festival_edition_live_status";
const baseline = {
  festivalLaunchId: "11111111-1111-4111-8111-111111111111",
  editionId: "11111111-1111-4111-8111-111111111112",
  runtimeStatus: "live", currentDay: "2026-11-25",
  updatedAt: "2026-11-25T12:00:00Z", performances: [], stageCrowds: [],
};
const options = {
  endpoint, apiKey: "mock-public-key", slug: "london-test-festival", viewers: 12, cycles: 4,
  nowImpl: () => Date.parse("2026-11-25T12:00:05Z"),
  waitImpl: async () => {}, clockImpl: () => 10,
};

const response = (value = baseline, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

test("public staging probe uses only read-only RPC, measures simultaneous/mobile clients and reconnect recovery", async () => {
  let calls = 0;
  let active = 0;
  let peak = 0;
  const fetchImpl = async (url, request) => {
    calls += 1;
    active += 1;
    peak = Math.max(peak, active);
    assert.equal(url, endpoint);
    assert.equal(request.method, "POST");
    assert.deepEqual(JSON.parse(request.body), { p_slug: options.slug });
    assert.equal(request.headers.apikey, "mock-public-key");
    assert.equal(request.headers.Authorization, undefined);
    assert.match(request.headers["User-Agent"], /Staging-(Mobile|Desktop)-Probe/);
    await Promise.resolve();
    active -= 1;
    return response();
  };
  const result = await probePublicEditionLoad({ ...options, fetchImpl });
  assert.equal(calls, 48);
  assert.ok(peak >= 2, "requests must overlap, not run sequentially");
  assert.equal(result.status, "passed");
  assert.equal(result.successful, 48);
  assert.equal(result.mobileRequests, 24);
  assert.equal(result.reconnectRecovered, 12);
  assert.equal(result.identityStable, true);
  assert.deepEqual(result.errors, {});
  assert.doesNotMatch(JSON.stringify(result), /mock-public-key|11111111|london-test-festival/);
});

test("stale, cross-edition, private and unauthorised responses fail closed", async () => {
  const fixtures = [
    [response({ ...baseline, updatedAt: "2026-11-24T09:00:00Z" }), "stale_runtime_snapshot"],
    [response({ ...baseline, stageCrowds: [{ exactCrowd: 134 }] }), "private_projection_field"],
    [response({ ...baseline, editionId: null }), "missing_edition_identity"],
    [response(null), "missing_public_snapshot"],
    [response({}, 401), "http_401"],
  ];
  for (const [fixture, reason] of fixtures) {
    const result = await probePublicEditionLoad({ ...options, viewers: 2, cycles: 2, fetchImpl: async () => fixture });
    assert.equal(result.status, "failed");
    assert.equal(result.errors[reason], 4);
    assert.equal(result.reconnectRecovered, 0);
  }
});

test("a concurrent viewer switching to a different edition is detected", async () => {
  let calls = 0;
  const result = await probePublicEditionLoad({
    ...options, viewers: 4, cycles: 2,
    fetchImpl: async () => response(calls++ === 0 ? baseline : { ...baseline, editionId: "different-edition" }),
  });
  assert.equal(result.status, "failed");
  assert.ok(result.errors.cross_edition_snapshot >= 1);
});

test("an external tick can be required without the probe invoking any tick endpoint", async () => {
  let calls = 0;
  const result = await probePublicEditionLoad({
    ...options, viewers: 2, cycles: 2, requireTickChange: true,
    fetchImpl: async () => response({ ...baseline, updatedAt: calls++ % 2 ? "2026-11-25T12:00:01Z" : baseline.updatedAt }),
  });
  assert.equal(result.status, "passed");
  assert.equal(result.distinctPublishedTimestamps, 2);
  const noTick = await probePublicEditionLoad({
    ...options, viewers: 2, cycles: 2, requireTickChange: true, fetchImpl: async () => response(),
  });
  assert.equal(noTick.status, "failed");
});

test("production-like URLs, missing staging confirmation, unbounded loads and arbitrary RPCs are rejected", async () => {
  assert.equal(assertStagingTarget("https://staging.example.com/", "staging.example.com", "I_CONFIRM_STAGING_ONLY"),
    "https://staging.example.com/rest/v1/rpc/get_public_festival_edition_live_status");
  assert.throws(() => assertStagingTarget("https://live.example.com/", "staging.example.com", "I_CONFIRM_STAGING_ONLY"));
  assert.throws(() => assertStagingTarget("http://staging.example.com/", "staging.example.com", "I_CONFIRM_STAGING_ONLY"));
  assert.throws(() => assertStagingTarget("https://staging.example.com/", "staging.example.com", ""));
  assert.throws(() => positiveInteger(26, "viewers", 25));
  assert.deepEqual([percentile([90, 1, 40, 10], 0.5), percentile([90, 1, 40, 10], 0.95)], [10, 90]);
  await assert.rejects(() => probePublicEditionLoad({ ...options, viewers: 26 }));
  await assert.rejects(() => probePublicEditionLoad({ ...options, cycles: 1 }));
  await assert.rejects(() => probePublicEditionLoad({ ...options, endpoint: endpoint.replace("live_status", "start_tick") }));
  assert.equal(validatePublicSnapshot({ ...baseline, currentDay: "2026-11-24" }, null, Date.parse("2026-11-25T12:00:05Z"), 30 * 60_000).reason, undefined);
});
