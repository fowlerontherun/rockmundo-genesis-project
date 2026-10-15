import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const legacy = readFileSync(
  fileURLToPath(new URL("../../../supabase/migrations/20261012232200_atomic_underworld_transactions.sql", import.meta.url)),
  "utf8",
);
const repair = readFileSync(
  fileURLToPath(new URL("../../../supabase/production-repairs/20261015_underworld_safe_consumables_atomic_paid_only_arrest.sql", import.meta.url)),
  "utf8",
);
const client = readFileSync(
  fileURLToPath(new URL("../../hooks/useUnderworldStore.ts", import.meta.url)),
  "utf8",
);

describe("underworld atomic migration compatibility", () => {
  it("keeps the malformed legacy migration quarantined rather than replaying it", () => {
    expect(legacy).toContain("IF v_type='' THEN");
    expect(legacy).toContain("experience=coalesce(experience,0)");
    expect(repair).not.toContain("experience=coalesce(experience,0)");
  });

  it("limits first release to plain instant consumables before debiting cash", () => {
    expect(repair).toContain("v_product.category IS DISTINCT FROM 'consumable'");
    expect(repair).toContain("UNDERWORLD_EFFECTS_REQUIRE_FUTURE_CUTOVER");
    expect(repair.indexOf("UNDERWORLD_EFFECTS_REQUIRE_FUTURE_CUTOVER")).toBeLessThan(
      repair.indexOf("SET cash=cash-v_product.price_cash"),
    );
    expect(repair).toContain("('health','energy','fame')");
  });

  it("requires a retry-stable UUID and enforces authoritative price", () => {
    expect(client).toContain("p_request_id: requestId");
    expect(client).toContain("getOrCreateUnderworldPurchaseRequestId(profileId, product.id, paymentMethod)");
    expect(repair).toContain("p_request_id uuid");
    expect(repair).toContain("client_request_id=p_request_id");
    expect(repair).toContain("UNDERWORLD_PURCHASE_REQUEST_KEY_MISMATCH");
    expect(repair).toContain("cash=cash-v_product.price_cash");
  });

  it("never applies new-purchase arrest risk to gifts or old records", () => {
    expect(repair).toContain("NEW.paid_with NOT IN ('cash','crypto')");
    expect(repair).toContain("NEW.client_request_id IS NULL");
    expect(repair).toContain("NEW.gifted_from_purchase_id IS NOT NULL");
  });

  it("decrements a locked inventory item and rejects unsupported XP effects", () => {
    expect(repair).toContain("p_purchase_id uuid");
    expect(repair).toContain("UNDERWORLD_FROZEN_EFFECTS_INVALID");
    expect(repair).toContain("FOR UPDATE;");
    expect(repair).toContain("quantity=quantity-1,is_used=(quantity-1=0)");
    expect(repair).toContain("record_addiction_exposure");
    expect(repair).toContain("NOT public.underworld_safe_instant_effects(v_effects)");
  });
});
