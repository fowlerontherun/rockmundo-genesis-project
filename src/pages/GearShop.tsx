import { type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeDollarSign, Filter, Loader2, PackageSearch, Shield, ShoppingBag, ShoppingCart, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import {
  usePlayerEquipment,
  type PlayerGearPoolStatus,
} from "@/hooks/usePlayerEquipment";
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

interface GearShopItem extends Omit<EquipmentItemRecord, "stat_boosts"> {
  stat_boosts: Record<string, number> | null;
  gear_category?: GearCategory | null;
  qualityTier: GearQualityTier;
  rarityKey: GearRarityKey;
}

interface GearShopSnapshotRow {
  equipment_id: string;
  stock: number | null;
  cash: number | null;
  reserved_funds: number | null;
}

interface PurchaseResultRow {
  player_equipment_id: string | null;
  remaining_stock: number | null;
  new_cash: number | null;
}

interface OptimisticReservationState {
  reservedStock: number;
  reservedFunds: number;
}

type PurchaseMutationInput = {
  item: GearShopItem;
};

type PurchaseMutationContext = {
  itemId: string;
  price: number;
};

interface PurchaseResult {
  player_equipment_id: string;
  remaining_stock: number | null;
  new_cash: number | null;
  new_secondary_balance: number | null;
  pool_category: string | null;
  slot_kind: string | null;
  remaining_pool_capacity: number | null;
}

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

interface PurchaseMutationResult {
  playerEquipmentId: string | null;
  remainingStock: number | null;
  newCash: number | null;
}

interface EquipPromptState {
  item: GearShopItem;
  playerEquipmentId: string | null;
}

const formatStatLabel = (label: string) =>
  label
    .split(/[_-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const formatNumericValue = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(1);

const GearShop = () => {
  const queryClient = useQueryClient();
  const { profile, refetch } = useGameData();
  const { user } = useAuth();
  const { data: equipmentData } = usePlayerEquipment();
  const ownedEquipment = equipmentData?.items ?? [];
  const gearPoolStatus = equipmentData?.poolStatus ?? [];

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [rarity, setRarity] = useState<RarityFilterValue>("all");
  const [quality, setQuality] = useState<QualityFilterValue>("all");
  const [equipPrompt, setEquipPrompt] = useState<EquipPromptState | null>(null);

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

  const poolByCategory = useMemo(() => {
    const map = new Map<string, PlayerGearPoolStatus>();
    gearPoolStatus.forEach((status) => {
      if (status?.category) {
        map.set(status.category, status);
      }
    });
    return map;
  }, [gearPoolStatus]);

  const purchaseMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc("purchase_equipment_item" as any, {
        p_equipment_id: itemId,
      });
      if (error) {
        throw error;
      }
      return Array.isArray(data) && data.length > 0 ? (data[0] as PurchaseResult) : undefined;
    },
    onSuccess: async (result) => {
      const remainingSlots = result?.remaining_pool_capacity;
      const slotLabel = result?.slot_kind ?? "gear";
      const slotMessage =
        typeof remainingSlots === "number"
          ? `${remainingSlots} ${slotLabel} slot${remainingSlots === 1 ? "" : "s"} remaining`
          : "Ready for loadout assignment";
      toast.success(`Gear purchased. ${slotMessage}`);
      queryClient.invalidateQueries({ queryKey: ["gear-shop-items"] });
      queryClient.invalidateQueries({ queryKey: ["equipment-store-items"] });
      queryClient.invalidateQueries({ queryKey: ["player-equipment", user?.id] });
      await refetch();
    },
    onError: (error: Error) => {
      const message =
        error.message?.includes("Gear pool is full")
          ? error.message
          : error.message || "Unable to complete purchase";
      toast.error(message);
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

  const equippedInCategory = useMemo(() => {
    if (!equipPrompt || !ownedEquipment) {
      return null;
    }

    return (
      ownedEquipment.find(
        (entry) =>
          entry.is_equipped &&
          entry.equipment?.category === equipPrompt.item.category &&
          entry.id !== equipPrompt.playerEquipmentId,
      ) ?? null
    );
  }, [equipPrompt, ownedEquipment]);

  const statComparisons = useMemo(() => {
    if (!equipPrompt) {
      return [] as Array<{ stat: string; currentValue: number; nextValue: number; diff: number }>;
    }

    const nextStats = equipPrompt.item.stat_boosts ?? {};
    const currentStats = normalizeStatBoosts(equippedInCategory?.equipment?.stat_boosts ?? null) ?? {};
    const keys = new Set([...Object.keys(nextStats), ...Object.keys(currentStats)]);

    return Array.from(keys)
      .map((key) => {
        const currentValue = currentStats[key] ?? 0;
        const nextValue = nextStats[key] ?? 0;
        const diff = Number((nextValue - currentValue).toFixed(2));
        return { stat: key, currentValue, nextValue, diff };
      })
      .sort((a, b) => a.stat.localeCompare(b.stat));
  }, [equipPrompt, equippedInCategory]);

  const handleClosePrompt = () => setEquipPrompt(null);

  const handleOpenLoadout = () => {
    if (equipPrompt?.playerEquipmentId) {
      navigate("/gear", { state: { preselectGearId: equipPrompt.playerEquipmentId } });
    } else {
      navigate("/gear");
    }
    setEquipPrompt(null);
  };

  const handleEquipNow = () => {
    if (!equipPrompt?.playerEquipmentId) {
      toast.error("Unable to equip item yet. Please refresh and try again.");
      return;
    }

    const positivePieces = statComparisons
      .filter((entry) => entry.diff > 0)
      .map((entry) => `+${formatNumericValue(entry.diff)} ${formatStatLabel(entry.stat)}`);

    const activityMessage = positivePieces.length
      ? `Equipped ${equipPrompt.item.name} (${positivePieces.join(", ")})`
      : `Equipped ${equipPrompt.item.name}`;

    const statDelta = statComparisons.reduce<Record<string, number>>((acc, entry) => {
      if (entry.diff !== 0) {
        acc[entry.stat] = entry.diff;
      }
      return acc;
    }, {});

    equipGear(
      {
        playerEquipmentId: equipPrompt.playerEquipmentId,
        equip: true,
        unequipIds: equippedInCategory ? [equippedInCategory.id] : undefined,
        activityMessage,
        activityMetadata: {
          gearId: equipPrompt.playerEquipmentId,
          gearName: equipPrompt.item.name,
          category: equipPrompt.item.category,
          statDelta,
          newStats: equipPrompt.item.stat_boosts ?? {},
          previousGearId: equippedInCategory?.id ?? null,
          previousGearName: equippedInCategory?.equipment?.name ?? null,
          previousStats: normalizeStatBoosts(equippedInCategory?.equipment?.stat_boosts ?? null) ?? {},
        },
      },
      {
        onSuccess: () => {
          toast.success(`${equipPrompt.item.name} equipped`);
          setEquipPrompt(null);
        },
      },
    );
  };

  const cashOnHand = typeof profile?.cash === "number" ? profile.cash : 0;
  const profileReservedFunds = parseNumericValue(profile?.reserved_funds, 0);

  const snapshotMap = useMemo(() => {
    const map = new Map<string, GearShopSnapshotRow>();

    if (Array.isArray(snapshotRows)) {
      snapshotRows.forEach((row) => {
        if (row?.equipment_id) {
          map.set(row.equipment_id, row);
        }
      });
    }

    return map;
  }, [snapshotRows]);

  const baselineCash = snapshotRows && snapshotRows.length > 0 ? parseNumericValue(snapshotRows[0]?.cash, cashOnHand) : cashOnHand;
  const baselineReservedFunds =
    snapshotRows && snapshotRows.length > 0
      ? parseNumericValue(snapshotRows[0]?.reserved_funds, profileReservedFunds)
      : profileReservedFunds;

  const totalOptimisticReservedFunds = useMemo(() => {
    return Object.values(optimisticReservations).reduce((total, entry) => total + entry.reservedFunds, 0);
  }, [optimisticReservations]);

  const totalReservedFunds = baselineReservedFunds + totalOptimisticReservedFunds;
  const availableBudget = Math.max(baselineCash - totalReservedFunds, 0);

  return (
    <>
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

      {gearPoolStatus.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Gear pool overview</CardTitle>
            <CardDescription>Track remaining capacity before locking in purchases.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gearPoolStatus.map((status) => {
              const categoryLabel = status.category ?? "uncategorized";
              const used = status.used_count ?? 0;
              const capacity = status.capacity ?? 0;
              const available = status.available_slots ?? Math.max(capacity - used, 0);
              return (
                <div key={categoryLabel} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="capitalize">{categoryLabel}</span>
                    <Badge variant={available > 0 ? "secondary" : "destructive"}>{available} open</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {used}/{capacity} assigned • Slot type: {status.slot_kind ?? "–"}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

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
                const outOfStock = (item.stock ?? 0) <= 0;
                const poolStatus = poolByCategory.get(item.category);
                const availableSlots = poolStatus?.available_slots ?? null;
                const noCapacity = availableSlots !== null && (availableSlots ?? 0) <= 0;

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
                        disabled={
                          purchaseMutation.isPending || isOwned || outOfStock || noCapacity
                        }
                        onClick={() => purchaseMutation.mutate(item.id)}
                      >
                        {isOwned
                          ? "Already owned"
                          : outOfStock
                          ? "Out of stock"
                          : noCapacity
                          ? "Pool full"
                          : purchaseMutation.isPending
                          ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
                              </>
                            )
                          : `Purchase for $${item.price.toLocaleString()}`}
                      </Button>
                      {noCapacity ? (
                        <p className="text-xs text-destructive">
                          No remaining {poolStatus?.slot_kind ?? item.category} slots. Retire gear or expand
                          capacity before buying.
                        </p>
                      ) : null}
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
                  {ownedEquipment.map((entry) => {
                    const item = entry.equipment;
                    if (!item) return null;
                    
                    const rarityClass = rarityStyles[parseRarityKey(item.rarity)];
                    const qualityClass = qualityTierStyles[deriveQualityTier(item.price_cash, item.stat_boosts as Record<string, number>)];
                    
                    return (
                    <Card key={entry.id} className="border">
                      <CardContent className="space-y-3 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-xl">{item.name}</CardTitle>
                            <CardDescription>{item.subcategory || item.category}</CardDescription>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className={rarityClass}>
                              {getRarityLabel(parseRarityKey(item.rarity))}
                            </Badge>
                            <Badge variant="outline" className={qualityClass}>
                              {getQualityLabel(deriveQualityTier(item.price_cash, item.stat_boosts as Record<string, number>))}
                            </Badge>
                          </div>
                        </div>
                        {item.description ? (
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        ) : null}
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
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Loadout slot</span>
                          <span>{entry.loadout_slot_kind ?? "Unassigned"}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Pool category</span>
                          <span className="capitalize">{entry.pool_category ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Status</span>
                          <span>{entry.available_for_loadout ? "Available" : "Assigned"}</span>
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

                        <Button
                          className="mt-auto"
                          disabled={purchaseMutation.isPending || isOwned || outOfStock}
                          onClick={() => purchaseMutation.mutate(item)}
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
                {!ownedEquipment || ownedEquipment.length === 0 ? (
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
      </div>

      <Dialog open={!!equipPrompt} onOpenChange={(open) => (!open ? handleClosePrompt() : undefined)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Equip {equipPrompt?.item.name}?</DialogTitle>
            <DialogDescription>
              Add your new purchase straight to the active loadout or keep it stowed for later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Fresh gear unlocked</span>
              </div>
              <p className="mt-2 text-muted-foreground">
                {equippedInCategory?.equipment?.name
                  ? `Equipping will replace ${equippedInCategory.equipment.name} in your ${equipPrompt?.item.category.toLowerCase()} rig.`
                  : "Equip now to activate its stat bonuses immediately."}
              </p>
            </div>

            {statComparisons.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Stat</span>
                  <span className="text-right">Current</span>
                  <span className="text-right">With upgrade</span>
                </div>
                {statComparisons.map((entry) => {
                  const diffTone =
                    entry.diff > 0 ? "text-emerald-600" : entry.diff < 0 ? "text-destructive" : "text-muted-foreground";
                  return (
                    <div key={entry.stat} className="grid grid-cols-3 items-center gap-2 text-sm">
                      <span className="font-medium">{formatStatLabel(entry.stat)}</span>
                      <span className="text-right text-muted-foreground">{formatNumericValue(entry.currentValue)}</span>
                      <span className={`text-right font-semibold ${diffTone}`}>
                        {formatNumericValue(entry.nextValue)}
                        {entry.diff !== 0 ? (
                          <span className="ml-1 text-xs font-normal">
                            {entry.diff > 0 ? "+" : ""}
                            {formatNumericValue(entry.diff)}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                This piece doesn&apos;t alter stats but still updates your visual loadout.
              </p>
            )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={handleClosePrompt}>
              Keep in inventory
            </Button>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={handleOpenLoadout}>
                Open loadout planner
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={handleEquipNow}
                disabled={equipping || !equipPrompt?.playerEquipmentId}
              >
                {equipping ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Equipping
                  </>
                ) : (
                  "Equip now"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GearShop;
