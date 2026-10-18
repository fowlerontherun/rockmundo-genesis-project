import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", () => ({ useQuery: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { djReadinessSteps, type DjMixReadiness } from "./djReadiness";

const incomplete: DjMixReadiness = {
  booking_id: "test-booking",
  status: "live",
  count: 3,
  needs_count: 3,
  deck_a: true,
  deck_b: false,
  tempo: true,
  crossfade: false,
  time_span: false,
  after_midpoint: false,
  past_end: false,
  evidence_ready: false,
  can_settle: false,
};

describe("booked DJ mixer readiness display", () => {
  it("shows every missing settlement requirement, not just a total", () => {
    const checklist = djReadinessSteps(incomplete);
    expect(checklist).toHaveLength(7);
    expect(checklist.find((item) => item.id === "count")?.label).toContain("(3/6)");
    expect(checklist.filter((item) => item.complete).map((item) => item.id))
      .toEqual(["deck-a", "tempo"]);
    expect(checklist.filter((item) => !item.complete).map((item) => item.id))
      .toEqual(["count", "deck-b", "crossfade", "span", "midpoint"]);
  });

  it("shows completion after six events and the server's timing checks", () => {
    const full = { ...incomplete, count: 9, deck_b: true, crossfade: true,
      time_span: true, after_midpoint: true, evidence_ready: true, past_end: true, can_settle: true };
    expect(djReadinessSteps(full).every((item) => item.complete)).toBe(true);
    expect(djReadinessSteps(full)[0].label).toContain("(6/6)");
  });
});
