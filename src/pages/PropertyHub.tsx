import { useMemo } from "react";
import { Building2, Home, KeyRound, Search, ShieldCheck, Wrench } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateCityProperties, rentProperty, type PropertyTemplate } from "@/services/banking/propertyPhase8A";
import { formatCurrencyMinor } from "@/services/banking/currency";

const templates: PropertyTemplate[] = [
  { id: "camden-studio", city: "London", district: "Camden", category: "residential", type: "Studio", quality: 3, sizeSqm: 38, rooms: 2, bedrooms: 1, capacity: 2, monthlyCosts: { maintenance: { amountMinor: 12000, currencyCode: "GBP" }, utilities: { amountMinor: 9000, currencyCode: "GBP" }, localTaxes: { amountMinor: 7000, currencyCode: "GBP" }, cleaning: { amountMinor: 4000, currencyCode: "GBP" } }, purchaseValue: { amountMinor: 24000000, currencyCode: "GBP" }, rentalValue: { amountMinor: 95000, currencyCode: "GBP" }, maintenanceLevel: 2, prestige: 4, upgradePotential: 5, storageCapacity: 120 },
  { id: "brooklyn-practice", city: "New York", district: "Brooklyn", category: "commercial", type: "Practice Room", quality: 4, sizeSqm: 85, rooms: 4, bedrooms: 0, capacity: 8, monthlyCosts: { maintenance: { amountMinor: 18000, currencyCode: "USD" }, utilities: { amountMinor: 14000, currencyCode: "USD" }, security: { amountMinor: 6000, currencyCode: "USD" } }, purchaseValue: { amountMinor: 52000000, currencyCode: "USD" }, rentalValue: { amountMinor: 180000, currencyCode: "USD" }, maintenanceLevel: 3, prestige: 6, upgradePotential: 8, storageCapacity: 300 },
];

export default function PropertyHub() {
  const properties = useMemo(() => generateCityProperties(templates, { "camden-studio": 4, "brooklyn-practice": 2 }), []);
  const home = rentProperty(properties[0], { type: "player", id: "demo-player" }, { monthlyRent: templates[0].rentalValue, deposit: { amountMinor: 190000, currencyCode: "GBP" }, leaseStart: "2026-08-01", noticePeriodDays: 30, furnished: true, utilitiesIncluded: false });
  const monthlyCosts = Object.values(home.monthlyCosts).reduce((sum, m) => sum + m.amountMinor, 0) + (home.lease?.monthlyRent.amountMinor ?? 0);

  return <FMPageScaffold title="Property Hub" subtitle="Own, rent, maintain and browse real estate before mortgages arrive." icon={Building2} backTo="/finances">
    <div className="grid gap-4 md:grid-cols-4">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> Current home</CardTitle></CardHeader><CardContent><p className="font-semibold">{home.district} {home.type}</p><p className="text-sm text-muted-foreground">Official address for travel and life systems.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Monthly costs</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrencyMinor({ amountMinor: monthlyCosts, currencyCode: "GBP" })}</p><p className="text-sm text-muted-foreground">Rent, maintenance, utilities and taxes.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Condition</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{home.condition}%</p><p className="text-sm text-muted-foreground">Affects prestige, happiness, productivity and value.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Permissions</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">Owner + occupant</p><p className="text-sm text-muted-foreground">Ready for partners, bandmates, guests and employees.</p></CardContent></Card>
    </div>
    <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Marketplace</CardTitle><CardDescription>Searchable persistent listings with city, district, price, rent, size, prestige, type and availability filters.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{properties.map((property) => <div key={property.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{property.district} {property.type}</p><p className="text-sm text-muted-foreground">{property.city} · {property.sizeSqm} sqm · capacity {property.storage.capacity}</p></div><Badge>{property.listingStatus.replace("_", " ")}</Badge></div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><span>Value {formatCurrencyMinor(property.estimatedMarketValue)}</span><span>Prestige {property.prestige}</span><span>Condition {property.condition}%</span></div><Button className="mt-3" size="sm" variant="outline"><KeyRound className="mr-2 h-4 w-4" /> View transaction</Button></div>)}</CardContent></Card>
  </FMPageScaffold>;
}
