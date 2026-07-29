import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import {
  proposeCompanyShareIssuance,
  respondCompanyShareOffer,
} from "@/lib/api/companyShareOffers";

describe("company share offer database boundary", () => {
  beforeEach(() => rpc.mockReset());

  it("creates a paid share offer without charging the buyer", async () => {
    rpc.mockResolvedValue({
      data: {
        offerId: "offer-1",
        status: "pending",
        companyId: "company-1",
        recipientProfileId: "profile-2",
        recipientUserId: "user-2",
        shares: 10,
        pricePerShare: 250,
        totalPrice: 2500,
        companyBalance: 10000,
        recipientCash: 5000,
        newOwnerId: "user-1",
        financialTransactionId: null,
        idempotent: false,
      },
      error: null,
    });

    const result = await proposeCompanyShareIssuance({
      companyId: "company-1",
      recipientProfileId: "profile-2",
      shares: 10,
      pricePerShare: 250,
      idempotencyKey: "share-offer-request-1",
    });

    expect(rpc).toHaveBeenCalledWith("propose_company_share_issuance", {
      p_company_id: "company-1",
      p_recipient_profile_id: "profile-2",
      p_shares: 10,
      p_price_per_share: 250,
      p_idempotency_key: "share-offer-request-1",
    });
    expect(result.status).toBe("pending");
    expect(result.financialTransactionId).toBeNull();
  });

  it("accepts or declines through one authoritative response RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        offerId: "offer-1",
        status: "accepted",
        companyId: "company-1",
        recipientProfileId: "profile-2",
        recipientUserId: "user-2",
        shares: 10,
        pricePerShare: 250,
        totalPrice: 2500,
        companyBalance: 12500,
        recipientCash: 2500,
        newOwnerId: "user-1",
        financialTransactionId: "finance-1",
        idempotent: false,
      },
      error: null,
    });

    const result = await respondCompanyShareOffer({
      offerId: "offer-1",
      accept: true,
      idempotencyKey: "share-response-request-1",
    });

    expect(rpc).toHaveBeenCalledWith("respond_company_share_offer", {
      p_offer_id: "offer-1",
      p_accept: true,
      p_idempotency_key: "share-response-request-1",
    });
    expect(result.status).toBe("accepted");
    expect(result.financialTransactionId).toBe("finance-1");
  });

  it("propagates database failures without browser-side money writes", async () => {
    const error = new Error("insufficient_personal_funds");
    rpc.mockResolvedValue({ data: null, error });

    await expect(
      respondCompanyShareOffer({
        offerId: "offer-1",
        accept: true,
        idempotencyKey: "share-response-request-2",
      }),
    ).rejects.toBe(error);
  });
});
