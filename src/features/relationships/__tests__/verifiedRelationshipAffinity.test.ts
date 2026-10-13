import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateRelationshipSummary,
  filterRelationshipEvents,
  recordRelationshipEvent,
  resolveRelationshipPairKey,
} from "../api";
import type { RelationshipEvent } from "../types";

const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: mocks.insert }),
  },
}));

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const c = "00000000-0000-4000-8000-000000000003";

const event = (pair: string, extra: Record<string, unknown> = {}) => ({
  id: `event-${pair}`,
  activity_type: "relationship_reaction",
  message: "Sent a reaction",
  user_id: "user-1",
  created_at: "2026-10-13T12:00:00.000Z",
  metadata: {
    relationship_pair_key: pair,
    relationship_profile_id: b,
    ...extra,
  },
});

describe("relationship timeline and verified affinity", () => {
  beforeEach(() => {
    mocks.insert.mockReset();
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("#3943 filters strictly by the two-character pair, never by target alone", () => {
    const ab = resolveRelationshipPairKey(a, b);
    const cb = resolveRelationshipPairKey(c, b);
    const events = filterRelationshipEvents([
      event(ab),
      event(cb),
      event("", { relationship_profile_id: b }),
    ], ab, 75);
    expect(events).toHaveLength(1);
    expect(events[0].metadata?.relationship_pair_key).toBe(ab);
  });

  it("#3942 ignores forged affinity_value, infinite and malformed numbers", () => {
    const forged: RelationshipEvent[] = [{
      id: "one", userId: "user-1", activityType: "relationship_jam",
      message: "jam", createdAt: "2026-10-13T12:00:00Z",
      metadata: { affinity_value: 1_000_000_000, relationship_pair_key: resolveRelationshipPairKey(a, b) },
    }];
    expect(calculateRelationshipSummary(forged).affinityScore).toBe(0);
    expect(calculateRelationshipSummary(forged, 200).affinityScore).toBe(200);
    expect(calculateRelationshipSummary(forged, Number.POSITIVE_INFINITY).affinityScore).toBe(0);
    expect(calculateRelationshipSummary(forged, -15).affinityScore).toBe(0);
  });

  it("#3944 uses independently supplied lifetime affinity even with only 75 visible events", () => {
    const recent = Array.from({ length: 75 }, (_, i) => ({
      id: String(i), userId: "user-1", activityType: "relationship_chat",
      message: "Chat", createdAt: "2026-10-13T12:00:00Z",
      metadata: { affinity_value: 1 },
    }));
    expect(calculateRelationshipSummary(recent, 1250).affinityScore).toBe(1250);
    expect(calculateRelationshipSummary(recent, 1250).tierId).toBe("legendary-duo");
    expect(calculateRelationshipSummary(recent.slice(1), 1250).affinityScore).toBe(1250);
  });

  it("#3950 cannot override authoritative relationship identifiers in activity metadata", async () => {
    await recordRelationshipEvent({
      userId: "user-1", profileId: a, otherProfileId: b,
      activityType: "relationship_reaction", message: "Reacted",
      metadata: {
        relationship_pair_key: resolveRelationshipPairKey(b, c),
        relationship_profile_id: c,
        relationship_actor_profile_id: c,
        affinity_value: 999_999,
        reaction: "fire",
      },
    });
    const payload = mocks.insert.mock.calls[0][0];
    expect(payload.profile_id).toBe(a);
    expect(payload.metadata.relationship_pair_key).toBe(resolveRelationshipPairKey(a, b));
    expect(payload.metadata.relationship_profile_id).toBe(b);
    expect(payload.metadata.relationship_actor_profile_id).toBe(a);
    expect(payload.metadata.reaction).toBe("fire");
    expect(payload.metadata).not.toHaveProperty("affinity_value");
  });
});
