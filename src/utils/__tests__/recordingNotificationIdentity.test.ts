import { describe, expect, it } from "vitest";
import {
  recordingAbsentEventKey,
  recordingInboxMessageId,
} from "../recordingNotificationIdentity";

describe("recording booking notification retry identity", () => {
  it("generates a stable UUID for the same paid booking and recipient", async () => {
    const first = await recordingInboxMessageId("recording-123", "user-456");
    const retry = await recordingInboxMessageId("recording-123", "user-456");
    expect(first).toBe(retry);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("does not conflate different recipients or sessions", async () => {
    const original = await recordingInboxMessageId("session-1", "user-1");
    expect(await recordingInboxMessageId("session-1", "user-2")).not.toBe(original);
    expect(await recordingInboxMessageId("session-2", "user-1")).not.toBe(original);
  });

  it("uses stable identities for excluded band members on retry", () => {
    expect(recordingAbsentEventKey("session-1", "profile-1"))
      .toBe(recordingAbsentEventKey("session-1", "profile-1"));
    expect(recordingAbsentEventKey("session-1", "profile-2"))
      .not.toBe(recordingAbsentEventKey("session-1", "profile-1"));
  });

  it("refuses to generate a dedupe key without both identities", async () => {
    await expect(recordingInboxMessageId("", "user-1"))
      .rejects.toThrow("recording_notification_identity_missing");
  });
});
