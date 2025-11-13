import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Info,
  Loader2,
  PackageSearch,
  Shield,
  ShoppingCart,
  Sparkles,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData } from "@/hooks/useGameData";
import { usePlayerEquipment, type PlayerEquipmentWithItem } from "@/hooks/usePlayerEquipment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import { GearComparisonDrawer, type ComparableGearItem } from "@/components/gear/GearComparisonDrawer";
import { deriveQualityTier, getQualityLabel, qualityTierStyles } from "@/utils/gearQuality";
import { getRarityLabel, parseRarityKey, rarityStyles } from "@/utils/gearRarity";

interface RawStoreItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  rarity: string | null;
  description: string | null;
  stat_boosts: Record<string, number> | null;
  gear_category?: GearCategory | null;
}

interface StoreItem extends RawStoreItem {
  qualityTier: ReturnType<typeof deriveQualityTier>;
  rarityKey: ReturnType<typeof parseRarityKey>;
}

const formatStatBoosts = (boosts: Record<string, number> | null) => {
  if (!boosts) return [];
  return Object.entries(boosts)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => ({ key, value }));
};

const mapRowToItem = (row: RawStoreItem): StoreItem => ({
  ...row,
  qualityTier: deriveQualityTier(row.price, row.stat_boosts),
  rarityKey: parseRarityKey(row.rarity),
});

const EquipmentStore = () => {
  const queryClient = useQueryClient();
  const { profile, refetch } = useGameData();
  const { user } = useAuth();
  const { data: ownedEquipment, isLoading: loadingOwned, error: ownedError } = usePlayerEquipment();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [confirmationItem, setConfirmationItem] = useState<StoreItem | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [recentPurchases, setRecentPurchases] = useState<string[]>([]);

  const {
    data: items,
    isLoading: loadingItems,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery<StoreItem[]>({
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
      return ((data as RawStoreItem[] | null) ?? []).map(mapRowToItem);
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (item: StoreItem) => {
      const { error } = await supabase.rpc("purchase_equipment_item" as any, { p_equipment_id: item.id });
      if (error) throw error;
    },
    onSuccess: async (_, item) => {
      toast.success(`${item.name} added to your locker`);

      setRecentPurchases((previous) => {
        if (previous.includes(item.id)) {
          return previous;
        }
        return [...previous, item.id];
      });

      queryClient.setQueryData<StoreItem[] | undefined>(["equipment-store-items"], (current) => {
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

      queryClient.setQueryData<ComparableGearItem[] | undefined>(["gear-shop-items"], (current) => {
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
              stock: item.stock ?? null,
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
    if (!ownedEquipment) return new Set<string>();
    return new Set(ownedEquipment.map((entry) => entry.equipment?.id).filter(Boolean) as string[]);
  }, [ownedEquipment]);

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

          {itemsError ? (
            <Card className="border-destructive/50">
              <CardContent className="space-y-4 py-10 text-sm">
                <div className="flex items-center gap-2 font-semibold text-destructive">
                  <Info className="h-5 w-5" /> Unable to load storefront
                </div>
                <p className="text-muted-foreground">
                  The marketplace feed timed out. Refresh the catalogue to continue evaluating upgrades.
                </p>
                <Button variant="outline" onClick={() => refetchItems()}>
                  Retry loading equipment
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
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-10 w-20" />
                    </div>
                    <Skeleton className="h-16 w-full" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
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
                <p>No equipment matches your filters.</p>
                <p>Reset filters or explore neighbouring categories to uncover compatible gear.</p>
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(item);
                            setComparisonOpen(true);
                          }}
                        >
                          Preview impact
                        </Button>
                        {justPurchased ? (
                          <div className="flex items-center gap-2 rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" /> Added to inventory
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
                        onClick={() => {
                          setConfirmationItem(item);
                          setConfirmationOpen(true);
                        }}
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
              {ownedError ? (
                <div className="space-y-3 py-12 text-center text-sm">
                  <p className="font-semibold text-destructive">We couldn&apos;t load your gear locker.</p>
                  <p className="text-muted-foreground">Please refresh later. Purchases will still sync to your account.</p>
                </div>
              ) : loadingOwned ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !ownedEquipment || ownedEquipment.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  You haven&apos;t purchased any gear yet. Buy items from the storefront to populate your inventory.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {ownedEquipment.map((entry) => (
                    <Card key={entry.id} className="border">
                      <CardContent className="space-y-3 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">
                              {entry.equipment?.name ?? "Equipment"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {entry.equipment?.category}
                              {entry.equipment?.subcategory ? ` · ${entry.equipment.subcategory}` : ""}
                            </div>
                          </div>
                          <Badge variant={entry.is_equipped ? "default" : "secondary"}>
                            {entry.is_equipped ? "Equipped" : "Stowed"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Condition</span>
                          <span>{entry.condition ?? 100}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Purchase price</span>
                          <span>${entry.equipment?.price?.toLocaleString() ?? "—"}</span>
                        </div>
                        {entry.equipment?.stat_boosts ? (
                          <div className="flex flex-wrap gap-1 text-[10px]">
                            {Object.entries(entry.equipment.stat_boosts).map(([stat, value]) => (
                              <Badge key={stat} variant="outline" className={rarityStyles[parseRarityKey(entry.equipment?.rarity)]}>
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
                    Purchase <span className="font-semibold">{confirmationItem.name}</span> for
                    {" "}
                    <span className="font-semibold">${confirmationItem.price.toLocaleString()}</span>?
                  </p>
                  <ul className="space-y-2">
                    <li className="rounded-md border bg-muted/30 px-3 py-2">
                      <span className="font-medium">Remaining balance:</span>{" "}
                      ${Math.max(cashOnHand - confirmationItem.price, 0).toLocaleString()}
                    </li>
                    <li className="rounded-md border bg-muted/30 px-3 py-2">
                      <span className="font-medium">Stock status:</span>{" "}
                      {(confirmationItem.stock ?? 0) > 0
                        ? `${confirmationItem.stock} remaining`
                        : "Marked as out of stock"}
                    </li>
                    <li className="rounded-md border bg-muted/30 px-3 py-2">
                      <span className="font-medium">Ownership check:</span>{" "}
                      {ownedIds.has(confirmationItem.id)
                        ? "You already own this equipment. Additional copies add to storage."
                        : "No duplicates detected."}
                    </li>
                  </ul>
                </>
              ) : (
                <p>Select an item to see its purchase breakdown.</p>
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

export default EquipmentStore;
