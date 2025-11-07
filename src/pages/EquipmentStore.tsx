import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Sparkles, PackageSearch, Shield, Zap, Loader2 } from "lucide-react";

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

interface StoreItem {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  price: number;
  rarity: string | null;
  description: string | null;
  stat_boosts: Record<string, number> | null;
  stock?: number | null;
}

interface OwnedEquipmentRecord {
  id: string;
  condition: number | null;
  is_equipped: boolean | null;
  created_at: string | null;
  equipment?: {
    id: string;
    name: string;
    category: string;
    subcategory: string | null;
    price: number;
    rarity: string | null;
  } | null;
}

const rarityStyles: Record<string, string> = {
  common: "border-muted bg-muted/40 text-muted-foreground",
  uncommon: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  rare: "border-blue-500/40 bg-blue-500/10 text-blue-600",
  epic: "border-purple-500/40 bg-purple-500/10 text-purple-600",
  legendary: "border-amber-500/40 bg-amber-500/10 text-amber-600",
};

const formatStatBoosts = (boosts: Record<string, number> | null) => {
  if (!boosts) return [];
  return Object.entries(boosts)
    .filter(([_, value]) => typeof value === "number")
    .map(([key, value]) => ({ key, value }));
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
        .select("id, name, category, subcategory, price, rarity, description, stat_boosts, stock")
        .order("price");

      if (error) throw error;
      return (data as StoreItem[]) ?? [];
    },
  });

  const { data: owned, isLoading: loadingOwned } = useQuery<OwnedEquipmentRecord[]>({
    queryKey: ["player-equipment", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("player_equipment")
        .select(
          `id, condition, is_equipped, created_at, equipment:equipment_items!equipment_id ( id, name, category, subcategory, price, rarity )`
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

  const categories = useMemo(() => {
    const unique = new Set<string>();
    items?.forEach((item) => unique.add(item.category));
    return ["all", ...Array.from(unique)];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, category, search]);

  const ownedIds = useMemo(() => {
    if (!owned) return new Set<string>();
    return new Set(owned.map((entry) => entry.equipment?.id).filter(Boolean) as string[]);
  }, [owned]);

  const cashOnHand = typeof profile?.cash === "number" ? profile.cash : 0;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipment Market</h1>
          <p className="text-muted-foreground">
            Outfit your rig with premium instruments, lighting packages, and touring essentials.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm shadow-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium">Budget</span>
          <Separator orientation="vertical" className="h-4" />
          <span>${cashOnHand.toLocaleString()}</span>
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
              <div className="flex w-full gap-3 md:max-w-sm">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search equipment..."
                />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="min-w-[140px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option === "all" ? "All" : option}
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
                const rarityClass = item.rarity ? rarityStyles[item.rarity.toLowerCase()] : "border-muted";
                const isOwned = ownedIds.has(item.id);
                const outOfStock = (item.stock ?? 0) <= 0;

                return (
                  <Card key={item.id} className="flex flex-col border-2">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-xl">{item.name}</CardTitle>
                          <CardDescription>{item.subcategory || item.category}</CardDescription>
                        </div>
                        <Badge variant="outline" className={rarityClass}>
                          {item.rarity ? item.rarity.toUpperCase() : "STANDARD"}
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
                          <span className="font-semibold">${item.price.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Shield className="h-4 w-4" />
                          <span>{item.category}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Zap className="h-4 w-4" />
                          <span>{item.stock ?? 0} in stock</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Sparkles className="h-4 w-4" />
                          <span>{isOwned ? "Owned" : "Available"}</span>
                        </div>
                      </div>

                      {boosts.length > 0 ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {boosts.map((boost) => (
                            <Badge key={boost.key} variant="outline">
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
                          : `Purchase for $${item.price.toLocaleString()}`}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="owned" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Owned equipment</CardTitle>
              <CardDescription>Personal instruments and gear ready for rehearsal or staging.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOwned ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !owned || owned.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  You haven't purchased any equipment yet. Browse the store to build your rig.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {owned.map((entry) => (
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

export default EquipmentStore;
