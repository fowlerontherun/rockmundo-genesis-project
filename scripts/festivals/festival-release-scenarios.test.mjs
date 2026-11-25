import assert from "node:assert/strict";
import { test } from "node:test";
import { festivalLocalDay, probePublicEditionLoad, validatePublicSnapshot } from "./probe-public-edition-load.mjs";

const stageA = "11111111-1111-4111-8111-111111111113";
const stageB = "11111111-1111-4111-8111-111111111114";
const base = {
  editionId: "11111111-1111-4111-8111-111111111112",
  festivalLaunchId: "11111111-1111-4111-8111-111111111111",
  runtimeStatus: "live", currentDay: "2026-10-25",
  updatedAt: "2026-10-25T01:30:00Z", performances: [],
  stageCrowds: [{ stageId: stageA, festivalDate: "2026-10-25", crowdBand: "busy" },
    { stageId: stageB, festivalDate: "2026-10-25", crowdBand: "quiet" }],
};
const now = Date.parse("2026-10-25T01:32:00Z");
const evaluate = (value, at = now, zone = "Europe/London") =>
  validatePublicSnapshot(value, null, at, 30 * 60_000, zone);

test("a three-day festival respects the actual local day across the autumn clock change", () => {
  assert.equal(festivalLocalDay(Date.parse("2026-10-24T23:30:00Z"), "Europe/London"), "2026-10-25");
  assert.equal(festivalLocalDay(Date.parse("2026-10-25T00:30:00Z"), "Europe/London"), "2026-10-25");
  assert.equal(festivalLocalDay(Date.parse("2026-10-25T01:30:00Z"), "Europe/London"), "2026-10-25");
  assert.equal(evaluate(base).reason, undefined);
  assert.equal(evaluate({ ...base, currentDay: "2026-10-24" }).reason, "cross_day_runtime_snapshot");
  assert.equal(evaluate({ ...base, currentDay: "2026-10-26" }).reason, "cross_day_runtime_snapshot");
  assert.equal(evaluate({ ...base, updatedAt: "2026-10-24T20:00:00Z" }).reason, "stale_runtime_snapshot");
  assert.equal(evaluate({ ...base, currentDay: "2026-10-25", updatedAt: "2026-10-26T01:32:00Z" },
    Date.parse("2026-10-26T01:33:00Z")).reason, "cross_day_runtime_snapshot");
});

test("two stages cannot borrow another day's audience observation, including during a pause", () => {
  assert.equal(evaluate(base).reason, undefined);
  assert.equal(evaluate({ ...base, stageCrowds: [base.stageCrowds[0], {
    ...base.stageCrowds[1], festivalDate: "2026-10-24",
  }] }).reason, "cross_day_stage_observation");
  assert.equal(evaluate({ ...base, runtimeStatus: "paused", stageCrowds: [{
    ...base.stageCrowds[0], festivalDate: "2026-10-24",
  }] }).reason, "cross_day_stage_observation");
  assert.equal(evaluate({ ...base, runtimeStatus: "paused", stageCrowds: [] }).reason, undefined);
});

test("finished and cancelled festivals are historical, not fabricated live observations", () => {
  for (const runtimeStatus of ["runtime_complete", "cancelled", "interrupted"]) {
    const result = evaluate({ ...base, runtimeStatus, currentDay: null, updatedAt: null,
      performances: [], stageCrowds: [] });
    assert.equal(result.reason, undefined);
  }
  assert.equal(evaluate({ ...base, runtimeStatus: "live", updatedAt: null }).reason, "missing_runtime_timestamp");
  assert.equal(evaluate({ ...base, runtimeStatus: "live", currentDay: null }).reason, "missing_active_festival_day");
});

test("an interrupted client can reconnect without reporting the failed session as green", async () => {
  const endpoint = "https://disposable-staging.example/rest/v1/rpc/get_public_festival_edition_live_status";
  const data = { ...base, updatedAt: "2026-10-25T01:32:00Z" };
  let calls = 0;
  const result = await probePublicEditionLoad({
    endpoint, apiKey: "test-key", slug: "three-day-festival", viewers: 3, cycles: 4,
    nowImpl: () => now, waitImpl: async () => {}, timeZone: "Europe/London",
    fetchImpl: async () => {
      calls += 1;
      if (calls <= 3) throw new Error("network disconnected");
      return { ok: true, status: 200, json: async () => data };
    },
  });
  assert.equal(result.requests, 12);
  assert.equal(result.reconnectRecovered, 3);
  assert.equal(result.errors.network_or_invalid_json, 3);
  assert.equal(result.status, "failed", "the earlier outage must remain visible to release QA");
});

test("a slow client that exceeds the p95 response budget fails certification", async () => {
  let clock = 0;
  const endpoint = "https://disposable-staging.example/rest/v1/rpc/get_public_festival_edition_live_status";
  const result = await probePublicEditionLoad({
    endpoint, apiKey: "test-key", slug: "three-day-festival", viewers: 2, cycles: 2,
    nowImpl: () => now, waitImpl: async () => {}, timeZone: "Europe/London",
    p95LimitMs: 500, clockImpl: () => (clock += 700),
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => base }),
  });
  assert.equal(result.status, "failed");
  assert.ok(result.p95Ms > 500);
});
