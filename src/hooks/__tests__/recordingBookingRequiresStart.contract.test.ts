import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const atomicBooking = readFileSync(
  new URL("../useRecordingDataAtomic.tsx", import.meta.url),
  "utf8",
);
const wizard = readFileSync(
  new URL("../../components/recording/SessionConfigurator.tsx", import.meta.url),
  "utf8",
);

describe("recording booked start-time contract (#4089)", () => {
  it("rejects omitted or invalid start before computing dates or charging", () => {
    const noStart = atomicBooking.indexOf('if (!input.scheduled_start) {');
    const validation = atomicBooking.indexOf('if (!Number.isFinite(scheduledStart.getTime())) {');
    const date = atomicBooking.indexOf('const scheduledStart = new Date(input.scheduled_start);');
    const payment = atomicBooking.indexOf("confirmRecordingSessionAtomic({");

    expect(noStart).toBeGreaterThan(-1);
    expect(date).toBeGreaterThan(noStart);
    expect(validation).toBeGreaterThan(date);
    expect(payment).toBeGreaterThan(validation);
    expect(atomicBooking).toContain('throw new Error("Choose a recording date and start time before booking.");');
    expect(atomicBooking).toContain('throw new Error("Choose a valid recording start time.");');
    expect(atomicBooking).not.toMatch(/scheduledStart\s*=\s*input\.scheduled_start\s*\?/);
    expect(atomicBooking).not.toContain("new Date(Date.now() + 60");
  });

  it("rejects past first-time slots while allowing only verified idempotent retries", () => {
    expect(atomicBooking).toContain("if (!isConfirmedRetry && scheduledStart.getTime() <= Date.now())");
    expect(atomicBooking).toContain("if (input.repairOnly && !isConfirmedRetry)");
    expect(atomicBooking).toContain("scheduledStart.toISOString()");
    expect(atomicBooking).toContain("funding_idempotency_key");
  });

  it("the booking wizard supplies the explicit selected slot and end time", () => {
    expect(wizard).toContain("const { start } = getSlotTimeRange(slot, selectedDate);");
    expect(wizard).toContain("scheduled_start: start.toISOString(),");
    expect(wizard).toContain("scheduled_end: end.toISOString(),");
    expect(wizard).toContain("Choose an available future time slot.");
    expect(wizard).toContain("useCreateRecordingSession, type CreateRecordingSessionInput");
  });
});
