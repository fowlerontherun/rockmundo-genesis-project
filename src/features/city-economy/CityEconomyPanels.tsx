import { calculateLocalAudienceDemand, labelForIndex, quoteCityPrice, type CityEconomicProfile } from "@/lib/cityEconomy";

interface CityEconomyPanelsProps {
  cities: CityEconomicProfile[];
  selectedCityId?: string;
  genreName?: string;
}

const money = (minor: number) => `$${(minor / 100).toFixed(2)}`;

export function CityEconomyOverview({ city }: { city: CityEconomicProfile }) {
  return (
    <section aria-label={`${city.cityId} economy overview`} className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-xl font-semibold">City economy</h2>
        <p className="text-sm text-muted-foreground">Scale: {city.cityScale.replace("_", " ")} · Population: {city.population.toLocaleString()} · Trend: {city.economicTrend.replace("_", " ")}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Cost of living" value={city.costOfLivingIndex} />
        <Metric label="Commercial rent" value={city.commercialRentIndex} />
        <Metric label="Wages" value={city.wageIndex} />
        <Metric label="Accommodation" value={city.accommodationCostIndex} />
        <Metric label="Consumer spending" value={city.consumerSpendingIndex} />
        <Metric label="Tourism" value={city.tourismIndex} />
        <Metric label="Music market" value={city.musicMarketSize} />
        <Metric label="Business confidence" value={city.businessConfidenceIndex} />
      </dl>
    </section>
  );
}

export function CityComparisonTable({ cities }: { cities: CityEconomicProfile[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="bg-muted"><th className="p-2 text-left">City</th><th>Living</th><th>Housing</th><th>Commercial</th><th>Wages</th><th>Utilities</th><th>Fuel</th><th>Tourism</th><th>Music demand</th><th>Opportunity</th></tr></thead>
        <tbody>{cities.map((city) => <tr key={city.cityId} className="border-t"><td className="p-2 font-medium">{city.cityId}</td><td>{city.costOfLivingIndex}</td><td>{city.residentialRentIndex}</td><td>{city.commercialRentIndex}</td><td>{city.wageIndex}</td><td>{city.utilityCostIndex}</td><td>{city.fuelCostIndex}</td><td>{city.tourismIndex}</td><td>{city.localAudienceDemand}</td><td>{city.businessConfidenceIndex}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function CompanyCityInsights({ city, weeklyBaseRentMinor = 50_000, weeklyBaseUtilityMinor = 15_000 }: { city: CityEconomicProfile; weeklyBaseRentMinor?: number; weeklyBaseUtilityMinor?: number }) {
  const rent = quoteCityPrice(city, weeklyBaseRentMinor, "commercial_rent");
  const utilities = quoteCityPrice(city, weeklyBaseUtilityMinor, "utilities");
  return (
    <section aria-label="Company city insights" className="rounded-lg border p-4">
      <h3 className="font-semibold">Local market insights</h3>
      <ul className="mt-2 space-y-1 text-sm">
        <li>Estimated weekly rent: {money(rent.finalAmountMinor)} ({rent.explanation.join(", ")})</li>
        <li>Estimated utilities: {money(utilities.finalAmountMinor)} ({utilities.explanation.join(", ")})</li>
        <li>Employment availability: {labelForIndex(city.employmentIndex)} ({city.employmentIndex})</li>
        <li>Consumer spending: {labelForIndex(city.consumerSpendingIndex)} ({city.consumerSpendingIndex})</li>
        <li>Main opportunity: {city.musicMarketSize > 120 ? "large music market" : "lower-cost positioning"}</li>
        <li>Main risk: {city.commercialRentIndex > 130 ? "high premises costs" : "smaller demand ceiling"}</li>
      </ul>
    </section>
  );
}

export function TourCityInsights({ city, genrePopularityIndex = 100 }: { city: CityEconomicProfile; genrePopularityIndex?: number }) {
  const accommodation = quoteCityPrice(city, 12_000, "accommodation");
  const transport = quoteCityPrice(city, 8_000, "transport");
  const demand = calculateLocalAudienceDemand(city, { genrePopularityIndex, venueCapacity: 500, ticketPriceMinor: 3_000, bandFame: 60 });
  return (
    <section aria-label="Tour city insights" className="rounded-lg border p-4">
      <h3 className="font-semibold">Gig planning signals</h3>
      <ul className="mt-2 space-y-1 text-sm">
        <li>Estimated local demand: {demand.estimatedPotentialAudience} / 500 attendees</li>
        <li>Accommodation level: {labelForIndex(city.accommodationCostIndex)} · {money(accommodation.finalAmountMinor)} estimate</li>
        <li>Transport costs: {labelForIndex(city.transportCostIndex)} · {money(transport.finalAmountMinor)} estimate</li>
        <li>Consumer spending: {labelForIndex(city.consumerSpendingIndex)}</li>
        <li>Tourism: {labelForIndex(city.tourismIndex)}</li>
      </ul>
    </section>
  );
}

export function AdminCityEconomyControlsSummary({ city }: { city: CityEconomicProfile }) {
  return (
    <section aria-label="Admin city economy controls" className="rounded-lg border p-4">
      <h3 className="font-semibold">Admin controls</h3>
      <p className="text-sm text-muted-foreground">Admins can adjust indices through audited server flows. Treasury balances must be changed through finance adjustments, not direct edits.</p>
      <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify({ cityScale: city.cityScale, costOfLivingIndex: city.costOfLivingIndex, wageIndex: city.wageIndex, tourismIndex: city.tourismIndex, businessConfidenceIndex: city.businessConfidenceIndex }, null, 2)}</pre>
    </section>
  );
}

export function CityEconomyPanels({ cities, selectedCityId, genreName }: CityEconomyPanelsProps) {
  const selected = cities.find((city) => city.cityId === selectedCityId) ?? cities[0];
  if (!selected) return null;
  return (
    <div className="space-y-4">
      <CityEconomyOverview city={selected} />
      <CityComparisonTable cities={cities} />
      <CompanyCityInsights city={selected} />
      <TourCityInsights city={selected} genrePopularityIndex={genreName ? 115 : 100} />
      <AdminCityEconomyControlsSummary city={selected} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium">{labelForIndex(value)} <span className="text-muted-foreground">({value})</span></dd></div>;
}
