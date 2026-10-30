import { describe, expect, it, vi } from "vitest";
import { festivalScheduleLocalInput, festivalScheduleLocalToInstant, festivalScheduleSlotWindow } from "./festivalScheduleLocalTime";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: {}, error: null }) },
}));

import { supabase } from "@/integrations/supabase/client";
import { upsertScheduleItem } from "./service";

describe("festival-local slot saves", () => {
  it("converts local UK summer and winter times to the correct UTC instant", () => {
    expect(festivalScheduleLocalToInstant("2026-07-01T18:00", "Europe/London")).toBe("2026-07-01T17:00:00.000Z");
    expect(festivalScheduleLocalToInstant("2026-12-01T18:00", "Europe/London")).toBe("2026-12-01T18:00:00.000Z");
    expect(festivalScheduleLocalToInstant("2026-07-01T18:00", "America/New_York")).toBe("2026-07-01T22:00:00.000Z");
  });

  it("rejects nonexistent and repeated festival-local times instead of silently moving an act", () => {
    expect(() => festivalScheduleLocalToInstant("2026-03-29T01:30", "Europe/London")).toThrow(/does not exist/);
    expect(() => festivalScheduleLocalToInstant("2026-10-25T01:30", "Europe/London")).toThrow(/occurs twice/);
    expect(() => festivalScheduleLocalToInstant("2026-07-01T12:00", "Invalid/Zone")).toThrow(/IANA timezone/);
    expect(() => festivalScheduleLocalToInstant("2026-02-30T18:00", "Europe/London")).toThrow(/calendar date/);
  });

  it("uses elapsed set duration, including midnight rollover", () => {
    expect(festivalScheduleSlotWindow("2026-07-01", "23:45", 45, "Europe/London")).toEqual({
      startsAt: "2026-07-01T22:45:00.000Z",
      endsAt: "2026-07-01T23:30:00.000Z",
    });
    expect(festivalScheduleLocalInput("2026-07-01T22:45:00Z", "Europe/London")).toBe("2026-07-01T23:45");
  });

  it("serialises matching absolute start/end timestamps using RPC snake_case keys", async () => {
    const window = festivalScheduleSlotWindow("2026-07-01", "23:45", 45, "Europe/London");
    await upsertScheduleItem({ editionId: "edition", revisionId: "revision", item: {
      stageId: "stage", festivalDate: "2026-07-01", itemType: "performance_slot",
      durationMinutes: 45, startsAt: window.startsAt, endsAt: window.endsAt,
    }, idempotencyKey: "manual-retry-1" });
    expect(supabase.rpc).toHaveBeenCalledWith("festival_schedule_upsert_item", expect.objectContaining({
      p_edition_id: "edition",
      p_idempotency_key: "manual-retry-1",
      p_item: expect.objectContaining({
        stage_id: "stage", festival_date: "2026-07-01",
        starts_at: "2026-07-01T22:45:00.000Z",
        ends_at: "2026-07-01T23:30:00.000Z",
        duration_minutes: 45,
      }),
    }));
  });

  it("preserves the existing slot UUID when editing rather than creating a duplicate", async () => {
    await upsertScheduleItem({ editionId: "edition", revisionId: "revision", item: {
      id: "slot-id", stageId: "stage", startsAt: "2026-07-01T17:00:00.000Z",
      endsAt: "2026-07-01T17:45:00.000Z",
    } });
    expect(supabase.rpc).toHaveBeenLastCalledWith("festival_schedule_upsert_item", expect.objectContaining({
      p_item: expect.objectContaining({ stage_slot_id: "slot-id" }),
    }));
  });
});
