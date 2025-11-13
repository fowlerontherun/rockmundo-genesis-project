import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Filter,
  Flame,
  Infinity,
  Loader2,
  PackageSearch,
  RefreshCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { usePlayerEquipment } from "@/hooks/usePlayerEquipment";
import { supabase } from "@/integrations/supabase/client";
import {
  GearQualityTier,
  deriveQualityTier,
  getQualityLabel,
  qualityTierStyles,
} from "@/utils/gearQuality";
import { GearRarityKey, getRarityLabel, parseRarityKey, rarityStyles } from "@/utils/gearRarity";
import {
  type EquipmentItemRecord,
  type GearCategory,
  normalizeEquipmentStatBoosts,
} from "@/types/gear";

interface CategoryOption {
  value: string;
  label: string;
  sort: number;
}

interface GearShopItem extends Omit<EquipmentItemRecord, "stat_boosts"> {
  stat_boosts: Record<string, number> | null;
  gear_category?: GearCategory | null;
  qualityTier: GearQualityTier;
  rarityKey: GearRarityKey;
}

type QualityFilterValue = "all" | GearQualityTier;
type RarityFilterValue = "all" | GearRarityKey;
type CurrencyFilterValue = "all" | "cash" | "fame" | "hybrid";
type StockFilterValue = "all" | "limited" | "unlimited" | "auto-restock";

const QUALITY_FILTERS: QualityFilterValue[] = [
  "all",
  "budget",
  "standard",
  "professional",
  "boutique",
  "experimental",
];

const CURRENCY_FILTER_OPTIONS: Array<{ value: CurrencyFilterValue; label: string }> = [
  { value: "all", label: "All costs" },
  { value: "cash", label: "Cash only" },
  { value: "fame", label: "Fame only" },
  { value: "hybrid", label: "Cash + Fame" },
];

const STOCK_FILTER_OPTIONS: Array<{ value: StockFilterValue; label: string }> = [
  { value: "all", label: "Any stock policy" },
  { value: "limited", label: "Limited stock" },
  { value: "unlimited", label: "Unlimited stock" },
  { value: "auto-restock", label: "Auto restock" },
];

const mapRowToItem = (row: EquipmentItemRecord): GearShopItem => {
  const statBoosts = normalizeEquipmentStatBoosts(row.stat_boosts);
  const qualityTier = deriveQualityTier(row.price_cash, statBoosts);
  const rarityKey = parseRarityKey(row.rarity);

  return {
    ...row,
    stat_boosts: statBoosts,
    qualityTier,
    rarityKey,
  };
};

const formatStatBoosts = (boosts: Record<string, number> | null) => {
  if (!boosts) {
    return [];
  }

  return Object.entries(boosts).filter(([, value]) => typeof value === "number");
};

const matchesCurrencyFilter = (item: EquipmentItemRecord, filter: CurrencyFilterValue) => {
  const hasCashCost = item.price_cash > 0;
  const hasFameCost = item.price_fame > 0;

  switch (filter) {
    case "cash":
      return hasCashCost && !hasFameCost;
    case "fame":
      return hasFameCost && !hasCashCost;
    case "hybrid":
      return hasCashCost && hasFameCost;
    default:
      return true;
  }
};

const matchesStockFilter = (item: EquipmentItemRecord, filter: StockFilterValue) => {
  switch (filter) {
    case "limited":
      return item.is_stock_tracked;
    case "unlimited":
      return !item.is_stock_tracked;
    case "auto-restock":
      return Boolean(item.auto_restock);
    default:
      return true;
  }
};

const formatPurchaseLabel = (item: EquipmentItemRecord) => {
  const hasCashCost = item.price_cash > 0;
  const hasFameCost = item.price_fame > 0;

  if (hasCashCost && hasFameCost) {
    return `Purchase for $${item.price_cash.toLocaleString()} + ${item.price_fame.toLocaleString()} Fame`;
  }

  if (hasCashCost) {
    return `Purchase for $${item.price_cash.toLocaleString()}`;
  }

  if (hasFameCost) {
    return `Unlock for ${item.price_fame.toLocaleString()} Fame`;
  }

  return "Add to inventory";
};

const GearShop = () => {
  const queryClient = useQueryClient();
  const { profile, refetch } = useGameData();
  const { user } = useAuth();
  const { data: ownedEquipment } = usePlayerEquipment();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [rarity, setRarity] = useState<RarityFilterValue>("all");
  const [quality, setQuality] = useState<QualityFilterValue>("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilterValue>("all");
  const [stockFilter, setStockFilter] = useState<StockFilterValue>("all");

  const { data: items, isLoading: loadingItems } = useQuery<GearShopItem[]>({
    queryKey: ["gear-shop-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_items")
        .select(
          `id,
           name,
           category,
           gear_category_id,
           gear_category:gear_categories (id, slug, label, description, icon, sort_order),
           subcategory,
           price_cash,
           price_fame,
           rarity,
           description,
           stat_boosts,
           stock,
           is_stock_tracked,
           auto_restock`
        )
        .order("price_cash");

      if (error) {
        throw error;
      }

      return ((data as EquipmentItemRecord[] | null) ?? []).map(mapRowToItem);
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc("purchase_equipment_item" as any, { p_equipment_id: itemId });
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Gear purchased");
      queryClient.invalidateQueries({ queryKey: ["gear-shop-items"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-store-items"] });
      queryClient.invalidateQueries({ queryKey: ["player-equipment", user?.id] });
      await refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to complete purchase");
    },
  });

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    if (!items) {
      return [{ value: "all", label: "All categories", sort: -1 }];
    }

    const mapped = new Map<string, CategoryOption>();

    items.forEach((item) => {
      const slug = item.gear_category?.slug ?? item.category;
      const label = item.gear_category?.label ?? item.category;
      const sort = item.gear_category?.sort_order ?? Number.MAX_SAFE_INTEGER;

      if (!mapped.has(slug)) {
        mapped.set(slug, { value: slug, label, sort });
      }
    });

    const sorted = Array.from(mapped.values()).sort((a, b) => {
      if (a.sort === b.sort) {
        return a.label.localeCompare(b.label);
      }

      return a.sort - b.sort;
    });

    return [{ value: "all", label: "All categories", sort: -1 }, ...sorted];
  }, [items]);

  const rarityFilters = useMemo(() => {
    if (!items) {
      return ["all"] as RarityFilterValue[];
    }

    const unique = new Set<GearRarityKey>();
    items.forEach((item) => unique.add(item.rarityKey));

    return ["all", ...Array.from(unique)] as RarityFilterValue[];
  }, [items]);

  const ownedIds = useMemo(() => {
    if (!ownedEquipment) {
      return new Set<string>();
    }

    const ids = ownedEquipment
      .map((entry) => entry.equipment?.id)
      .filter((value): value is string => Boolean(value));

    return new Set(ids);
  }, [ownedEquipment]);

  const filteredItems = useMemo(() => {
    if (!items) {
      return [];
    }

    return items.filter((item) => {
      const categorySlug = item.gear_category?.slug ?? item.category;
      const matchesCategory = category === "all" || categorySlug === category;
      const matchesRarity = rarity === "all" || item.rarityKey === rarity;
      const matchesQuality = quality === "all" || item.qualityTier === quality;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCurrency = matchesCurrencyFilter(item, currencyFilter);
      const matchesStockPolicy = matchesStockFilter(item, stockFilter);

      return (
        matchesCategory &&
        matchesRarity &&
        matchesQuality &&
        matchesCurrency &&
        matchesStockPolicy &&
        matchesSearch
      );
    });
  }, [items, category, rarity, quality, currencyFilter, stockFilter, search]);

  const cashOnHand = typeof profile?.cash === "number" ? profile.cash : 0;
  const fameScore = typeof profile?.fame === "number" ? profile.fame : 0;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gear Shop</h1>
          <p className="text-muted-foreground">
            Outfit your rig with curated gear tiers. Rarity and quality directly amplify your performance stats.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 shadow-sm">
            <BadgeDollarSign className="h-4 w-4 text-primary" />
            <span className="font-medium">Cash</span>
            <Separator orientation="vertical" className="h-4" />
            <span>${cashOnHand.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 shadow-sm">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="font-medium">Fame</span>
            <Separator orientation="vertical" className="h-4" />
            <span>{fameScore.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
          <CardDescription>Search by category, rarity, currency type, or stock policy to find upgrades faster.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-6">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search gear..."
            className="md:col-span-2"
          />

          <div className="md:col-span-1">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Item type" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.value === "all" ? "All categories" : option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-1">
            <Select value={rarity} onValueChange={(value) => setRarity(value as RarityFilterValue)}>
              <SelectTrigger>
                <SelectValue placeholder="Rarity" />
              </SelectTrigger>
              <SelectContent>
                {rarityFilters.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "all" ? "All rarities" : getRarityLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-1">
            <Select value={quality} onValueChange={(value) => setQuality(value as QualityFilterValue)}>
              <SelectTrigger>
                <SelectValue placeholder="Quality tier" />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_FILTERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "all" ? "All quality" : getQualityLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-1">
            <Select value={currencyFilter} onValueChange={(value) => setCurrencyFilter(value as CurrencyFilterValue)}>
              <SelectTrigger>
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-1">
            <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as StockFilterValue)}>
              <SelectTrigger>
                <SelectValue placeholder="Stock policy" />
              </SelectTrigger>
              <SelectContent>
                {STOCK_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="catalogue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="owned">Owned gear</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue" className="space-y-6">
          {loadingItems ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-12 text-muted-foreground">
                <PackageSearch className="h-5 w-5" />
                <span>No gear matches your filters.</span>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => {
                const boosts = formatStatBoosts(item.stat_boosts);
                const rarityClass = rarityStyles[item.rarityKey];
                const qualityClass = qualityTierStyles[item.qualityTier];
                const isOwned = ownedIds.has(item.id);
                const outOfStock = item.is_stock_tracked && (item.stock ?? 0) <= 0;

                const stockTone = !item.is_stock_tracked
                  ? "text-emerald-600"
                  : outOfStock
                  ? "text-destructive"
                  : item.stock && item.stock <= 2
                  ? "text-amber-600"
                  : "text-muted-foreground";

                const stockLabel = !item.is_stock_tracked
                  ? "Unlimited availability"
                  : outOfStock
                  ? "Sold out"
                  : `${item.stock ?? 0} in stock`;

                const purchaseLabel = formatPurchaseLabel(item);

                return (
                  <Card key={item.id} className="flex flex-col border-2">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">{item.name}</CardTitle>
                          <CardDescription>
                            {item.subcategory || item.gear_category?.label || item.category}
                          </CardDescription>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline" className={rarityClass}>
                            {getRarityLabel(item.rarityKey)}
                          </Badge>
                          <Badge variant="outline" className={qualityClass}>
                            {getQualityLabel(item.qualityTier)}
                          </Badge>
                        </div>
                      </div>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                          <span className="font-semibold">
                            {item.price_cash > 0 ? `$${item.price_cash.toLocaleString()}` : "No cash cost"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Shield className="h-4 w-4" />
                          <span>{item.gear_category?.label ?? item.category}</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-600">
                          <Flame className="h-4 w-4" />
                          <span>
                            {item.price_fame > 0
                              ? `${item.price_fame.toLocaleString()} Fame`
                              : "No fame cost"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ShoppingBag className="h-4 w-4" />
                          <span className={stockTone}>{stockLabel}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        {!item.is_stock_tracked ? (
                          <Badge variant="secondary" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600">
                            <Infinity className="mr-1 h-3 w-3" /> Unlimited stock
                          </Badge>
                        ) : null}
                        {item.auto_restock && item.is_stock_tracked ? (
                          <Badge variant="secondary" className="border-blue-500/40 bg-blue-500/10 text-blue-600">
                            <RefreshCcw className="mr-1 h-3 w-3" /> Auto restock
                          </Badge>
                        ) : null}
                        {isOwned ? (
                          <Badge variant="secondary" className="border-primary/40 bg-primary/10 text-primary">
                            Already owned
                          </Badge>
                        ) : null}
                      </div>

                      {boosts.length > 0 ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {boosts.map(([stat, value]) => (
                            <Badge key={stat} variant="outline" className={rarityClass}>
                              {stat}: +{value}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      <Button
                        className="mt-auto"
                        disabled={purchaseMutation.isPending || isOwned || outOfStock}
                        onClick={() => purchaseMutation.mutate(item.id)}
                      >
                        {isOwned
                          ? "Already owned"
                          : outOfStock
                          ? "Out of stock"
                          : purchaseMutation.isPending
                          ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
                              </>
                            )
                          : purchaseLabel}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="owned">
          <Card>
            <CardHeader>
              <CardTitle>Owned gear</CardTitle>
              <CardDescription>Quick view of inventory ready to assign in your loadouts.</CardDescription>
            </CardHeader>
            <CardContent>
              {!ownedEquipment || ownedEquipment.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  You haven&apos;t purchased any gear yet. Buy items from the catalogue to populate your loadout inventory.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {ownedEquipment.map((entry) => (
                    <div key={entry.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{entry.equipment?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.equipment?.gear_category?.label ?? entry.equipment?.category}
                          </p>
                        </div>
                        {entry.is_equipped ? (
                          <Badge variant="secondary" className="border-blue-500/40 bg-blue-500/10 text-blue-600">
                            Equipped
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {entry.equipment?.rarity ? `Rarity: ${entry.equipment.rarity}` : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GearShop;
