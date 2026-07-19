import { describe, expect, it } from "vitest";
import { buyProperty, canAccessProperty, collectMonthlyRent, deteriorateProperty, expireLeases, filterMarketplace, generateCityProperties, isPropertyJournalBalanced, moveResidence, processRunningCosts, renovateProperty, rentProperty, type PropertyTemplate } from "./propertyPhase8A";

const template: PropertyTemplate = { id: "studio-flat", city: "London", district: "Camden", category: "residential", type: "Studio", quality: 3, sizeSqm: 38, rooms: 2, bedrooms: 1, capacity: 2, monthlyCosts: { maintenance: { amountMinor: 12000, currencyCode: "GBP" }, utilities: { amountMinor: 9000, currencyCode: "GBP" }, localTaxes: { amountMinor: 7000, currencyCode: "GBP" }, rent: { amountMinor: 95000, currencyCode: "GBP" } }, purchaseValue: { amountMinor: 24000000, currencyCode: "GBP" }, rentalValue: { amountMinor: 95000, currencyCode: "GBP" }, maintenanceLevel: 2, prestige: 4, upgradePotential: 5, storageCapacity: 120 };

describe("Finance Phase 8A property ownership and rentals", () => {
  it("generates persistent marketplace inventory by city and filters listings", () => {
    const properties = generateCityProperties([template], { "studio-flat": 3 });
    expect(properties).toHaveLength(3);
    expect(properties[0]).toMatchObject({ city: "London", district: "Camden", status: "available", listingStatus: "for_rent" });
    expect(filterMarketplace(properties, { city: "London", maxRentMinor: 100000, minPrestige: 3 })).toHaveLength(3);
    expect(filterMarketplace(properties, { city: "Paris" })).toHaveLength(0);
  });

  it("supports buying, transfer history, ownership permissions and balanced ledgers", () => {
    const [property] = generateCityProperties([template], { "studio-flat": 1 });
    const purchase = buyProperty(property, { type: "player", id: "player-1" }, "2026-08-01");
    expect(purchase.property.ownerId).toBe("player-1");
    expect(purchase.property.ownershipHistory).toHaveLength(1);
    expect(canAccessProperty(purchase.property, "player-1", "guest")).toBe(true);
    expect(isPropertyJournalBalanced(purchase.journal)).toBe(true);
  });

  it("supports renting, lease expiry, rent collection and recurring running costs", () => {
    const [property] = generateCityProperties([template], { "studio-flat": 1 });
    const rented = rentProperty(property, { type: "player", id: "player-2" }, { monthlyRent: template.rentalValue, deposit: { amountMinor: 190000, currencyCode: "GBP" }, leaseStart: "2026-08-01", leaseEnd: "2026-09-01", noticePeriodDays: 30, furnished: true, utilitiesIncluded: false });
    const rent = collectMonthlyRent(rented, "2026-08");
    expect(rent && isPropertyJournalBalanced(rent)).toBe(true);
    expect(isPropertyJournalBalanced(processRunningCosts(rented, "2026-08"))).toBe(true);
    expect(expireLeases([rented], "2026-10-01")[0]).toMatchObject({ status: "available", lease: expect.objectContaining({ status: "expired" }) });
  });

  it("handles maintenance deterioration, renovations and moving-house reconciliation", () => {
    const [first, second] = generateCityProperties([template], { "studio-flat": 2 });
    const neglected = deteriorateProperty(first, 6);
    expect(neglected.condition).toBeLessThan(first.condition);
    const renovated = renovateProperty(neglected, { name: "Studio acoustic upgrade", cost: { amountMinor: 500000, currencyCode: "GBP" }, valueIncreaseBps: 800, prestigeIncrease: 2, conditionIncrease: 20 });
    expect(renovated.property.estimatedMarketValue.amountMinor).toBeGreaterThan(neglected.estimatedMarketValue.amountMinor);
    expect(renovated.property.storage.capacity).toBe(120);
    expect(isPropertyJournalBalanced(renovated.journal)).toBe(true);
    const move = moveResidence(renovated.property, second, "player-3", { amountMinor: 25000, currencyCode: "GBP" });
    expect(move.to).toMatchObject({ occupantId: "player-3", officialUse: "player_residence" });
    expect(isPropertyJournalBalanced(move.journal)).toBe(true);
  });

  it("keeps currencies isolated for multi-currency financial reconciliation", () => {
    const eurTemplate = { ...template, id: "paris-office", city: "Paris", category: "commercial" as const, type: "Office", purchaseValue: { amountMinor: 60000000, currencyCode: "EUR" }, rentalValue: { amountMinor: 220000, currencyCode: "EUR" }, monthlyCosts: { maintenance: { amountMinor: 30000, currencyCode: "EUR" }, utilities: { amountMinor: 20000, currencyCode: "EUR" } } };
    const [office] = generateCityProperties([eurTemplate], { "paris-office": 1 });
    const purchase = buyProperty(office, { type: "company", id: "company-1" }, "2026-08-01");
    expect(purchase.journal.lines.every((l) => l.currencyCode === "EUR")).toBe(true);
    expect(isPropertyJournalBalanced(purchase.journal)).toBe(true);
  });
});
