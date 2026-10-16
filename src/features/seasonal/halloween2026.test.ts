import { describe, expect, it } from "vitest";
import { DEFAULT_HALLOWEEN_EVENT } from "@/hooks/useSiteConfig";
import { halloweenDismissalKey, halloweenEndLabel, halloweenEventPhase, halloweenRemainingLabel } from "./halloween2026";

const live = { ...DEFAULT_HALLOWEEN_EVENT, enabled: true, rewards_live: true };

describe("The Haunted Stage event announcement", () => {
  it("requires explicit rollout readiness", () => {
    expect(halloweenEventPhase(DEFAULT_HALLOWEEN_EVENT, new Date("2026-10-31T12:00:00Z"))).toBe("disabled");
    expect(halloweenEventPhase({ ...live, rewards_live: false }, new Date("2026-10-31T12:00:00Z"))).toBe("disabled");
  });

  it("starts at 00:00 BST on 24 October and ends at 00:00 GMT on 2 November", () => {
    expect(halloweenEventPhase(live, new Date("2026-10-23T22:59:59Z"))).toBe("upcoming");
    expect(halloweenEventPhase(live, new Date("2026-10-23T23:00:00Z"))).toBe("active");
    expect(halloweenEventPhase(live, new Date("2026-11-01T23:59:59Z"))).toBe("active");
    expect(halloweenEventPhase(live, new Date("2026-11-02T00:00:00Z"))).toBe("ended");
    expect(halloweenEndLabel(live)).toMatch(/1 November 2026/);
    expect(halloweenRemainingLabel(live, new Date("2026-11-01T22:00:00Z"))).toBe("Ends in 2 hours");
  });

  it("rejects bad dates and isolates dismissals per character and account", () => {
    expect(halloweenEventPhase({ ...live, ends_at: "bad" }, new Date("2026-10-31T12:00:00Z"))).toBe("disabled");
    expect(halloweenEventPhase({ ...live, ends_at: live.starts_at }, new Date("2026-10-31T12:00:00Z"))).toBe("disabled");
    expect(halloweenDismissalKey("user1", "char1")).not.toBe(halloweenDismissalKey("user1", "char2"));
    expect(halloweenDismissalKey("user1", "char1")).not.toBe(halloweenDismissalKey("user2", "char1"));
  });
});
