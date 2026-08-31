import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}));

import {
  fetchFestivalArtistScheduleQueue,
  moveFestivalArtistBookingSlot,
  setFestivalStageSlotNpcDj,
} from "../admin/lifecycleB5";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("festival B5 lineup RPC client", () => {
  it("normalises a missing lineup projection to an empty array", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        editionId: "edition-1",
        bookings: [{ id: "booking-1" }],
        slots: [{ id: "slot-1" }],
      },
      error: null,
    });

    const result = await fetchFestivalArtistScheduleQueue("edition-1");

    expect(result.editionId).toBe("edition-1");
    expect(result.bookings).toHaveLength(1);
    expect(result.slots).toHaveLength(1);
    expect(result.lineup).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledWith("get_festival_artist_booking_schedule_queue", {
      p_edition_id: "edition-1",
    });
  });

  it("moves a confirmed contract using optimistic current-slot protection", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        contractId: "contract-1",
        bookingId: "booking-1",
        previousStageSlotId: "slot-old",
        stageSlotId: "slot-new",
        contractVersion: 2,
        replayed: false,
      },
      error: null,
    });

    const result = await moveFestivalArtistBookingSlot({
      contractId: "contract-1",
      targetStageSlotId: "slot-new",
      expectedCurrentStageSlotId: "slot-old",
    });

    expect(result.stageSlotId).toBe("slot-new");
    expect(result.contractVersion).toBe(2);
    expect(mocks.rpc).toHaveBeenCalledWith("move_festival_artist_booking_slot", {
      p_contract_id: "contract-1",
      p_target_stage_slot_id: "slot-new",
      p_expected_current_stage_slot_id: "slot-old",
    });
  });

  it("passes NPC DJ defaults through the secure RPC boundary", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        stageSlotId: "slot-1",
        isNpcDj: true,
        npcDjName: "Festival DJ",
        npcDjGenre: "Open format",
        npcDjQuality: 50,
        replayed: false,
      },
      error: null,
    });

    await setFestivalStageSlotNpcDj({ stageSlotId: "slot-1", enabled: true });

    expect(mocks.rpc).toHaveBeenCalledWith("set_festival_stage_slot_npc_dj", {
      p_stage_slot_id: "slot-1",
      p_enabled: true,
      p_name: null,
      p_genre: null,
      p_quality: 50,
    });
  });

  it("surfaces RPC failures instead of masking a stale lineup", async () => {
    const error = new Error("festival_lineup_changed_refresh_required");
    mocks.rpc.mockResolvedValueOnce({ data: null, error });

    await expect(moveFestivalArtistBookingSlot({
      contractId: "contract-1",
      targetStageSlotId: "slot-new",
      expectedCurrentStageSlotId: "slot-old",
    })).rejects.toBe(error);
  });
});
