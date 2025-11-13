import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Flame,
  Infinity,
  Loader2,
  PackageSearch,
  RefreshCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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

interface StoreItem extends Omit<EquipmentItemRecord, "stat_boosts"> {
  stat_boosts: Record<string, number> | null;
  gear_category?: GearCategory | null;
}

interface OwnedEquipmentRecord {
  id: string;
  condition: number | null;
  is_equipped: boolean | null;
  created_at: string | null;
  equipment?: EquipmentItemRecord | null;
}

const rarityStyles: Record<string, string> = {
  common: "border-muted bg-muted/40 text-muted-foreground",
  uncommon: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  rare: "border-blue-500/40 bg-blue-500/10 text-blue-600",
  epic: "border-purple-500/40 bg-purple-500/10 text-purple-600",
  legendary: "border-amber-500/40 bg-amber-500/10 text-amber-600",
};

const mapRowToItem = (row: EquipmentItemRecord): StoreItem => ({
  ...row,
  stat_boosts: normalizeEquipmentStatBoosts(row.stat_boosts),
});

const formatStatBoosts = (boosts: Record<string, number> | null) => {
  if (!boosts) return [];
  return Object.entries(boosts)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => ({ key, value }));
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

const EquipmentStore = () => {
  const queryClient = useQueryClient();
  const { profile, refetch } = useGameData();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const { data: items, isLoading: loadingItems } = useQuery<StoreItem[]>({
    queryKey: ["equipment-store-items"],
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

      if (error) throw error;
      return ((data as EquipmentItemRecord[] | null) ?? []).map(mapRowToItem);
    },
  });

  const { data: owned, isLoading: loadingOwned } = useQuery<OwnedEquipmentRecord[]>({
    queryKey: ["player-equipment", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("player_equipment")
        .select(
          `id, condition, is_equipped, created_at, equipment:equipment_items!equipment_id (
             id,
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
             auto_restock
           )`
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as OwnedEquipmentRecord[]) ?? [];
    },
    enabled: !!user?.id,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc("purchase_equipment_item" as any, { p_equipment_id: itemId });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Equipment purchased");
      queryClient.invalidateQueries({ queryKey: ["equipment-store-items"] });
      queryClient.invalidateQueries({ queryKey: ["player-equipment", user?.id] });
      await refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to complete purchase");
    },
  });

  const categories = useMemo<CategoryOption[]>(() => {
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

  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter((item) => {
      const categorySlug = item.gear_category?.slug ?? item.category;
      const matchesCategory = category === "all" || categorySlug === category;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, category, search]);

  const ownedIds = useMemo(() => {
    if (!owned) return new Set<string>();
    return new Set(owned.map((entry) => entry.equipment?.id).filter(Boolean) as string[]);
  }, [owned]);

  const cashOnHand = typeof profile?.cash === "number" ? profile.cash : 0;
  const fameScore = typeof profile?.fame === "number" ? profile.fame : 0;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipment Market</h1>
          <p className="text-muted-foreground">
            Outfit your rig with premium instruments, lighting packages, and touring essentials.
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

      <Tabs defaultValue="shop" className="space-y-6">
        <TabsList>
          <TabsTrigger value="shop">Storefront</TabsTrigger>
          <TabsTrigger value="owned">Owned gear</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>Browse catalogue</CardTitle>
              <CardDescription>Filter by category or search for a specific piece of gear.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row">
              <div className="flex w-full gap-3 md:max-w-xl">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search equipment..."
                />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="min-w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.value === "all" ? "All categories" : option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loadingItems ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 py-12 text-muted-foreground">
                <PackageSearch className="h-5 w-5" />
                <span>No equipment matches your filters.</span>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => {
                const boosts = formatStatBoosts(item.stat_boosts);
                const rarityKey = item.rarity?.toLowerCase() ?? "common";
                const rarityClass = rarityStyles[rarityKey] ?? rarityStyles.common;
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
                        <Badge variant="outline" className={rarityClass}>
                          {item.rarity ?? "Common"}
                        </Badge>
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
                            {item.price_fame > 0 ? `${item.price_fame.toLocaleString()} Fame` : "No fame cost"}
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
                          {boosts.map((boost) => (
                            <Badge key={boost.key} variant="outline" className={rarityClass}>
                              {boost.key}: +{boost.value}
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
              {loadingOwned ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !owned || owned.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  You haven&apos;t purchased any gear yet. Buy items from the storefront to populate your inventory.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {owned.map((entry) => (
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

export default EquipmentStore;
