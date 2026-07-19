import { useEffect, useState } from "react";
import { Banknote, Building2, Home, KeyRound, Search, ShieldCheck, Wrench } from "lucide-react";
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
  priceMinor: number;
  currencyCode: string;
  condition: number;
  prestige: number;
  sizeSqm: number;
  rooms: number;
  capacity: number;
  listingStatus: string;
  mortgageEligible: boolean;
};

export default function PropertyHub() {
  const [properties, setProperties] = useState<PersistentProperty[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    supabase.rpc("list_persistent_properties" as never)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setLoadState("error");
          return;
        }
        setProperties(Array.isArray(data) ? data as PersistentProperty[] : []);
        setLoadState("ready");
      });
    return () => { mounted = false; };
  }, []);

  const primaryHome = properties.find((property) => property.category === "residential") ?? properties[0];

  return <FMPageScaffold title="Property Hub" subtitle="Browse persistent real estate and start secure mortgage journeys." icon={Building2} backTo="/finances">
    <div className="grid gap-4 md:grid-cols-4">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Home className="h-5 w-5" /> Current home</CardTitle></CardHeader><CardContent><p className="font-semibold">{primaryHome ? `${primaryHome.district} ${primaryHome.type}` : "No residence selected"}</p><p className="text-sm text-muted-foreground">Loaded from persistent property inventory; no tenancy is created while rendering.</p></CardContent></Card>
      <Card><CardHeader><CardTitle>Indicative value</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{primaryHome ? formatCurrencyMinor({ amountMinor: primaryHome.priceMinor, currencyCode: primaryHome.currencyCode }) : "—"}</p><p className="text-sm text-muted-foreground">Persistent valuation for the selected marketplace property.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Condition</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{primaryHome ? `${primaryHome.condition}%` : "—"}</p><p className="text-sm text-muted-foreground">Condition comes from the `properties` table.</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Security</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">RLS + RPC</p><p className="text-sm text-muted-foreground">Ownership, completion and security changes are server-side responsibilities.</p></CardContent></Card>
    </div>

    <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5" /> Mortgage dashboard</CardTitle><CardDescription>Phase 8B no longer manufactures a mortgage on page load. Active contracts will appear here after the trusted completion RPC is enabled and succeeds.</CardDescription></CardHeader><CardContent><div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No demo mortgage was created. Use the application flow to create a persistent application, immutable offer, reservation and contract.</div></CardContent></Card>

    <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Marketplace</CardTitle><CardDescription>Persistent listings with city, district, price, size, prestige, condition and mortgage eligibility.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
      {loadState === "loading" && <p className="text-sm text-muted-foreground">Loading persistent properties…</p>}
      {loadState === "error" && <p className="text-sm text-destructive">Persistent property data is unavailable. Apply the Phase 8B migration and retry.</p>}
      {loadState === "ready" && properties.length === 0 && <p className="text-sm text-muted-foreground">No persistent property listings are currently available.</p>}
      {properties.map((property) => <div key={property.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{property.district} {property.type}</p><p className="text-sm text-muted-foreground">{property.city} · {property.sizeSqm} sqm · {property.rooms} rooms · capacity {property.capacity}</p></div><Badge>{property.listingStatus.replace(/_/g, " ")}</Badge></div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><span>Value {formatCurrencyMinor({ amountMinor: property.priceMinor, currencyCode: property.currencyCode })}</span><span>Prestige {property.prestige}</span><span>Condition {property.condition}%</span></div><Button className="mt-3" size="sm" variant="outline" disabled={!property.mortgageEligible}><KeyRound className="mr-2 h-4 w-4" /> {property.mortgageEligible ? "Start mortgage" : "Mortgage unavailable"}</Button></div>)}
    </CardContent></Card>
  </FMPageScaffold>;
}
