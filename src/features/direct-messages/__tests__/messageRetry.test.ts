import { describe, expect, it } from "vitest";
import { DirectMessageRetryTracker } from "../services/messageRetry";

describe("direct-message idempotency across overlapping sends", () => {
  it("completing A never clears the independent still-pending retry key for B", () => {
    const tracker = new DirectMessageRetryTracker();
    const a = tracker.claim(JSON.stringify(["profile", "conversation", "A"]), () => "a-1");
    const b = tracker.claim(JSON.stringify(["profile", "conversation", "B"]), () => "b-1");
    tracker.complete(JSON.stringify(["profile", "conversation", "A"]), a);
    expect(tracker.pendingId(JSON.stringify(["profile", "conversation", "B"]))).toBe(b);
    expect(tracker.claim(JSON.stringify(["profile", "conversation", "B"]), () => "b-2")).toBe("b-1");
    tracker.complete(JSON.stringify(["profile", "conversation", "B"]), "b-stale");
    expect(tracker.pendingId(JSON.stringify(["profile", "conversation", "B"]))).toBe("b-1");
    tracker.complete(JSON.stringify(["profile", "conversation", "B"]), b);
    expect(tracker.claim(JSON.stringify(["profile", "conversation", "B"]), () => "b-2")).toBe("b-2");
  });

  it("separates identical text for different characters and conversations", () => {
    const tracker = new DirectMessageRetryTracker();
    const keys = [
      JSON.stringify(["profile-A", "thread-1", "hello"]),
      JSON.stringify(["profile-B", "thread-1", "hello"]),
      JSON.stringify(["profile-A", "thread-2", "hello"]),
    ];
    keys.forEach((key, index) => tracker.claim(key, () => String(index)));
    expect(keys.map((key) => tracker.pendingId(key))).toEqual(["0", "1", "2"]);
  });
});
