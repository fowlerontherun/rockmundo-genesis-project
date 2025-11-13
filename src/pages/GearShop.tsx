import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  CheckCircle2,
  Filter,
  Info,
  Loader2,
  PackageSearch,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
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
import { GearComparisonDrawer, type ComparableGearItem } from "@/components/gear/GearComparisonDrawer";
import type { PlayerEquipmentWithItem } from "@/hooks/usePlayerEquipment";

interface GearShopItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  rarity: string | null;
  description: string | null;
  stat_boosts: Record<string, number> | null;
  stock: number | null;
  qualityTier: GearQualityTier;
  rarityKey: GearRarityKey;
}

type QualityFilterValue = "all" | GearQualityTier;
type RarityFilterValue = "all" | GearRarityKey;

type RawEquipmentRow = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  rarity: string | null;
  description: string | null;
  stat_boosts: Record<string, number> | null;
  stock: number | null;
};

const QUALITY_FILTERS: QualityFilterValue[] = [
  "all",
  "budget",
  "standard",
  "professional",
  "boutique",
  "experimental",
];

const normalizeStatBoosts = (value: unknown): Record<string, number> | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entries: Array<[string, number]> = [];

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const numericValue = typeof raw === "number" && Number.isFinite(raw) ? raw : Number(raw);

    if (!Number.isFinite(numericValue)) {
      continue;
    }

    entries.push([key, numericValue]);
  }

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries);
};

const mapRowToItem = (row: RawEquipmentRow): GearShopItem => {
  const statBoosts = normalizeStatBoosts(row.stat_boosts);
  const qualityTier = deriveQualityTier(row.price, statBoosts);
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

const GearShop = () => {
  const queryClient = useQueryClient();
  const { profile, refetch } = useGameData();
  const { user } = useAuth();
  const {
    data: ownedEquipment,
    isLoading: loadingOwnedEquipment,
    error: ownedEquipmentError,
  } = usePlayerEquipment();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [rarity, setRarity] = useState<RarityFilterValue>("all");
  const [quality, setQuality] = useState<QualityFilterValue>("all");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GearShopItem | null>(null);
  const [confirmationItem, setConfirmationItem] = useState<GearShopItem | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState<string[]>([]);

  const {
    data: items,
    isLoading: loadingItems,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery<GearShopItem[]>({
    queryKey: ["gear-shop-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_items")
        .select("id, name, category, subcategory, price, rarity, description, stat_boosts, stock")
        .order("price");

      if (error) {
        throw error;
      }

      return ((data as RawEquipmentRow[] | null) ?? []).map(mapRowToItem);
    },
  });

  const handleOpenComparison = (item: GearShopItem) => {
    setSelectedItem(item);
    setComparisonOpen(true);
  };

  const handleInitiatePurchase = (item: GearShopItem) => {
    setConfirmationItem(item);
    setConfirmationOpen(true);
  };

  const purchaseMutation = useMutation({
    mutationFn: async (item: GearShopItem) => {
      const { error } = await supabase.rpc("purchase_equipment_item" as any, { p_equipment_id: item.id });
      if (error) {
        throw error;
      }
    },
    onSuccess: async (_, item) => {
      toast.success(`${item.name} added to your inventory`);

      setRecentPurchases((previous) => {
        if (previous.includes(item.id)) {
          return previous;
        }
        return [...previous, item.id];
      });

      queryClient.setQueryData<GearShopItem[] | undefined>(["gear-shop-items"], (current) => {
        if (!current) {
          return current;
        }

        return current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                stock:
                  typeof entry.stock === "number" && Number.isFinite(entry.stock)
                    ? Math.max(entry.stock - 1, 0)
                    : entry.stock,
              }
            : entry,
        );
      });

      queryClient.setQueryData<PlayerEquipmentWithItem[] | undefined>(
        ["player-equipment", user?.id],
        (current) => {
          const existing = current ?? [];

          const alreadyPresent = existing.some((entry) => entry.equipment?.id === item.id);

          if (alreadyPresent) {
            return existing;
          }

          const optimisticEntry: PlayerEquipmentWithItem = {
            id: `optimistic-${Date.now()}`,
            equipment_id: item.id,
            condition: 100,
            is_equipped: false,
            created_at: new Date().toISOString(),
            equipment: {
              id: item.id,
              name: item.name,
              category: item.category,
              subcategory: item.subcategory,
              price: item.price,
              rarity: item.rarityKey,
              description: item.description,
              stat_boosts: item.stat_boosts,
              stock: item.stock,
            },
          };

          return [optimisticEntry, ...existing];
        },
      );

      setConfirmationOpen(false);
      setConfirmationItem(null);
      await refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to complete purchase");
      setConfirmationOpen(false);
      setConfirmationItem(null);
    },
  });

  const categories = useMemo(() => {
    if (!items) {
      return ["all"];
    }

    const unique = new Set(items.map((item) => item.category));
    return ["all", ...Array.from(unique)];
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
      const matchesCategory = category === "all" || item.category === category;
      const matchesRarity = rarity === "all" || item.rarityKey === rarity;
      const matchesQuality = quality === "all" || item.qualityTier === quality;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());

      return matchesCategory && matchesRarity && matchesQuality && matchesSearch;
    });
  }, [items, category, rarity, quality, search]);

  const cashOnHand = typeof profile?.cash === "number" ? profile.cash : 0;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gear Shop</h1>
          <p className="text-muted-foreground">
            Outfit your rig with curated gear tiers. Rarity and quality directly amplify your performance stats.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm shadow-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">Budget</span>
          <Separator orientation="vertical" className="h-4" />
          <span>${cashOnHand.toLocaleString()}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
          <CardDescription>Search by item type, rarity tier, or quality band to zero in on upgrades.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search gear..."
            className="md:col-span-2"
          />

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Item type" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((option) => (
                <SelectItem key={option} value={option}>
                  {option === "all" ? "All types" : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
        </CardContent>
      </Card>

      <Tabs defaultValue="catalogue" className="space-y-6">
        <TabsList>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          <TabsTrigger value="owned">Owned gear</TabsTrigger>
        </TabsList>

        <TabsContent value="catalogue" className="space-y-6">
          {itemsError ? (
            <Card className="border-destructive/50">
              <CardContent className="space-y-4 py-10 text-sm">
                <div className="flex items-center gap-2 font-semibold text-destructive">
                  <Info className="h-5 w-5" />
                  Unable to load gear catalogue
                </div>
                <p className="text-muted-foreground">
                  We couldn&apos;t reach the gear vault. Check your connection and try refreshing the list below.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    refetchItems();
                  }}
                >
                  Retry loading gear
                </Button>
              </CardContent>
            </Card>
          ) : loadingItems ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="border-2">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-10 w-20" />
                    </div>
                    <Skeleton className="h-16 w-full" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-9 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-12 text-center text-sm text-muted-foreground">
                <div className="flex justify-center">
                  <PackageSearch className="h-5 w-5" />
                </div>
                <p>No gear matches your filters right now.</p>
                <p>
                  Try resetting rarity or quality tiers, or browse adjacent categories to discover synergistic loadout pieces.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => {
                const boosts = formatStatBoosts(item.stat_boosts);
                const rarityClass = rarityStyles[item.rarityKey];
                const qualityClass = qualityTierStyles[item.qualityTier];
                const isOwned = ownedIds.has(item.id);
                const outOfStock = (item.stock ?? 0) <= 0;
                const justPurchased = recentPurchases.includes(item.id);

                const stockTone = outOfStock
                  ? "text-destructive"
                  : item.stock && item.stock <= 2
                  ? "text-amber-600"
                  : "text-muted-foreground";

                return (
                  <Card key={item.id} className="flex flex-col border-2">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">{item.name}</CardTitle>
                          <CardDescription>{item.subcategory || item.category}</CardDescription>
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
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenComparison(item)}>
                          Preview impact
                        </Button>
                        {justPurchased ? (
                          <div className="flex items-center gap-2 rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Added to inventory
                          </div>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                          <span className="font-semibold">${item.price.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Shield className="h-4 w-4" />
                          <span>{item.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4" />
                          <span className={`${stockTone}`}>
                            {outOfStock ? "Sold out" : `${item.stock ?? 0} in stock`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <BadgeDollarSign className="h-4 w-4" />
                          <span>{isOwned ? "Owned" : "Available"}</span>
                        </div>
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
                        onClick={() => handleInitiatePurchase(item)}
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
                          : `Purchase for $${item.price.toLocaleString()}`}
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
              {ownedEquipmentError ? (
                <div className="space-y-3 py-12 text-center text-sm">
                  <p className="font-semibold text-destructive">We couldn&apos;t fetch your inventory.</p>
                  <p className="text-muted-foreground">
                    Reopen the page or purchase any item to resync. Your previous gear remains safe.
                  </p>
                </div>
              ) : loadingOwnedEquipment ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Card key={index} className="border">
                      <CardContent className="space-y-3 py-4">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !ownedEquipment || ownedEquipment.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  You haven&apos;t purchased any gear yet. Buy items from the catalogue to populate your loadout inventory.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {ownedEquipment.map((entry) => (
                    <Card key={entry.id} className="border">
                      <CardContent className="space-y-3 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{entry.equipment?.name ?? "Equipment"}</div>
                            <div className="text-xs text-muted-foreground">
                              {entry.equipment?.category}
                              {entry.equipment?.subcategory ? ` · ${entry.equipment.subcategory}` : ""}
                            </div>
                          </div>
                          {entry.equipment ? (
                            <Badge variant="outline" className={rarityStyles[parseRarityKey(entry.equipment.rarity)]}>
                              {getRarityLabel(entry.equipment.rarity)}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Purchase price</span>
                          <span>${entry.equipment?.price?.toLocaleString() ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Condition</span>
                          <span>{entry.condition ?? 100}%</span>
                        </div>
                        {entry.equipment?.stat_boosts ? (
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {Object.entries(entry.equipment.stat_boosts).map(([stat, value]) => (
                              <Badge
                                key={stat}
                                variant="outline"
                                className={rarityStyles[parseRarityKey(entry.equipment?.rarity)]}
                              >
                                {stat}: +{value}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <GearComparisonDrawer
        item={selectedItem as ComparableGearItem | null}
        open={comparisonOpen}
        onOpenChange={(open) => {
          setComparisonOpen(open);
          if (!open) {
            setSelectedItem(null);
          }
        }}
        ownedEquipment={ownedEquipment}
        cashOnHand={cashOnHand}
      />

      <AlertDialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          setConfirmationOpen(open);
          if (!open) {
            setConfirmationItem(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm purchase</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 text-sm">
              {confirmationItem ? (
                <>
                  <p>
                    You&apos;re about to buy <span className="font-semibold">{confirmationItem.name}</span> for
                    {" "}
                    <span className="font-semibold">${confirmationItem.price.toLocaleString()}</span>.
                  </p>
                  <ul className="space-y-2">
                    <li className="rounded-md border bg-muted/30 px-3 py-2">
                      <span className="font-medium">Remaining balance:</span>{" "}
                      ${Math.max(cashOnHand - confirmationItem.price, 0).toLocaleString()}
                    </li>
                    <li className="rounded-md border bg-muted/30 px-3 py-2">
                      <span className="font-medium">Stock status:</span>{" "}
                      {(confirmationItem.stock ?? 0) > 0
                        ? `${confirmationItem.stock} left in vault`
                        : "Marked as sold out"}
                    </li>
                    <li className="rounded-md border bg-muted/30 px-3 py-2">
                      <span className="font-medium">Ownership check:</span>{" "}
                      {ownedIds.has(confirmationItem.id)
                        ? "You already own this item. Duplicate purchase will stack in inventory."
                        : "No duplicates detected in your inventory."}
                    </li>
                  </ul>
                </>
              ) : (
                <p>Select a gear item to review its purchase summary.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purchaseMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!confirmationItem || purchaseMutation.isPending}
              onClick={() => confirmationItem && purchaseMutation.mutate(confirmationItem)}
            >
              {purchaseMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing
                </span>
              ) : (
                "Confirm purchase"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GearShop;
