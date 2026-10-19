import { describe, expect, it } from "vitest";
import {
  canCancelDjBooking, canStartDjBooking, djReservationFingerprint,
  parseDjReservationAttempt, resolveDjReservationAttempt,
} from "./bookingClient";

const firstId = "77777777-7777-4777-8777-777777777777";
const secondId = "88888888-8888-4888-8888-888888888888";

describe("DJ booking retries", () => {
  const key = djReservationFingerprint("player", "club", "set", "2026-10-20T22:00:00.000Z");

  it("reuses the same server idempotency key after an ambiguous response", () => {
    let generated = 0;
    const createId = () => { generated += 1; return firstId; };
    const first = resolveDjReservationAttempt(null, key, createId);
    const retry = resolveDjReservationAttempt(first, key, createId);
    expect(retry.requestId).toBe(firstId);
    expect(generated).toBe(1);
    expect(parseDjReservationAttempt(JSON.stringify(first))).toEqual(first);
  });

  it("retains retries after a remount using a validated stored attempt", () => {
    const saved = JSON.stringify({ fingerprint: key, requestId: firstId });
    const restored = parseDjReservationAttempt(saved);
    expect(resolveDjReservationAttempt(restored, key, () => secondId).requestId).toBe(firstId);
    expect(parseDjReservationAttempt("not json")).toBeNull();
    expect(parseDjReservationAttempt('{"fingerprint":"x","requestId":"not-a-uuid"}')).toBeNull();
    expect(parseDjReservationAttempt('[]')).toBeNull();
    expect(parseDjReservationAttempt(null)).toBeNull();
  });

  it("rotates the key only when the actual booking intent changes", () => {
    const first = resolveDjReservationAttempt(null, key, () => firstId);
    const nextTime = djReservationFingerprint("player", "club", "set", "2026-10-20T23:00:00.000Z");
    const nextSet = djReservationFingerprint("player", "club", "other-set", "2026-10-20T22:00:00.000Z");
    const nextClub = djReservationFingerprint("player", "other-club", "set", "2026-10-20T22:00:00.000Z");
    const nextProfile = djReservationFingerprint("other-player", "club", "set", "2026-10-20T22:00:00.000Z");
    expect(new Set([key, nextTime, nextSet, nextClub, nextProfile]).size).toBe(5);
    for (const changed of [nextTime, nextSet, nextClub, nextProfile]) {
      expect(resolveDjReservationAttempt(first, changed, () => secondId).requestId).toBe(secondId);
    }
  });
});

describe("DJ booking action availability", () => {
  const start = Date.parse("2026-10-20T22:00:00.000Z");

  it("opens the start action at T-minus-five even if the player kept the page open", () => {
    const iso = new Date(start).toISOString();
    expect(canStartDjBooking("booked", iso, start - 5 * 60_000 - 1)).toBe(false);
    expect(canStartDjBooking("booked", iso, start - 5 * 60_000)).toBe(true);
    expect(canStartDjBooking("ready", iso, start + 9 * 60_000)).toBe(true);
    expect(canStartDjBooking("ready", iso, start + 10 * 60_000)).toBe(false);
    expect(canStartDjBooking("missed", iso, start)).toBe(false);
    expect(canStartDjBooking("live", iso, start)).toBe(false);
  });

  it("closes cancellation on start and rejects invalid dates or states", () => {
    const iso = new Date(start).toISOString();
    expect(canCancelDjBooking("booked", iso, start - 1)).toBe(true);
    expect(canCancelDjBooking("booked", iso, start)).toBe(false);
    expect(canCancelDjBooking("completed", iso, start - 1)).toBe(false);
    expect(canCancelDjBooking("ready", "not-a-time", start)).toBe(false);
    expect(canStartDjBooking("booked", "not-a-time", start)).toBe(false);
    expect(canStartDjBooking("booked", iso, Number.NaN)).toBe(false);
  });
});
