import { type ReactNode, useMemo, useState } from "react";
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

const SNAPSHOT_QUERY_KEY = ["gear-shop-snapshot"] as const;

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
  const {
    data: ownedEquipment,
    isLoading: loadingOwnedEquipment,
    error: ownedEquipmentError,
  } = usePlayerEquipment();

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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                          <span className="font-semibold">
                            {item.price_cash > 0 ? `$${item.price_cash.toLocaleString()}` : "No cash cost"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Shield className="h-4 w-4" />
                          <span>{item.gear_category?.label ?? item.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4" />
                          <span className={stockTone}>{stockLabel}</span>
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
