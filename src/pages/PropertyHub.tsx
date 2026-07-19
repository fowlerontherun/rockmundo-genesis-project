import { useEffect, useState } from "react";
import { Building2, Home, KeyRound, Search, ShieldCheck, Wrench } from "lucide-react";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrencyMinor } from "@/services/banking/currency";

type PersistentProperty = {
  id: string;
  city: string;
  district: string;
  category: string;
  type: string;
  quality: number;
  sizeSqm: number;
  rooms: number;
  bedrooms: number;
  capacity: number;
  condition: number;
  prestige: number;
  valuationMinor: number;
  currencyCode: string;
  listingStatus: string;
  financeStatus: string;
  runningCosts?: Array<{ type: string; amountMinor: number; currencyCode: string; frequency: string }>;
  mortgageEligible: boolean;
};

const fallbackProperties: PersistentProperty[] = [
  {
    id: "persistent-seed-pending",
    city: "London",
    district: "Camden",
    category: "residential",
    type: "Studio flat",
    quality: 3,
    sizeSqm: 38,
    rooms: 2,
    bedrooms: 1,
    capacity: 2,
    condition: 100,
    prestige: 4,
    valuationMinor: 24000000,
    currencyCode: "GBP",
    listingStatus: "listed_for_sale",
    financeStatus: "unencumbered",
    runningCosts: [{ type: "maintenance", amountMinor: 12000, currencyCode: "GBP", frequency: "monthly" }],
    mortgageEligible: true,
  },
];

export default function PropertyHub() {
  const [properties, setProperties] = useState<PersistentProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadProperties = async () => {
      setLoading(true);
      const { data, error: rpcError } = await (supabase as any).rpc("list_persistent_properties");
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setProperties(fallbackProperties);
      } else {
        setError(null);
        setProperties(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    };
    void loadProperties();
    return () => { cancelled = true; };
  }, []);

  const featuredHome = properties.find((property) => property.category === "residential") ?? properties[0];
  const monthlyCosts = featuredHome?.runningCosts?.filter((cost) => cost.frequency === "monthly").reduce((sum, cost) => sum + cost.amountMinor, 0) ?? 0;
  const currencyCode = featuredHome?.currencyCode ?? "GBP";

  return <FMPageScaffold title="Property Hub" subtitle="Browse persistent real estate, inspect running costs and start mortgage journeys without demo-side purchases." icon={Building2} backTo="/finances">
    {error && <Card className="mb-4 border-amber-300 bg-amber-50"><CardContent className="pt-6 text-sm text-amber-900">Persistent property RPC unavailable: {error}. Showing non-mutating fallback data only.</CardContent></Card>}
    <div className="grid gap-4 md:grid-cols-4">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> Featured home</CardTitle></CardHeader><CardContent><p className="font-semibold">{featuredHome ? `${featuredHome.district} ${featuredHome.type}` : "No listed homes"}</p><p className="text-sm text-muted-foreground">Loaded from persistent property inventory; opening this page does not rent or buy anything.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Monthly costs</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrencyMinor({ amountMinor: monthlyCosts, currencyCode })}</p><p className="text-sm text-muted-foreground">Server-authored running costs for the selected listing.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Condition</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{featuredHome?.condition ?? 0}%</p><p className="text-sm text-muted-foreground">Persistent condition used by valuation and mortgage checks.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Security</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">RLS + RPC</p><p className="text-sm text-muted-foreground">Ownership changes are reserved for trusted database workflows.</p></CardContent></Card>
    </div>
    <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Marketplace</CardTitle><CardDescription>{loading ? "Loading persistent listings…" : "Searchable persistent listings with city, district, price, running costs and mortgage eligibility."}</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{properties.map((property) => <div key={property.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{property.district} {property.type}</p><p className="text-sm text-muted-foreground">{property.city} · {property.sizeSqm} sqm · {property.rooms} rooms · capacity {property.capacity}</p></div><Badge>{property.listingStatus.replace(/_/g, " ")}</Badge></div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><span>Value {formatCurrencyMinor({ amountMinor: property.valuationMinor, currencyCode: property.currencyCode })}</span><span>Prestige {property.prestige}</span><span>Condition {property.condition}%</span></div><div className="mt-3 flex items-center justify-between gap-2"><Badge variant={property.mortgageEligible ? "default" : "outline"}>{property.mortgageEligible ? "Mortgage eligible" : "Cash only"}</Badge><Button size="sm" variant="outline" disabled={!property.mortgageEligible}><KeyRound className="mr-2 h-4 w-4" /> Start application</Button></div></div>)}</CardContent></Card>
  </FMPageScaffold>;
}
