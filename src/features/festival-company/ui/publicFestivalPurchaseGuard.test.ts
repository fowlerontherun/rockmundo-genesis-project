import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "src/features/festival-company/ui/PublicFestivalPage.tsx"), "utf8");

describe("public festival purchase controls", () => {
  it("uses independent quantities for each ticket product", () => {
    expect(page).toContain("useState<Record<string, number>>({})");
    expect(page).toContain("value={quantities[p.id] ?? 1}");
    expect(page).toContain("[p.id]: Number(e.target.value)");
    expect(page).toContain("quantity: quantities[p.id] ?? 1");
  });

  it("shows purchase success or failure only beside the selected ticket type", () => {
    expect(page).toContain("buy.reset();");
    expect(page).toContain("setActivePurchaseProductId(p.id)");
    expect(page).toContain("buy.isPending && activePurchaseProductId === p.id");
    expect(page).toContain("buy.isError && activePurchaseProductId === p.id");
    expect(page).toContain("buy.isSuccess && activePurchaseProductId === p.id");
  });

  it("rejects invalid quantities, expired events, sold-out products and signed-out purchases", () => {
    expect(page).toContain("!Number.isSafeInteger(quantities[p.id] ?? 1)");
    expect(page).toContain("(quantities[p.id] ?? 1) < 1");
    expect(page).toContain("Math.min(p.purchaseLimit, p.availableQuantity)");
    expect(page).toContain("!user || eventPhase === \"ended\"");
    expect(page).toContain('f.launchStatus !== "tickets_on_sale"');
    expect(page).toContain('<Link to="/auth">Sign in to purchase</Link>');
    expect(page).toContain("{user && <Button");
    expect(page).toContain('!user ? "Sign in required"');
    expect(page).toContain("Ticket sales are not currently open.");
    expect(page).toContain('disabled={eventPhase === "ended" || f.launchStatus !== "tickets_on_sale" || p.availableQuantity === 0}');
    expect(page).toContain("Sales unavailable");
  });
});
