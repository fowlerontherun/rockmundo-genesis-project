import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Wallet, Tag, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  formatGbp, isListingAvailable, isValidListingPrice, poundsToMinor, sellerPayoutMinor, canBuyListing,
} from "@/features/skin-market/rules";

const db = supabase as any;

interface Listing {
  id: string; seller_user_id: string; seller_profile_id: string; listing_kind: "item" | "set";
  item_type: "clothing" | "instrument" | null; item_id: string | null; collection_id: string;
  price_minor: number; status: string; reserved_until: string | null; created_at: string;
}
interface Sale {
  id: string; listing_id: string; seller_user_id: string; buyer_user_id: string; amount_minor: number;
  seller_payout_minor: number; status: string; created_at: string;
}

const invoke = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("skin-market", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
};

export function SkinMarketTab() {
  const { profileId, userId } = useActiveProfile();
  const qc = useQueryClient();
  const verified = useRef(false);

  const payout = useQuery({
    queryKey: ["skin-market-payout", userId],
    enabled: !!userId,
    queryFn: () => invoke({ action: "connect_status" }) as Promise<{ connected: boolean; charges_enabled?: boolean; payouts_enabled?: boolean }>,
  });

  const listings = useQuery({
    queryKey: ["skin-market-listings"],
    queryFn: async () => {
      const { data, error } = await db.from("skin_market_listings").select("*").in("status", ["open", "reserved", "sold", "cancelled"]).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const sales = useQuery({
    queryKey: ["skin-market-sales", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db.from("skin_market_sales").select("*").neq("status", "pending").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as Sale[];
    },
  });

  // What this character can sell: items from sets it bought
  const sellable = useQuery({
    queryKey: ["skin-market-sellable", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const [{ data: owned }, { data: purchases }, { data: bought }] = await Promise.all([
        db.from("player_owned_skins").select("item_type,item_id").eq("profile_id", profileId),
        db.from("skin_collection_purchases").select("collection_id").eq("profile_id", profileId),
        db.from("skin_market_sales").select("items").eq("buyer_profile_id", profileId).eq("status", "completed"),
      ]);
      const paidCollections = new Set((purchases ?? []).map((p: { collection_id: string }) => p.collection_id));
      const marketKeys = new Set<string>();
      for (const s of bought ?? []) for (const it of s.items ?? []) marketKeys.add(`${it.item_type}:${it.item_id}`);
      return { owned: (owned ?? []) as { item_type: string; item_id: string }[], paidCollections, marketKeys };
    },
  });

  const names = useQuery({
    queryKey: ["skin-market-names"],
    queryFn: async () => {
      const [{ data: c }, { data: i }, { data: col }] = await Promise.all([
        db.from("avatar_clothing_items").select("id,name,collection_id").not("collection_id", "is", null),
        db.from("instrument_skin_items").select("id,name,collection_id").not("collection_id", "is", null),
        db.from("skin_collections").select("id,name"),
      ]);
      const items = new Map<string, { name: string; collection_id: string; type: "clothing" | "instrument" }>();
      for (const r of c ?? []) items.set(r.id, { name: r.name, collection_id: r.collection_id, type: "clothing" });
      for (const r of i ?? []) items.set(r.id, { name: r.name, collection_id: r.collection_id, type: "instrument" });
      const collections = new Map<string, string>((col ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
      return { items, collections };
    },
  });

  const label = (l: Pick<Listing, "listing_kind" | "item_id" | "collection_id">) => {
    const col = names.data?.collections.get(l.collection_id) ?? "Skin set";
    return l.listing_kind === "set" ? `${col} — full set` : `${names.data?.items.get(l.item_id ?? "")?.name ?? "Item"} · ${col}`;
  };

  // Confirm purchase on return from checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("market_session");
    if (!sessionId || verified.current) return;
    verified.current = true;
    invoke({ action: "verify", sessionId })
      .then((d) => {
        if (d?.status === "unpaid") toast.error("Payment not completed.");
        else if (d?.status === "needs_refund") toast.error("Someone else got this item first. You've been refunded.");
        else toast.success(`Purchase complete — ${d?.items ?? 0} item(s) added to your wardrobe!`);
      })
      .catch((e: Error) => toast.error(e.message || "Could not confirm your payment yet."))
      .finally(() => {
        qc.invalidateQueries();
        params.delete("market_session");
        const q = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
      });
  }, [qc]);

  const onboard = useMutation({
    mutationFn: () => invoke({ action: "connect_onboard" }),
    onSuccess: (d) => { if (d?.url) window.location.href = d.url; },
    onError: (e: Error) => toast.error(e.message),
  });

  const buy = useMutation({
    mutationFn: (listingId: string) => invoke({ listingId, profileId }),
    onSuccess: (d) => { if (d?.url) window.location.href = d.url; },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("cancel_skin_listing", { p_listing_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Listing cancelled"); qc.invalidateQueries({ queryKey: ["skin-market-listings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sell form
  const [choice, setChoice] = useState("");
  const [price, setPrice] = useState("1.99");
  const options = useMemo(() => {
    if (!sellable.data || !names.data) return [];
    const { owned, paidCollections, marketKeys } = sellable.data;
    const ownedKeys = new Set(owned.map((o) => `${o.item_type}:${o.item_id}`));
    const opts: { value: string; label: string }[] = [];
    for (const colId of paidCollections) {
      const setItems = [...names.data.items.entries()].filter(([, v]) => v.collection_id === colId);
      if (setItems.length && setItems.every(([id, v]) => ownedKeys.has(`${v.type}:${id}`))) {
        opts.push({ value: `set:${colId}`, label: `${names.data.collections.get(colId) ?? "Set"} — full set` });
      }
    }
    for (const o of owned) {
      const meta = names.data.items.get(o.item_id);
      if (!meta) continue;
      if (paidCollections.has(meta.collection_id) || marketKeys.has(`${o.item_type}:${o.item_id}`)) {
        opts.push({ value: `item:${o.item_type}:${o.item_id}`, label: `${meta.name}` });
      }
    }
    return opts;
  }, [sellable.data, names.data]);

  const priceMinor = poundsToMinor(price);
  const list = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Choose a character first.");
      if (!isValidListingPrice(priceMinor)) throw new Error("Price must be between £0.99 and £49.99");
      const [kind, a, b] = choice.split(":");
      const params = kind === "set"
        ? { p_profile_id: profileId, p_kind: "set", p_item_type: null, p_item_id: null, p_collection_id: a, p_price_minor: priceMinor }
        : { p_profile_id: profileId, p_kind: "item", p_item_type: a, p_item_id: b, p_collection_id: null, p_price_minor: priceMinor };
      const { error } = await db.rpc("create_skin_listing", params);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Listed on the Skin Market"); setChoice(""); qc.invalidateQueries({ queryKey: ["skin-market-listings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = listings.data ?? [];
  const forSale = all.filter((l) => isListingAvailable(l) && l.seller_user_id !== userId);
  const mine = all.filter((l) => l.seller_user_id === userId && ["open", "reserved"].includes(l.status));
  const listingById = new Map(all.map((l) => [l.id, l]));
  const payoutsReady = !!payout.data?.charges_enabled;

  return (
    <div className="space-y-4 text-sm">
      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" />Payouts</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 pb-3">
          {payoutsReady ? <Badge variant="secondary">Ready to get paid</Badge> : <span className="text-muted-foreground">Set up payouts with Stripe to sell your skins for real money. The market keeps a 15% fee.</span>}
          <Button size="sm" variant={payoutsReady ? "outline" : "default"} disabled={onboard.isPending} onClick={() => onboard.mutate()}>
            {payoutsReady ? "Payout dashboard" : payout.data?.connected ? "Finish payout setup" : "Set up payouts"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" />Sell</CardTitle></CardHeader>
        <CardContent className="space-y-3 pb-3">
          {options.length === 0 ? (
            <p className="text-muted-foreground">Only skins bought with real money can be sold. Buy a set to start trading.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-[220px] flex-1">
                <Label className="text-xs">Item or set</Label>
                <Select value={choice} onValueChange={setChoice}>
                  <SelectTrigger><SelectValue placeholder="Choose what to sell" /></SelectTrigger>
                  <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 w-28">
                <Label className="text-xs">Price (£)</Label>
                <Input type="number" min={0.99} max={49.99} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="text-xs text-muted-foreground pb-2">
                You get {isValidListingPrice(priceMinor) ? formatGbp(sellerPayoutMinor(priceMinor)) : "—"}
              </div>
              <Button size="sm" disabled={!choice || !payoutsReady || list.isPending} onClick={() => list.mutate()}>List for sale</Button>
            </div>
          )}
          {!payoutsReady && options.length > 0 && <p className="text-xs text-muted-foreground">Set up payouts first to list items.</p>}
          {mine.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium">Your listings (items can't be worn while listed)</p>
              {mine.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                  <span className="truncate">{label(l)}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span>{formatGbp(l.price_minor)}</span>
                    {l.status === "reserved" && !isListingAvailable(l) ? <Badge variant="outline">In checkout</Badge>
                      : <Button size="sm" variant="ghost" onClick={() => cancel.mutate(l.id)}>Cancel</Button>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4" />For sale</CardTitle></CardHeader>
        <CardContent className="pb-3">
          {forSale.length === 0 ? <p className="text-muted-foreground">Nothing for sale right now.</p> : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {forSale.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 rounded border p-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{label(l)}</p>
                    <Badge variant="outline" className="text-[10px]">{l.listing_kind === "set" ? "Full set" : "Single item"}</Badge>
                  </div>
                  <Button size="sm" disabled={!profileId || !canBuyListing(l, userId) || buy.isPending} onClick={() => buy.mutate(l.id)}>
                    Buy {formatGbp(l.price_minor)}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {(sales.data?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />History</CardTitle></CardHeader>
          <CardContent className="space-y-1 pb-3">
            {sales.data!.map((s) => {
              const l = listingById.get(s.listing_id);
              const sold = s.seller_user_id === userId;
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{sold ? "Sold" : "Bought"} · {l ? label(l) : "Skin"}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span>{formatGbp(sold ? s.seller_payout_minor : s.amount_minor)}</span>
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
