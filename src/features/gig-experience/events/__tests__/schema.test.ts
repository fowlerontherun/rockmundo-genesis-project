import { describe, expect, it } from "vitest";
import { buildGigViewerReplay, createDeterministicRandom, createDeterministicSeed } from "../generator";
import { validateGigViewerReplay, isSupportedReplayVersion } from "../schema";

const input = { replayId: "replay-1", outcomeId: "outcome-1", generatedAt: "2026-07-11T14:00:00.000Z", gig: { id: "gig-1", completedAt: "2026-07-11T13:59:00.000Z", resultReadyAt: "2026-07-11T14:00:00.000Z", venueCapacity: 100, actualAttendance: 80, overallRating: 18, netProfit: 250 }, songs: [{ id: "perf-1", songId: "song-1", position: 0, title: "One", performanceScore: 17 }, { id: "perf-2", songId: "song-2", position: 1, title: "Two", performanceScore: 21 }], performers: [{ profileId: "profile-1", displayName: "A", roleOrInstrument: "vocals", lineupStatus: "performed" }] };

describe("gig viewer replay schema", () => {
  it("validates a generated replay with all required terminal events", async () => {
    const replay = await buildGigViewerReplay(input);
    expect(validateGigViewerReplay(replay)).toEqual({ valid: true, errors: [] });
    expect(replay.events.some((e) => e.eventType === "result_revealed")).toBe(true);
    expect(replay.events.at(-1)?.eventType).toBe("replay_completed");
  });

  it("rejects invalid payload discriminators, unknown phases, duplicate sequence, out-of-order offsets, invalid energy, missing reveal, and non-last completed", async () => {
    const replay = await buildGigViewerReplay(input);
    replay.events[0] = { ...replay.events[0], visualPayload: { type: "pyrotechnics" } as never, phase: "bad_phase" as never, sequence: 1, crowdEnergyAfter: 101 };
    replay.events[1] = { ...replay.events[1], scheduledOffsetMs: 0 };
    const withoutReveal = { ...replay, events: replay.events.filter((e) => e.eventType !== "result_revealed") };
    const result = validateGigViewerReplay(withoutReveal);
    expect(result.valid).toBe(false);
    expect(result.errors.join("|")).toContain("invalid payload");
    expect(result.errors.join("|")).toContain("invalid phase");
    expect(result.errors.join("|")).toContain("duplicate sequence");
    expect(result.errors.join("|")).toContain("invalid crowd energy");
    expect(result.errors.join("|")).toContain("result reveal event is required");
    expect(result.errors.join("|")).toContain("completed event must be last");
  });
});


describe("gig viewer replay release compatibility", () => {
  it("accepts the current schema and rejects previous, future, and malformed schemas safely", async () => {
    const replay = await buildGigViewerReplay(input);
    expect(isSupportedReplayVersion(replay.viewerVersion, replay.eventSchemaVersion)).toBe(true);
    expect(validateGigViewerReplay({ ...replay, eventSchemaVersion: 0 }).errors).toContain("unsupported version");
    expect(validateGigViewerReplay({ ...replay, eventSchemaVersion: replay.eventSchemaVersion + 1 }).errors).toContain("unsupported version");
    expect(validateGigViewerReplay({ ...replay, viewerVersion: replay.viewerVersion + 1 }).errors).toContain("unsupported version");
    expect(validateGigViewerReplay({ ...replay, events: [] }).errors).toContain("events are required");
  });

  it("enforces bounded message parameters and event counts", async () => {
    const replay = await buildGigViewerReplay(input);
    const noisy = { ...replay, events: replay.events.map((event, index) => index === 0 ? { ...event, messageParams: { huge: "x".repeat(200) } } : event) };
    expect(validateGigViewerReplay(noisy).errors.join("|")).toContain("message params exceed maximum length");
    const tooMany = { ...replay, events: Array.from({ length: 241 }, (_, index) => ({ ...replay.events[0], id: `e-${index}`, sequence: index, scheduledOffsetMs: index })) };
    expect(validateGigViewerReplay(tooMany).errors.join("|")).toContain("event count exceeds maximum");
  });
});

describe("gig viewer replay determinism", () => {
  it("generates identical output and checksum for identical inputs", async () => {
    await expect(buildGigViewerReplay(input)).resolves.toEqual(await buildGigViewerReplay(input));
  });

  it("changes deterministic cosmetic random stream only when seed changes", () => {
    const a = createDeterministicRandom(createDeterministicSeed(["gig", "outcome", "done", 1]));
    const b = createDeterministicRandom(createDeterministicSeed(["gig", "outcome", "done", 1]));
    const c = createDeterministicRandom(createDeterministicSeed(["gig", "outcome", "done", 2]));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect([a(), a(), a()]).not.toEqual([c(), c(), c()]);
  });
});
