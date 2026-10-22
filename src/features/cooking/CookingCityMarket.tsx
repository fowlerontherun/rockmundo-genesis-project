import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CityInfo { name: string; country: string }
interface MarketIngredient {
  slug: string; display_name: string; category: string; shelf_life_hours: number;
}
interface CityOffer {
  id: string;
  ingredient_slug: string;
  unit_price: number;
  quality: number;
  stock: number;
  is_active: boolean;
  local_speciality: boolean;
}
interface PurchaseResult {
  status: "completed" | "already_completed";
  purchaseId: string;
  ingredientLotId: string;
  quantity: number;
  totalPrice: number;
}
const categories = ["All", "produce", "pantry", "dairy", "herbs", "drink"] as const;
type MarketCategory = typeof categories[number];

export function CookingCityMarket() {
  const { profile, profileId } = useActiveProfile();
  const cityId = profile?.current_city_id ?? null;
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<MarketCategory>("All");
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Hold the request identifier across a network timeout; a retry must not
  // charge cash or decrease stock twice.
  const pendingRequestIds = useRef(new Map<string, string>());

  const market = useQuery({
    queryKey: ["cooking-city-market", cityId],
    enabled: Boolean(cityId),
    queryFn: async () => {
      const [cityResponse, offersResponse, ingredientsResponse] = await Promise.all([
        supabase.from("cities").select("name,country").eq("id", cityId!).single(),
        (supabase as any).from("cooking_city_market_offers")
          .select("id,ingredient_slug,unit_price,quality,stock,is_active,local_speciality")
          .eq("city_id", cityId).order("ingredient_slug"),
        (supabase as any).from("cooking_market_ingredients")
          .select("slug,display_name,category,shelf_life_hours").order("slug"),
      ]);
      if (cityResponse.error) throw cityResponse.error;
      if (offersResponse.error) throw offersResponse.error;
      if (ingredientsResponse.error) throw ingredientsResponse.error;
      return {
        city: cityResponse.data as CityInfo,
        offers: (offersResponse.data ?? []) as CityOffer[],
        ingredients: (ingredientsResponse.data ?? []) as MarketIngredient[],
      };
    },
    staleTime: 30_000,
  });

  const lookup = useMemo(() => new Map((market.data?.ingredients ?? [])
    .map((ingredient) => [ingredient.slug, ingredient])), [market.data?.ingredients]);
  const visible = (market.data?.offers ?? []).filter((offer) => {
    const ingredient = lookup.get(offer.ingredient_slug);
    return ingredient && (category === "All" || ingredient.category === category);
  });
  const purchasing = useMutation({
    mutationFn: async (offer: CityOffer) => {
      if (!profileId || !cityId || !offer.is_active) throw new Error("Market is not accepting orders");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw new Error("Choose between 1 and 20 units");
      }
      const key = `${profileId}:${offer.id}:${quantity}`;
      let requestId = pendingRequestIds.current.get(key);
      if (!requestId) {
        requestId = crypto.randomUUID();
        pendingRequestIds.current.set(key, requestId);
      }
      const { data, error } = await (supabase as any).rpc("purchase_cooking_market_ingredient", {
        p_profile_id: profileId, p_offer_id: offer.id, p_quantity: quantity,
        p_request_id: requestId,
      });
      if (error) throw error;
      pendingRequestIds.current.delete(key);
      return data as PurchaseResult;
    },
    onSuccess: (result) => {
      setFeedback(`Purchased ${result.quantity} unit(s) for $${result.totalPrice}. Check kitchen inventory for expiry.`);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cooking-city-market", cityId] }),
        queryClient.invalidateQueries({ queryKey: ["cooking-inventory", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["active-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["profiles"] }),
      ]);
    },
    onError: (error: Error) => {
      setFeedback(error.message);
      void queryClient.invalidateQueries({ queryKey: ["cooking-city-market", cityId] });
    },
  });

  const marketOpen = Boolean(market.data?.offers.some((offer) => offer.is_active));
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />City food market</CardTitle>
      <CardDescription>
        Different cities stock different ingredients. Regional specialties have their own quality, availability and prices.
        Fresh ingredients spoil after a few days.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {!cityId && <p role="status" className="text-sm">Select a character in a city to see their local food market.</p>}
      {market.isLoading && <p role="status">Loading local produce and ingredient prices…</p>}
      {market.isError && <p role="alert" className="text-sm text-destructive">Could not load this city's market.</p>}
      {market.data && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">{market.data.city.name}, {market.data.city.country}</h3>
            <p className="text-sm text-muted-foreground">{market.data.offers.length} regional and staple products</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void market.refetch()} disabled={market.isFetching}>
            <RefreshCcw className="mr-2 h-4 w-4" />Refresh market
          </Button>
        </div>
        {!marketOpen && <p role="status" className="text-sm text-muted-foreground">
          The city's market is being prepared. You can browse its future stock, but purchases are not open yet.
        </p>}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Ingredient categories">
          {categories.map((item) => <Button key={item} size="sm"
            variant={category === item ? "default" : "outline"} aria-pressed={category === item}
            onClick={() => setCategory(item)}>
            {item === "All" ? item : item.charAt(0).toUpperCase() + item.slice(1)}
          </Button>)}
        </div>
        {marketOpen && <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="cooking-market-quantity" className="text-sm font-medium">Units per purchase</label>
          <select id="cooking-market-quantity" className="rounded-md border bg-background p-2"
            value={quantity} onChange={(event) => setQuantity(Number(event.target.value))}>
            {[1,2,3,4,5,10,20].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </div>}
        {visible.length === 0 && <p className="text-sm">No ingredients in this category.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((offer) => {
            const ingredient = lookup.get(offer.ingredient_slug)!;
            const canBuy = offer.is_active && offer.stock >= quantity && !purchasing.isPending;
            return <article key={offer.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-semibold">{ingredient.display_name}</h4>
                {offer.local_speciality && <span className="text-xs font-medium">Local produce</span>}
              </div>
              <p className="text-sm">${offer.unit_price} per unit · Quality {offer.quality}/100</p>
              <p className="text-xs text-muted-foreground">Stock: {offer.stock} · Shelf life: {ingredient.shelf_life_hours} hours</p>
              <Button size="sm" disabled={!canBuy || !profileId} onClick={() => purchasing.mutate(offer)}>
                {!offer.is_active ? "Not on sale yet" : offer.stock < quantity ? "Out of stock" :
                  `Buy ${quantity} for $${offer.unit_price * quantity}`}
              </Button>
            </article>;
          })}
        </div>
      </>}
      {purchasing.isPending && <p role="status">Processing ingredient purchase securely…</p>}
      {feedback && <p role="status" className="text-sm">{feedback}</p>}
    </CardContent>
  </Card>;
}
