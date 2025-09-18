import { beforeAll, describe, expect, it } from "bun:test";

import type { ExperienceLedgerEntry } from "../useGameData";

type WeeklyModule = typeof import("../useGameData");

let evaluateWeeklyBonusState!: WeeklyModule["evaluateWeeklyBonusState"];
let resolveWeeklyBonusAcknowledgementTimestamp!: WeeklyModule["resolveWeeklyBonusAcknowledgementTimestamp"];
let WEEKLY_BONUS_REASON: WeeklyModule["WEEKLY_BONUS_REASON"] = "weekly_bonus";

const createMemoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    }
  } satisfies Storage;
};

beforeAll(async () => {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage
  });

  if (typeof window === "undefined") {
    (globalThis as unknown as { window: { localStorage: Storage } }).window = {
      localStorage: storage
    };
  } else {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage
    });
  }

  const module = await import("../useGameData");
  evaluateWeeklyBonusState = module.evaluateWeeklyBonusState;
  resolveWeeklyBonusAcknowledgementTimestamp =
    module.resolveWeeklyBonusAcknowledgementTimestamp;
  WEEKLY_BONUS_REASON = module.WEEKLY_BONUS_REASON;
});

const createLedgerEntry = (
  overrides: Partial<ExperienceLedgerEntry> = {}
): ExperienceLedgerEntry => ({
  id: "ledger-1",
  user_id: "user-1",
  profile_id: "profile-1",
  amount: 250,
  reason: WEEKLY_BONUS_REASON,
  metadata: {},
  recorded_at: "2024-10-01T12:00:00.000Z",
  ...overrides
});

describe("evaluateWeeklyBonusState", () => {
  it("marks weekly bonus as fresh when acknowledgement is missing or stale", () => {
    const entry = createLedgerEntry({ recorded_at: "2024-11-01T15:30:00.000Z" });

    const withoutAcknowledgement = evaluateWeeklyBonusState(entry, null);
    expect(withoutAcknowledgement.freshWeeklyBonusAvailable).toBe(true);
    expect(withoutAcknowledgement.acknowledgementToPersist).toBeUndefined();

    const staleAcknowledgement = evaluateWeeklyBonusState(
      entry,
      "2024-10-15T08:00:00.000Z"
    );
    expect(staleAcknowledgement.freshWeeklyBonusAvailable).toBe(true);
    expect(staleAcknowledgement.acknowledgementToPersist).toBeUndefined();
  });

  it("suppresses alerts when acknowledgement is current", () => {
    const recordedAt = "2024-11-02T10:00:00.000Z";
    const entry = createLedgerEntry({ recorded_at: recordedAt });

    const acknowledgement = evaluateWeeklyBonusState(entry, recordedAt);
    expect(acknowledgement.freshWeeklyBonusAvailable).toBe(false);
    expect(acknowledgement.acknowledgementToPersist).toBeUndefined();
  });

  it("persists a synthetic acknowledgement when ledger lacks a timestamp", () => {
    const entry = createLedgerEntry({ recorded_at: "" });
    const now = new Date("2024-12-24T04:05:06.000Z");

    const evaluation = evaluateWeeklyBonusState(entry, null, now);
    expect(evaluation.freshWeeklyBonusAvailable).toBe(false);
    expect(evaluation.acknowledgementToPersist).toBe(now.toISOString());
  });

  it("clears stray acknowledgements when the ledger has no weekly entry", () => {
    const missingEntry = evaluateWeeklyBonusState(undefined, null);
    expect(missingEntry.freshWeeklyBonusAvailable).toBe(false);
    expect(missingEntry.acknowledgementToPersist).toBeNull();

    const existingAcknowledgement = evaluateWeeklyBonusState(undefined, "2024-09-01T00:00:00.000Z");
    expect(existingAcknowledgement.freshWeeklyBonusAvailable).toBe(false);
    expect(existingAcknowledgement.acknowledgementToPersist).toBeUndefined();
  });
});

describe("resolveWeeklyBonusAcknowledgementTimestamp", () => {
  it("prefers the ledger timestamp when available", () => {
    const recordedAt = "2025-01-01T00:00:00.000Z";
    const entry = createLedgerEntry({ recorded_at: recordedAt });

    expect(resolveWeeklyBonusAcknowledgementTimestamp(entry)).toBe(recordedAt);
  });

  it("falls back to the provided clock when the ledger timestamp is invalid", () => {
    const now = new Date("2025-02-03T04:05:06.000Z");
    const entry = createLedgerEntry({ recorded_at: "not-a-date" });

    expect(resolveWeeklyBonusAcknowledgementTimestamp(entry, now)).toBe(now.toISOString());
  });
});
