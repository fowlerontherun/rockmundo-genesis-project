import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import {
  bookModelingOfferAtomic,
  declineModelingOffer,
  generateModelingOffersForUser,
} from "./modelingOfferGenerator";

beforeEach(() => {
  rpc.mockReset();
  sessionStorage.clear();
});

describe("secure modeling offer and booking client", () => {
  it("requests only the selected profile; browser never provides rewards", async () => {
    rpc.mockResolvedValueOnce({ data: 2, error: null });
    await expect(generateModelingOffersForUser("character-a")).resolves.toBe(2);
    expect(rpc).toHaveBeenCalledWith("generate_modeling_offers_secure", {
      p_profile_id: "character-a",
    });
    await expect(generateModelingOffersForUser("character-a")).resolves.toBe(0);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("leaves another character's cooldown independent", async () => {
    rpc.mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 1, error: null });
    await generateModelingOffersForUser("character-a");
    await generateModelingOffersForUser("character-b");
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("does not suppress generation failures as empty offers", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "RLS rejected" } });
    await expect(generateModelingOffersForUser("character-a")).rejects.toMatchObject({
      message: "RLS rejected",
    });
    rpc.mockResolvedValueOnce({ data: 900, error: null });
    await expect(generateModelingOffersForUser("character-a")).rejects.toThrow("invalid response");
  });

  it("requires a confirmed activity receipt before displaying a booked shoot", async () => {
    const input = {
      offerId: "offer-1",
      profileId: "character-a",
      startIso: "2026-11-20T10:00:00.000Z",
      endIso: "2026-11-20T12:00:00.000Z",
      shootDate: "2026-11-20",
    };
    rpc.mockResolvedValueOnce({ data: { booked: false }, error: null });
    await expect(bookModelingOfferAtomic(input)).rejects.toThrow("could not be booked");
    rpc.mockResolvedValueOnce({
      data: { booked: true, activity_id: "activity-1", compensation_amount: 500 },
      error: null,
    });
    await expect(bookModelingOfferAtomic(input)).resolves.toEqual({
      activityId: "activity-1", compensation: 500,
    });
    expect(rpc).toHaveBeenLastCalledWith("book_modeling_offer_atomic", {
      p_offer_id: input.offerId,
      p_profile_id: input.profileId,
      p_start: input.startIso,
      p_end: input.endIso,
      p_shoot_date: input.shootDate,
    });
  });

  it("declines only on a confirmed server state transition", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    await expect(declineModelingOffer("offer-1")).rejects.toThrow("no longer available");
    await expect(declineModelingOffer("offer-1")).resolves.toBeUndefined();
  });
});
