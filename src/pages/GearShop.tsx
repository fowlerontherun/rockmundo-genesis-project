import { type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BadgeDollarSign, Filter, Loader2, PackageSearch, Shield, ShoppingBag, ShoppingCart, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

const SNAPSHOT_QUERY_KEY = ["gear-shop-snapshot"] as const;

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
  const { data: ownedEquipment } = usePlayerEquipment();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [rarity, setRarity] = useState<RarityFilterValue>("all");
  const [quality, setQuality] = useState<QualityFilterValue>("all");
  const [optimisticReservations, setOptimisticReservations] = useState<Record<string, OptimisticReservationState>>({});
  const [activePurchaseId, setActivePurchaseId] = useState<string | null>(null);

  const parseNumericValue = (value: unknown, fallback = 0) =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  const adjustReservation = (itemId: string, stockDelta: number, fundsDelta: number) => {
    setOptimisticReservations((previous) => {
      const current = previous[itemId] ?? { reservedStock: 0, reservedFunds: 0 };
      const nextStock = Math.max(current.reservedStock + stockDelta, 0);
      const nextFunds = Math.max(current.reservedFunds + fundsDelta, 0);

      if (nextStock === 0 && nextFunds === 0) {
        const { [itemId]: _, ...rest } = previous;
        return rest;
      }

      return {
        ...previous,
        [itemId]: {
          reservedStock: nextStock,
          reservedFunds: nextFunds,
        },
      };
    });
  };

  const { data: snapshotRows } = useQuery<GearShopSnapshotRow[]>({
    queryKey: SNAPSHOT_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_gear_shop_item_snapshot" as any);

      if (error) {
        throw error;
      }

      return (data as GearShopSnapshotRow[] | null) ?? [];
    },
    enabled: Boolean(user),
  });

  const { data: items, isLoading: loadingItems } = useQuery<GearShopItem[]>({
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

  const purchaseMutation = useMutation<PurchaseResultRow | null, Error, PurchaseMutationInput, PurchaseMutationContext>({
    mutationFn: async ({ item }) => {
      const { data, error } = await supabase.rpc("purchase_equipment_item" as any, { p_equipment_id: item.id });
      if (error) {
        throw error;
      }

      const rows = (data as PurchaseResultRow[] | null) ?? [];
      return rows[0] ?? null;
    },
    onMutate: ({ item }) => {
      setActivePurchaseId(item.id);
      adjustReservation(item.id, 1, item.price);
      return {
        itemId: item.id,
        price: item.price,
      };
    },
    onError: (error, variables, context) => {
      if (context) {
        adjustReservation(context.itemId, -1, -context.price);
      }

      const message = error.message || "Unable to complete purchase";
      toast.error(`${message}. Reservation released.`);
      queryClient.invalidateQueries({ queryKey: SNAPSHOT_QUERY_KEY });
    },
    onSuccess: async (result, variables) => {
      const { item } = variables;

      let snapshotRowsAfterPurchase: GearShopSnapshotRow[] = [];
      try {
        const { data: refreshedData, error: snapshotError } = await supabase.rpc(
          "get_gear_shop_item_snapshot" as any,
          { p_equipment_id: null },
        );

        if (snapshotError) {
          throw snapshotError;
        }

        snapshotRowsAfterPurchase = (refreshedData as GearShopSnapshotRow[] | null) ?? [];
        queryClient.setQueryData(SNAPSHOT_QUERY_KEY, snapshotRowsAfterPurchase);
      } catch (snapshotError) {
        console.error("Failed to refresh gear snapshot", snapshotError);
        queryClient.invalidateQueries({ queryKey: SNAPSHOT_QUERY_KEY });
      }

      const profileReservedFunds = parseNumericValue(profile?.reserved_funds, 0);
      const snapshotForItem = snapshotRowsAfterPurchase.find((row) => row.equipment_id === item.id) ?? null;
      const resolvedCash = snapshotForItem
        ? parseNumericValue(snapshotForItem.cash, parseNumericValue(result?.new_cash, 0))
        : parseNumericValue(result?.new_cash, 0);
      const resolvedReservedFunds = snapshotForItem
        ? parseNumericValue(snapshotForItem.reserved_funds, profileReservedFunds)
        : profileReservedFunds;
      const resolvedStock = snapshotForItem
        ? parseNumericValue(snapshotForItem.stock, parseNumericValue(result?.remaining_stock, 0))
        : parseNumericValue(result?.remaining_stock, 0);

      const remainingBudget = Math.max(resolvedCash - resolvedReservedFunds, 0);
      const remainingStock = Math.max(resolvedStock, 0);

      toast.success(
        `Gear purchased. Remaining budget: $${remainingBudget.toLocaleString()} · Stock left: ${remainingStock} in stock`,
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gear-shop-items"] }),
        queryClient.invalidateQueries({ queryKey: ["equipment-store-items"] }),
        queryClient.invalidateQueries({ queryKey: ["player-equipment", user?.id] }),
      ]);

      adjustReservation(item.id, -1, -item.price);
      await refetch();
    },
    onSettled: () => {
      setActivePurchaseId(null);
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
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gear Shop</h1>
          <p className="text-muted-foreground">
            Outfit your rig with curated gear tiers. Rarity and quality directly amplify your performance stats.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2 text-sm shadow-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="flex flex-col text-right">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Available budget</span>
            <span className="text-lg font-semibold">${availableBudget.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">
              Total ${baselineCash.toLocaleString()} · Reserved ${totalReservedFunds.toLocaleString()}
            </span>
          </div>
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
                const reservationForItem = optimisticReservations[item.id];
                const reservedStock = reservationForItem?.reservedStock ?? 0;
                const reservedFundsForItem = reservationForItem?.reservedFunds ?? 0;
                const snapshot = snapshotMap.get(item.id);
                const baseStock = snapshot
                  ? parseNumericValue(snapshot.stock, item.stock ?? 0)
                  : parseNumericValue(item.stock, 0);
                const displayStock = Math.max(baseStock - reservedStock, 0);
                const stockTone = displayStock <= 0
                  ? "text-destructive"
                  : displayStock <= 2
                  ? "text-amber-600"
                  : "text-muted-foreground";
                const totalReservedExcludingCurrent = Math.max(totalOptimisticReservedFunds - reservedFundsForItem, 0);
                const availableBudgetForItem = Math.max(
                  baselineCash - (baselineReservedFunds + totalReservedExcludingCurrent),
                  0,
                );
                const insufficientFunds = reservedStock === 0 && availableBudgetForItem < item.price;
                const fundsShortfall = Math.max(item.price - availableBudgetForItem, 0);
                const insufficientStock = displayStock <= 0;
                const isReserved = reservedStock > 0;
                const isProcessing = purchaseMutation.isPending && activePurchaseId === item.id;
                const buttonDisabled =
                  purchaseMutation.isPending ||
                  isOwned ||
                  insufficientStock ||
                  insufficientFunds ||
                  isReserved;

                let disableReason: string | null = null;
                if (isOwned) {
                  disableReason = "You already own this gear.";
                } else if (isProcessing || isReserved) {
                  disableReason = "Purchase in progress. We'll confirm once it completes.";
                } else if (purchaseMutation.isPending) {
                  disableReason = "Please wait for the current purchase to finish.";
                } else if (insufficientStock) {
                  disableReason = reservedStock > 0
                    ? "Your pending reservation has locked the last unit."
                    : "No stock available right now.";
                } else if (insufficientFunds) {
                  disableReason = fundsShortfall > 0
                    ? `Need $${fundsShortfall.toLocaleString()} more available budget after reservations.`
                    : "Insufficient funds.";
                }

                let buttonLabel: ReactNode = `Purchase for $${item.price.toLocaleString()}`;
                if (isOwned) {
                  buttonLabel = "Already owned";
                } else if (isProcessing) {
                  buttonLabel = (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
                    </>
                  );
                } else if (isReserved) {
                  buttonLabel = "Reserving...";
                } else if (insufficientStock) {
                  buttonLabel = "Out of stock";
                } else if (insufficientFunds) {
                  buttonLabel = "Insufficient funds";
                }

                const stockLabel = displayStock <= 0
                  ? "Sold out"
                  : reservedStock > 0
                  ? `${displayStock} in stock (${reservedStock} reserved)`
                  : `${displayStock} in stock`;

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
                          <span className={stockTone}>{stockLabel}</span>
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

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              className="mt-auto"
                              disabled={buttonDisabled}
                              onClick={() => purchaseMutation.mutate({ item })}
                            >
                              {buttonLabel}
                            </Button>
                          </TooltipTrigger>
                          {disableReason ? (
                            <TooltipContent className="max-w-xs text-sm">{disableReason}</TooltipContent>
                          ) : null}
                        </Tooltip>
                      </TooltipProvider>
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
  );
};

export default GearShop;
