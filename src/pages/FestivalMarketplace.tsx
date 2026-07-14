import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Store, DollarSign, Loader2 } from "lucide-react";

const money = (cents: number | null | undefined) => `$${(Number(cents ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function FestivalMarketplace() {
  const qc = useQueryClient();
  const { profileId } = useActiveProfile();
  const [offer, setOffer] = useState<Record<string, string>>({});

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["festival-marketplace"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("festival_sale_listings")
        .select("*, festival:festivals(id, name, prestige_tier, city:cities(name,country), start_date, expected_attendance, owner_type, treasury_cents)")
        .eq("status", "active")
        .order("listed_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: myFestivals = [] } = useQuery({
    queryKey: ["my-festivals", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("festivals").select("id,name,prestige_tier,edition_number,treasury_cents,city:cities(name)").eq("owner_profile_id", profileId);
      return data || [];
    },
  });

  const buy = useMutation({
    mutationFn: async ({ festival_id, price_cents }: { festival_id: string; price_cents: number }) => {
      const { error } = await (supabase as any).rpc("purchase_festival", { p_festival_id: festival_id, p_buyer_profile_id: profileId, p_price_cents: price_cents });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Festival purchased!");
      qc.invalidateQueries({ queryKey: ["festival-marketplace"] });
      qc.invalidateQueries({ queryKey: ["my-festivals"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const makeOffer = useMutation({
    mutationFn: async ({ festival_id, listing_id, price_cents }: { festival_id: string; listing_id: string; price_cents: number }) => {
      const { error } = await (supabase as any).from("festival_purchase_offers").insert({
        festival_id, listing_id, buyer_profile_id: profileId, offer_price_cents: price_cents,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offer submitted");
      qc.invalidateQueries({ queryKey: ["festival-marketplace"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <FMPageScaffold title="Festival Marketplace" subtitle="Buy, sell, and manage festivals" icon={Store} backTo="/festivals">
      <Tabs defaultValue="marketplace">
        <TabsList>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="owned">My Festivals ({myFestivals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace">
          {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : listings.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">No festivals for sale right now.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {listings.map((l: any) => (
                <Card key={l.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{l.festival?.name}</CardTitle>
                        <CardDescription>{l.festival?.city?.name}, {l.festival?.city?.country} · Prestige {l.festival?.prestige_tier}/5</CardDescription>
                      </div>
                      <Badge>{l.listed_by_type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Asking price</span><span className="font-bold">{money(l.asking_price_cents)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Treasury</span><span>{money(l.festival?.treasury_cents)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Attendance</span><span>{l.festival?.expected_attendance?.toLocaleString()}</span></div>
                    {l.notes && <div className="text-xs italic">{l.notes}</div>}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => buy.mutate({ festival_id: l.festival_id, price_cents: l.asking_price_cents })} disabled={buy.isPending}>
                        <DollarSign className="h-3 w-3 mr-1" /> Buy now
                      </Button>
                      <Input
                        type="number"
                        placeholder="Offer $"
                        className="h-8 w-28"
                        value={offer[l.id] || ""}
                        onChange={e => setOffer({ ...offer, [l.id]: e.target.value })}
                      />
                      <Button size="sm" variant="outline" onClick={() => {
                        const cents = Math.round(parseFloat(offer[l.id] || "0") * 100);
                        if (cents <= 0) { toast.error("Enter an offer"); return; }
                        makeOffer.mutate({ festival_id: l.festival_id, listing_id: l.id, price_cents: cents });
                      }}>Offer</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="owned">
          {myFestivals.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">You don't own any festivals yet. Buy one from the marketplace.</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {myFestivals.map((f: any) => (
                <Card key={f.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{f.name}</CardTitle>
                    <CardDescription>{f.city?.name} · Prestige {f.prestige_tier}/5 · Edition #{f.edition_number}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Treasury</span><span className="font-bold">{money(f.treasury_cents)}</span></div>
                    <Button size="sm" asChild className="w-full"><Link to={`/festivals/${f.id}/manage`}>Open Owner Console</Link></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
}
