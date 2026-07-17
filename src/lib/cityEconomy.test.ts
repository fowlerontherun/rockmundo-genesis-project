import { describe, expect, it } from "vitest";
import { calculateLocalAudienceDemand, calculateWageGuidance, quoteCityPrice, validateCityEconomicProfile, type CityEconomicProfile } from "./cityEconomy";

const cheapCity: CityEconomicProfile = { cityId: "cheap", countryCode: "GB", primaryCurrencyCode: "USD", population: 350000, cityScale: "small_city", prosperityIndex: 92, costOfLivingIndex: 78, commercialRentIndex: 70, residentialRentIndex: 75, wageIndex: 82, utilityCostIndex: 80, fuelCostIndex: 90, accommodationCostIndex: 76, transportCostIndex: 85, consumerSpendingIndex: 88, tourismIndex: 82, musicMarketSize: 92, localAudienceDemand: 90, businessConfidenceIndex: 96, employmentIndex: 94, infrastructureQualityIndex: 90, economicTrend: "stable" };
const globalCity: CityEconomicProfile = { cityId: "global", countryCode: "US", primaryCurrencyCode: "USD", population: 8500000, cityScale: "global_city", prosperityIndex: 135, costOfLivingIndex: 145, commercialRentIndex: 165, residentialRentIndex: 155, wageIndex: 140, utilityCostIndex: 125, fuelCostIndex: 118, accommodationCostIndex: 170, transportCostIndex: 132, consumerSpendingIndex: 145, tourismIndex: 150, musicMarketSize: 160, localAudienceDemand: 155, businessConfidenceIndex: 130, employmentIndex: 140, infrastructureQualityIndex: 138, economicTrend: "growth" };

describe("city economy calculations", () => {
  it("validates bounded profiles and currency assumptions", () => {
    expect(validateCityEconomicProfile(globalCity)).toEqual([]);
    expect(validateCityEconomicProfile({ ...globalCity, primaryCurrencyCode: "usd", costOfLivingIndex: -1 })).toContain("primaryCurrencyCode must be an ISO-like 3-letter code");
  });

  it("varies commercial rent, utilities, accommodation and transport by city", () => {
    expect(quoteCityPrice(globalCity, 100_00, "commercial_rent").finalAmountMinor).toBeGreaterThan(quoteCityPrice(cheapCity, 100_00, "commercial_rent").finalAmountMinor);
    expect(quoteCityPrice(globalCity, 100_00, "utilities").finalAmountMinor).toBeGreaterThan(quoteCityPrice(cheapCity, 100_00, "utilities").finalAmountMinor);
    expect(quoteCityPrice(globalCity, 100_00, "accommodation").finalAmountMinor).toBeGreaterThan(quoteCityPrice(cheapCity, 100_00, "accommodation").finalAmountMinor);
    expect(quoteCityPrice(globalCity, 100_00, "transport").finalAmountMinor).toBeGreaterThan(quoteCityPrice(cheapCity, 100_00, "transport").finalAmountMinor);
  });

  it("applies bounded temporary event pressure and never produces negative charges", () => {
    const quote = quoteCityPrice(globalCity, 100_00, "accommodation", { effects: [{ category: "accommodation", strengthBasisPoints: 20_000, active: true }] });
    expect(quote.eventMultiplierBasisPoints).toBe(15_000);
    expect(quote.finalAmountMinor).toBeGreaterThan(0);
    expect(quoteCityPrice(globalCity, 0, "fuel").finalAmountMinor).toBe(0);
  });

  it("prevents duplicate modifier application through one category quote", () => {
    const once = quoteCityPrice(globalCity, 100_00, "commercial_rent", { existingModifierBasisPoints: 10_000 });
    const explicit = quoteCityPrice(globalCity, 100_00, "commercial_rent", { existingModifierBasisPoints: once.cityMultiplierBasisPoints });
    expect(once.explanation).toHaveLength(1);
    expect(explicit.finalAmountMinor).toBeGreaterThan(once.finalAmountMinor);
  });

  it("returns wage guidance ranges by city", () => {
    expect(calculateWageGuidance(globalCity, 50_000).recommendedWageMinor).toBeGreaterThan(calculateWageGuidance(cheapCity, 50_000).recommendedWageMinor);
  });

  it("models demand with music market, consumer spending, tourism, genre and competition", () => {
    const globalDemand = calculateLocalAudienceDemand(globalCity, { genrePopularityIndex: 140, bandFame: 70, ticketPriceMinor: 2500, venueCapacity: 1000, competitionIndex: 80 });
    const cheapDemand = calculateLocalAudienceDemand(cheapCity, { genrePopularityIndex: 80, bandFame: 70, ticketPriceMinor: 2500, venueCapacity: 1000, competitionIndex: 140 });
    expect(globalDemand.estimatedPotentialAudience).toBeGreaterThan(cheapDemand.estimatedPotentialAudience);
    expect(globalDemand.confidenceHigh).toBeLessThanOrEqual(1000);
  });
});
