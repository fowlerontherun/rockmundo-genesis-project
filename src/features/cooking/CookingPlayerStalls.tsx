import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, ScrollText, ShoppingBag, Store } from "lucide-react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DishIllustration } from "./CookingIllustrations";
import { COOKING_RECIPES } from "./recipeCatalogue";
import { foodAvailability, type FoodBatch } from "./foodBatchRules";

interface SellerFood {
  id: string;
  profile_id: string;
  recipe_slug: string;
  portions: number;
  quality: number;
  prepared_at: string;
  expires_at: string;
}
interface CityListing {
  id: string;
  recipeSlug: string;
  sellerName: string;
  quality: number;
  pricePerPortion: number;
  portions: number;
  expiresAt: string;
  batchExpiresAt: string;
}
interface MarketResponse {
  enabled: boolean;
  cityId: string;
  listings: CityListing[];
  /** Trusted, city-scoped legal notice; absent on older server deployments. */
  blockedRecipes?: Array<{ recipeSlug: string; reason: string }>;
}
interface MyListing {
  id: string;
  food_batch_id: string;
  status: string;
  portions_remaining: number;
  price_per_portion: number;
  expires_at: string;
}
interface Receipt {
  status: string;
  listingId?: string;
  batchId?: string;
  returnedPortions?: number;
  subtotal?: number;
  fee?: number;
}
const titleCase = (value: string) =>
  value.replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
const showDate = (date: string) => new Date(date).toLocaleString();
const approvedStarterSlugs = new Set(COOKING_RECIPES.map(recipe => recipe.slug));
const dishName = (slug: string) => COOKING_RECIPES.find(recipe => recipe.slug === slug)?.name ?? titleCase(slug);

/**
 * UUIDs survive reloads and uncertain HTTP responses in the current tab.
 * Server receipts and row locks (not sessionStorage) enforce real idempotency.
 */
function retryId(key: string, fallback: Map<string, string>): string {
  const name = `rockmundo:cooking-stall:${key}`;
  try {
    const stored = window.sessionStorage.getItem(name);
    if (stored) return stored;
  } catch { /* Some browser privacy modes disable storage. */ }
  const existing = fallback.get(name);
  if (existing) return existing;
  const id = crypto.randomUUID();
  fallback.set(name, id);
  try { window.sessionStorage.setItem(name, id); } catch { /* fallback remains valid */ }
  return id;
}
function clearRetryId(key: string, fallback: Map<string, string>) {
  const name = `rockmundo:cooking-stall:${key}`;
  fallback.delete(name);
  try { window.sessionStorage.removeItem(name); } catch { /* no storage permission */ }
}

export function CookingPlayerStalls() {
  const { profile, profileId } = useActiveProfile();
  const cityId = profile?.current_city_id ?? null;
  const queryClient = useQueryClient();
  const pendingIds = useRef(new Map<string, string>());
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [portionCount, setPortionCount] = useState(1);
  const [unitPrice, setUnitPrice] = useState(100);
  const [listingHours, setListingHours] = useState(2);
  const [buyCounts, setBuyCounts] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");

  const market = useQuery({
    queryKey: ["cooking-player-stalls", profileId, cityId],
    enabled: Boolean(profileId && cityId),
    queryFn: async (): Promise<MarketResponse> => {
      const { data, error } = await (supabase as any).rpc("browse_cooking_food_stalls", {
        p_profile_id: profileId, p_limit: 40,
      });
      if (error) throw error;
      if (!data || typeof data.enabled !== "boolean" || !Array.isArray(data.listings)) {
        throw new Error("Invalid local food market response");
      }
      return data as MarketResponse;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const ownFood = useQuery({
    queryKey: ["cooking-stall-owned-food", profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<SellerFood[]> => {
      const { data, error } = await (supabase as any).from("cooking_food_batches")
        .select("id,profile_id,recipe_slug,portions,quality,prepared_at,expires_at")
        .eq("profile_id", profileId).gt("portions", 0).order("expires_at");
      if (error) throw error;
      return (data ?? []) as SellerFood[];
    },
  });
  const ownListings = useQuery({
    queryKey: ["cooking-stall-own-listings", profileId],
    enabled: Boolean(profileId),
    queryFn: async (): Promise<MyListing[]> => {
      const { data, error } = await (supabase as any).from("cooking_food_stall_listings")
        .select("id,food_batch_id,status,portions_remaining,price_per_portion,expires_at")
        .eq("seller_profile_id", profileId).order("created_at", { ascending: false }).limit(25);
      if (error) throw error;
      return (data ?? []) as MyListing[];
    },
  });

  const refresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cooking-player-stalls", profileId, cityId] }),
      queryClient.invalidateQueries({ queryKey: ["cooking-stall-own-listings", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["cooking-stall-history", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["cooking-stall-owned-food", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["cooking-inventory", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["cooking-food-effects", profileId] }),
      queryClient.invalidateQueries({ queryKey: ["active-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["profiles"] }),
    ]);
  };
  const active = Boolean(market.data?.enabled && market.data.cityId === cityId);
  // Fail closed if two fields of a server response conflict. The database is
  // still authoritative at checkout; this only prevents a misleading Buy UI.
  const blockedSlugs = new Set(market.data?.blockedRecipes?.map(rule => rule.recipeSlug) ?? []);
  const visibleListings = (market.data?.listings ?? [])
    .filter(listing => !blockedSlugs.has(listing.recipeSlug));
  const freshFood = (ownFood.data ?? []).filter(food => {
    const batch: FoodBatch = {
      id: food.id, profileId: food.profile_id, recipeSlug: food.recipe_slug,
      portions: food.portions, quality: food.quality,
      preparedAt: food.prepared_at, expiresAt: food.expires_at,
    };
    return foodAvailability(batch, Date.now()) === "fresh" && approvedStarterSlugs.has(food.recipe_slug);
  });
  const selected = freshFood.find(food => food.id === selectedBatchId) ?? freshFood[0];

  const createListing = useMutation({
    mutationFn: async () => {
      if (!active || !profileId || !selected) throw new Error("Trading is not open.");
      if (!Number.isSafeInteger(portionCount) || portionCount < 1 ||
          portionCount > Math.min(20, selected.portions)) {
        throw new Error("Choose 1–20 available portions.");
      }
      if (!Number.isSafeInteger(unitPrice) || unitPrice < 1 || unitPrice > 1_000_000) {
        throw new Error("Choose a unit price between $1 and $1,000,000.");
      }
      const key = `list:${profileId}:${selected.id}:${portionCount}:${unitPrice}:${listingHours}`;
      const id = retryId(key, pendingIds.current);
      const { data, error } = await (supabase as any).rpc("create_cooking_food_stall_listing", {
        p_profile_id: profileId, p_food_batch_id: selected.id, p_portions: portionCount,
        p_price_per_portion: unitPrice,
        p_expires_at: new Date(Date.now() + listingHours * 3_600_000).toISOString(),
        p_listing_id: id,
      });
      if (error) throw error;
      clearRetryId(key, pendingIds.current);
      return data as Receipt;
    },
    onSuccess: () => { setMessage("Food reserved for your city stall. Unsold portions can be reclaimed while fresh."); refresh(); },
    onError: (error: Error) => { setMessage(`Could not list food: ${error.message}`); refresh(); },
  });
  const purchase = useMutation({
    mutationFn: async ({ listing, quantity }: { listing: CityListing; quantity: number }) => {
      if (!profileId || !active || !Number.isSafeInteger(quantity) ||
        quantity < 1 || quantity > Math.min(20, listing.portions)) {
        throw new Error("Select an available quantity between 1 and 20.");
      }
      const key = `buy:${profileId}:${listing.id}:${quantity}`;
      const id = retryId(key, pendingIds.current);
      const { data, error } = await (supabase as any).rpc("purchase_cooking_food_stall_listing", {
        p_buyer_profile_id: profileId,p_listing_id: listing.id,
        p_portions: quantity,p_request_id: id,
      });
      if (error) throw error;
      clearRetryId(key, pendingIds.current);
      return data as Receipt;
    },
    onSuccess: (result) => { setMessage(`Food purchased for $${result.subtotal}; city fee $${result.fee} was paid by the seller.`); refresh(); },
    onError: (error: Error) => { setMessage(`Purchase not confirmed: ${error.message}. Retry the same quantity safely.`); refresh(); },
  });
  const cancel = useMutation({
    mutationFn: async (listing: MyListing) => {
      if (!profileId) throw new Error("Choose your character.");
      const { data, error } = await (supabase as any).rpc("cancel_cooking_food_stall_listing", {
        p_profile_id: profileId,p_listing_id: listing.id,
      });
      if (error) throw error;
      return data as Receipt;
    },
    onSuccess: result => { setMessage(`Listing closed. ${result.returnedPortions ?? 0} fresh unsold portions returned.`); refresh(); },
    onError: (error: Error) => { setMessage(`Cannot close listing: ${error.message}`); refresh(); },
  });

  return <Card id="cooking-player-stalls">
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />Player food stalls</CardTitle>
      <CardDescription>
        Buy freshly cooked food from other musicians in your city or reserve portions of your own batches for sale.
        Food keeps its original expiry. Listings and checkout are authorised by the game server.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-secondary/30 p-3">
        <div className="flex shrink-0 gap-1" aria-hidden="true">
          <DishIllustration recipeSlug="apple-pie" className="h-16 w-20 rounded-md" />
          <DishIllustration recipeSlug="rice-bowl" className="h-16 w-20 rounded-md" />
          <DishIllustration recipeSlug="vegetable-soup" className="h-16 w-20 rounded-md" />
        </div>
        <p className="text-sm text-muted-foreground">
          Fresh, locally traded meals — 5% example city fee is deducted from the seller's proceeds, not added to your checkout.
        </p>
      </div>
      {!profileId || !cityId ? <p role="status">Select a character in a city to visit the food stalls.</p> : null}
      {market.isLoading && <p role="status">Checking local food stalls…</p>}
      {market.isError && <p role="alert">Food stalls could not be verified. Trading controls remain unavailable.</p>}
      {market.data && !active && <p role="status" className="text-sm text-muted-foreground">
        Player food trading is being prepared. The free cooking workshops and recipe previews remain available.
      </p>}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">City stall offers</h3>
        <Button variant="outline" size="sm" disabled={!profileId || market.isFetching}
          onClick={() => { void market.refetch(); void ownListings.refetch(); void ownFood.refetch(); }}>
          <RefreshCcw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
      {active && Boolean(market.data?.blockedRecipes?.length) &&
        <section aria-label="Local food trading restrictions" className="space-y-3 rounded-xl border p-3">
          <div className="flex items-start gap-2">
            <ScrollText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div>
              <h4 className="font-semibold">Local food trading rules</h4>
              <p className="text-xs text-muted-foreground">
                These dishes cannot be sold at stalls in your current city.
                Local rules do not remove meals already in your kitchen.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {market.data?.blockedRecipes?.map(rule => <article key={rule.recipeSlug}
              className="flex items-center gap-3 rounded-lg border bg-secondary/20 p-2">
              <DishIllustration recipeSlug={rule.recipeSlug}
                className="h-14 w-20 shrink-0 rounded-md" />
              <div className="min-w-0 text-sm">
                <p className="font-medium">{dishName(rule.recipeSlug)}</p>
                <p className="text-xs text-muted-foreground">{rule.reason}</p>
              </div>
            </article>)}
          </div>
        </section>}
      {active && visibleListings.length === 0 && <p className="text-sm text-muted-foreground">
        No fresh cooked-food listings in this city right now.
      </p>}
      {active && <div className="grid gap-3 sm:grid-cols-2">
        {visibleListings.map(listing => {
          const quantity = buyCounts[listing.id] ?? 1;
          const canBuy = listing.portions >= quantity &&
            Date.parse(listing.expiresAt) > Date.now() &&
            Date.parse(listing.batchExpiresAt) > Date.now() && !purchase.isPending;
          return <article key={listing.id} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center gap-3">
              <DishIllustration recipeSlug={listing.recipeSlug} className="h-20 w-28 shrink-0 rounded-md" />
              <div>
                <h4 className="font-semibold">{dishName(listing.recipeSlug)}</h4>
                <p className="text-xs text-muted-foreground">Cooked by {listing.sellerName}</p>
                <p className="text-sm">Quality {listing.quality}/100 · ${listing.pricePerPortion} per portion</p>
              </div>
            </div>
            <p className="text-xs">Available {listing.portions} · Listing expires {showDate(listing.expiresAt)}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm" htmlFor={`food-stall-buy-${listing.id}`}>Portions</label>
              <select id={`food-stall-buy-${listing.id}`} className="rounded-md border bg-background p-2"
                value={Math.min(quantity, listing.portions)}
                onChange={event => setBuyCounts(previous => ({ ...previous,[listing.id]:Number(event.target.value) }))}>
                {Array.from({ length: Math.min(listing.portions,20) }, (_,i) => i+1).map(value =>
                  <option key={value} value={value}>{value}</option>)}
              </select>
              <Button size="sm" disabled={!canBuy}
                onClick={() => purchase.mutate({ listing, quantity })}>
                <ShoppingBag className="mr-2 h-4 w-4" />Buy ${quantity * listing.pricePerPortion}
              </Button>
            </div>
          </article>;
        })}
      </div>}

      <section className="space-y-3 border-t pt-4" aria-label="Your food stall">
        <h3 className="font-semibold">Your stall</h3>
        {active && <>
          {ownFood.isError && <p role="alert">Could not load your prepared food for listing.</p>}
          {freshFood.length === 0 && <p className="text-sm text-muted-foreground">
            Cook some food first to list fresh portions for sale.
          </p>}
          {selected && <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
            <label className="grid min-w-[11rem] flex-1 gap-1 text-sm">Prepared dish
              <select value={selected.id} onChange={e => setSelectedBatchId(e.target.value)}
                className="rounded-md border bg-background p-2">
                {freshFood.map(food => <option key={food.id} value={food.id}>
                  {dishName(food.recipe_slug)} · {food.portions} portions
                </option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Portions
              <input aria-label="Portions to list" type="number" min={1}
                max={Math.min(20,selected.portions)} value={portionCount}
                onChange={e => setPortionCount(Number(e.target.value))}
                className="w-24 rounded-md border bg-background p-2" />
            </label>
            <label className="grid gap-1 text-sm">Price per portion ($)
              <input type="number" min={1} max={1_000_000} value={unitPrice}
                onChange={e => setUnitPrice(Number(e.target.value))}
                className="w-32 rounded-md border bg-background p-2" />
            </label>
            <label className="grid gap-1 text-sm">Listing duration
              <select value={listingHours} onChange={e => setListingHours(Number(e.target.value))}
                className="rounded-md border bg-background p-2">
                <option value={0.5}>30 minutes</option>
                <option value={2}>2 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
            </label>
            <Button disabled={!active || createListing.isPending ||
              portionCount < 1 || portionCount > Math.min(20,selected.portions) ||
              !Number.isSafeInteger(portionCount) || unitPrice < 1 ||
              !Number.isSafeInteger(unitPrice) || unitPrice > 1_000_000}
              onClick={() => createListing.mutate()}>
              {createListing.isPending ? "Reserving…" : "List fresh portions"}
            </Button>
          </div>}
        </>}
        {ownListings.isError && <p role="alert">Could not load your existing listings.</p>}
        {(ownListings.data ?? []).filter(listing => listing.status === "open").length > 0 && <ul className="space-y-2">
          {ownListings.data!.filter(listing => listing.status === "open").map(listing =>
            <li key={listing.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{listing.portions_remaining} reserved portion(s) · ${listing.price_per_portion} each · Expires {showDate(listing.expires_at)}</span>
              <Button variant="outline" size="sm" disabled={cancel.isPending || !profileId}
                onClick={() => cancel.mutate(listing)}>Cancel listing</Button>
            </li>)}
        </ul>}
        <p className="text-xs text-muted-foreground">
          Listed portions cannot be eaten or used for another sale. After expiry, fresh unsold food returns automatically; spoiled food cannot be recovered. All prices and quantities are rechecked at checkout.
        </p>
      </section>
      {(createListing.isPending || purchase.isPending || cancel.isPending) &&
        <p role="status" className="text-sm">Confirming the food-stall transaction with the server…</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </CardContent>
  </Card>;
}
