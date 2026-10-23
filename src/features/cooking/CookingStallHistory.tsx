import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Coins, History, PackageCheck, RefreshCcw, ShoppingBag, Trash2 } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DishIllustration } from "./CookingIllustrations";
import { COOKING_RECIPES } from "./recipeCatalogue";

export interface CookingStallSale {
  id: string;
  listing_id: string;
  buyer_profile_id: string;
  seller_profile_id: string;
  portions: number;
  subtotal: number;
  city_fee: number;
  seller_proceeds: number;
  purchased_at: string;
  recipe_slug: string;
  quality: number;
  food_expires_at: string;
}

export interface CookingStallExpiry {
  id: string;
  listing_id: string;
  seller_profile_id: string;
  returned_portions: number;
  spoiled_portions: number;
  processed_at: string;
  recipe_slug: string;
  quality: number;
  food_expires_at: string;
}

export interface CookingStallCancellation {
  id: string;
  listing_id: string;
  seller_profile_id: string;
  returned_portions: number;
  cancelled_at: string;
  recipe_slug: string;
  quality: number;
  food_expires_at: string;
}

type HistoryFilter = "all" | "bought" | "sold" | "expired" | "cancelled";
type HistoryEntry =
  | { kind: "bought" | "sold"; at: string; id: string; sale: CookingStallSale }
  | { kind: "expired"; at: string; id: string; expiry: CookingStallExpiry }
  | { kind: "cancelled"; at: string; id: string; cancellation: CookingStallCancellation };

const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    .format(amount);
const dateLabel = (value: string) => new Date(value).toLocaleString();
const dishName = (slug: string) => COOKING_RECIPES.find(recipe => recipe.slug === slug)?.name
  ?? slug.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const receiptFood = (entry: HistoryEntry) =>
  entry.kind === "expired" ? entry.expiry :
    entry.kind === "cancelled" ? entry.cancellation : entry.sale;

export function deriveCookingStallHistory(
  profileId: string,
  purchases: readonly CookingStallSale[],
  sales: readonly CookingStallSale[],
  expiries: readonly CookingStallExpiry[],
  cancellations: readonly CookingStallCancellation[] = [],
): HistoryEntry[] {
  const distinct = new Map<string, CookingStallSale>();
  for (const sale of [...purchases, ...sales]) distinct.set(sale.id, sale);
  const events: HistoryEntry[] = [];

  for (const sale of distinct.values()) {
    // Server RLS is authoritative. Re-check identity before rendering any receipt.
    if (sale.buyer_profile_id === profileId) {
      events.push({ kind: "bought", at: sale.purchased_at, id: `bought:${sale.id}`, sale });
    } else if (sale.seller_profile_id === profileId) {
      events.push({ kind: "sold", at: sale.purchased_at, id: `sold:${sale.id}`, sale });
    }
  }
  for (const expiry of expiries) {
    if (expiry.seller_profile_id !== profileId) continue;
    events.push({ kind: "expired", at: expiry.processed_at, id: `expired:${expiry.id}`, expiry });
  }
  for (const cancellation of cancellations) {
    if (cancellation.seller_profile_id !== profileId) continue;
    events.push({ kind: "cancelled", at: cancellation.cancelled_at,
      id: `cancelled:${cancellation.id}`, cancellation });
  }
  return events.sort((a, b) => {
    const left = Date.parse(a.at);
    const right = Date.parse(b.at);
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
}

const tabs: Array<{ value: HistoryFilter; label: string }> = [
  { value: "all", label: "All activity" },
  { value: "bought", label: "Bought" },
  { value: "sold", label: "Sold" },
  { value: "expired", label: "Expired listings" },
  { value: "cancelled", label: "Cancelled" },
];

/** Read-only trade receipts. All four tables enforce owner SELECT RLS. */
export function CookingStallHistory() {
  const { profileId } = useActiveProfile();
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const history = useQuery({
    queryKey: ["cooking-stall-history", profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<HistoryEntry[]> => {
      if (!profileId) return [];
      const [bought, sold, expired, cancelled] = await Promise.all([
        (supabase as any).from("cooking_food_stall_sales")
          .select("id,listing_id,buyer_profile_id,seller_profile_id,portions,subtotal,city_fee,seller_proceeds,purchased_at,recipe_slug,quality,food_expires_at")
          .eq("buyer_profile_id", profileId).order("purchased_at", { ascending: false }).limit(30),
        (supabase as any).from("cooking_food_stall_sales")
          .select("id,listing_id,buyer_profile_id,seller_profile_id,portions,subtotal,city_fee,seller_proceeds,purchased_at,recipe_slug,quality,food_expires_at")
          .eq("seller_profile_id", profileId).order("purchased_at", { ascending: false }).limit(30),
        (supabase as any).from("cooking_food_stall_expiry_events")
          .select("id,listing_id,seller_profile_id,returned_portions,spoiled_portions,processed_at,recipe_slug,quality,food_expires_at")
          .eq("seller_profile_id", profileId).order("processed_at", { ascending: false }).limit(30),
        (supabase as any).from("cooking_food_stall_cancellation_events")
          .select("id,listing_id,seller_profile_id,returned_portions,cancelled_at,recipe_slug,quality,food_expires_at")
          .eq("seller_profile_id", profileId).order("cancelled_at", { ascending: false }).limit(30),
      ]);
      if (bought.error) throw bought.error;
      if (sold.error) throw sold.error;
      if (expired.error) throw expired.error;
      if (cancelled.error) throw cancelled.error;
      return deriveCookingStallHistory(
        profileId,
        (bought.data ?? []) as CookingStallSale[],
        (sold.data ?? []) as CookingStallSale[],
        (expired.data ?? []) as CookingStallExpiry[],
        (cancelled.data ?? []) as CookingStallCancellation[],
      );
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const events = history.data ?? [];
  const visible = events.filter(event => filter === "all" || event.kind === filter);
  const recentSales = events.filter(event => event.kind === "sold");
  const recentPurchases = events.filter(event => event.kind === "bought");
  const earned = recentSales.reduce((sum, event) =>
    sum + (event.kind === "sold" ? event.sale.seller_proceeds : 0), 0);
  const spent = recentPurchases.reduce((sum, event) =>
    sum + (event.kind === "bought" ? event.sale.subtotal : 0), 0);
  const returned = events.reduce((sum, event) =>
    sum + (event.kind === "expired" ? event.expiry.returned_portions :
      event.kind === "cancelled" ? event.cancellation.returned_portions : 0), 0);
  const spoiled = events.reduce((sum, event) =>
    sum + (event.kind === "expired" ? event.expiry.spoiled_portions : 0), 0);

  return <Card id="cooking-stall-history">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <History className="h-5 w-5" />Food trading history
      </CardTitle>
      <CardDescription>
        Recent confirmed purchases, sales, cancellations and expired listings for your selected character.
        Seller earnings are shown after city fees. This history is read-only.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-secondary/30 p-3">
        <div className="flex shrink-0 gap-1" aria-hidden="true">
          <DishIllustration recipeSlug="fruit-tart" className="h-14 w-20 rounded-md" />
          <DishIllustration recipeSlug="vegetable-soup" className="h-14 w-20 rounded-md" />
        </div>
        <p className="text-sm text-muted-foreground">
          Your local food business ledger: recent orders, money earned, and what happened to unsold meals.
        </p>
      </div>
      {!profileId && <p role="status" className="text-sm">Select a character to view their food trading history.</p>}
      {history.isLoading && <p role="status" className="text-sm">Loading cooking trade receipts…</p>}
      {history.isError && <p role="alert" className="text-sm text-destructive">
        Could not load trade receipts. The records have not been changed.
      </p>}
      {history.data && <>
        <div className="grid gap-2 sm:grid-cols-4" aria-label="Recent trading totals">
          <div className="rounded-lg border p-3">
            <Coins className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Sales earned</p>
            <p className="font-semibold">{money(earned)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <ShoppingBag className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Purchases spent</p>
            <p className="font-semibold">{money(spent)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <PackageCheck className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Fresh food returned</p>
            <p className="font-semibold">{returned} portions</p>
          </div>
          <div className="rounded-lg border p-3">
            <Trash2 className="mb-1 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">Food spoiled</p>
            <p className="font-semibold">{spoiled} portions</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Totals cover only your most recent 30 receipts of each type, including cancelled returns, not lifetime earnings.</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter food trading history">
            {tabs.map(tab =>
              <Button key={tab.value} size="sm"
                variant={filter === tab.value ? "default" : "outline"}
                aria-pressed={filter === tab.value}
                onClick={() => setFilter(tab.value)}>{tab.label}</Button>)}
          </div>
          <Button size="sm" variant="outline" disabled={history.isFetching} onClick={() => void history.refetch()}>
            <RefreshCcw className="mr-2 h-4 w-4" />Refresh
          </Button>
        </div>
        {visible.length === 0 && <p role="status" className="text-sm text-muted-foreground">
          {filter === "all"
            ? "No food trading activity yet. Market transactions will appear here once trading opens."
            : "No matching food trading activity in your recent receipts."}
        </p>}
        <ul className="space-y-2" aria-label="Cooking stall receipts">
          {visible.map(entry => <li key={entry.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <div className="w-20 shrink-0 overflow-hidden rounded-md border" aria-hidden="true">
              <DishIllustration
                recipeSlug={receiptFood(entry).recipe_slug}
                className="h-16 w-20"
              />
            </div>
            <div className="min-w-0 flex-1">
              <strong>{entry.kind === "bought" ? "Food bought"
                : entry.kind === "sold" ? "Food sold"
                : entry.kind === "cancelled" ? "Listing cancelled"
                : "Listing expired"} · {dishName(receiptFood(entry).recipe_slug)}</strong>
              <p className="text-xs text-muted-foreground">{dateLabel(entry.at)}</p>
              <p className="text-xs text-muted-foreground">
                Quality {receiptFood(entry).quality}/100
                {" · "}Original expiry {dateLabel(receiptFood(entry).food_expires_at)}
              </p>
              {entry.kind === "expired"
                ? <p>{entry.expiry.returned_portions} fresh portion(s) returned
                  {" · "}{entry.expiry.spoiled_portions} portion(s) spoiled</p>
                : entry.kind === "cancelled"
                  ? <p>{entry.cancellation.returned_portions} fresh portion(s) returned to your kitchen</p>
                : <>
                  <p>{entry.sale.portions} portion(s) · Total {money(entry.sale.subtotal)}</p>
                  {entry.kind === "sold"
                    ? <p>City fee {money(entry.sale.city_fee)} · Earned {money(entry.sale.seller_proceeds)}</p>
                    : <p>City fee paid by seller; no additional buyer charge</p>}
                </>}
            </div>
          </li>)}
        </ul>
      </>}
    </CardContent>
  </Card>;
}
