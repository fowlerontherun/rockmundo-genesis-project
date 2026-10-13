import { describe, expect, it } from "vitest";
import {
  FestivalTicketPurchaseRetryKeys,
  type FestivalPurchaseAttempt,
} from "../festivalTicketPurchaseRetry";

const purchase = (idempotencyKey: string): FestivalPurchaseAttempt => ({
  festivalLaunchId: "festival-one",
  ticketProductId: "product-one",
  quantity: 2,
  idempotencyKey,
});

describe("festival ticket idempotency", () => {
  it("uses the same key for an uncertain retry within a character", () => {
    const keys = new FestivalTicketPurchaseRetryKeys();
    expect(keys.prepare("character-one", purchase("request-one"))).toBe("request-one");
    expect(keys.prepare("character-one", purchase("request-two"))).toBe("request-one");
  });

  it("does not reuse another character's purchase request key", () => {
    const keys = new FestivalTicketPurchaseRetryKeys();
    expect(keys.prepare("character-one", purchase("request-one"))).toBe("request-one");
    expect(keys.prepare("character-two", purchase("request-two"))).toBe("request-two");
  });

  it("clears the submitted character's key even after a character switch", () => {
    const keys = new FestivalTicketPurchaseRetryKeys();
    const first = purchase("request-one");
    const second = purchase("request-two");
    keys.prepare("character-one", first);
    keys.prepare("character-two", second);

    keys.confirm(first);
    expect(keys.prepare("character-one", purchase("request-three"))).toBe("request-three");
    expect(keys.prepare("character-two", purchase("request-four"))).toBe("request-two");

    keys.confirm(second);
    expect(keys.prepare("character-two", purchase("request-five"))).toBe("request-five");
  });

  it("rejects retry creation without a character", () => {
    const keys = new FestivalTicketPurchaseRetryKeys();
    expect(() => keys.prepare("", purchase("request-one"))).toThrow("active character");
  });
});
