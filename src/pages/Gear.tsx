import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useGameData } from "@/hooks/useGameData";
import { useEquipmentStore } from "@/hooks/useEquipmentStore";
import { useEquipPlayerEquipment } from "@/hooks/usePlayerEquipmentMutations";
import { GearMarketplaceBrowser } from "@/components/gear/marketplace/GearMarketplaceBrowser";
import { GearMarketplaceListings } from "@/components/gear/marketplace/GearMarketplaceListings";
import { GearMarketplacePurchases } from "@/components/gear/marketplace/GearMarketplacePurchases";
import { FMFilterBar } from "@/components/fm/FMFilterBar";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import {
  Activity,
  Brain,
  CheckCircle2,
  Guitar,
  Heart,
  Info,
  Package,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getGearImage } from "@/utils/gearImages";
import {
  getPersonalGearFitLabel,
  getPersonalGearRoleBonusPercent,
  personalGearMatchesRole,
  type PersonalGearItemLike,
} from "@/utils/personalGear";
import { supabase } from "@/integrations/supabase/client";

const rarityColors: Record<string, string> = {
  common: "bg-slate-500",
  uncommon: "bg-emerald-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

const statIcons: Record<string, any> = {
  performance: Activity,
  creativity: Sparkles,
  energy: Zap,
  health: Heart,
  focus: Brain,
  charisma: Star,
};

const asPersonalGear = (item: any): PersonalGearItemLike => ({
  category: item?.category,
  subcategory: item?.subcategory,
  rarity: item?.rarity,
  stat_boosts:
    item?.stat_boosts && typeof item.stat_boosts === "object"
      ? item.stat_boosts
      : null,
});

function RoleFit({ item, role, compact = false }: { item: any; role?: string | null; compact?: boolean }) {
  const gear = asPersonalGear(item);
  const fits = personalGearMatchesRole(gear.category, gear.subcategory, role);
  const bonus = getPersonalGearRoleBonusPercent(gear, role);

  if (!role) {
    return (
      <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
        <Info className="mr-1 inline h-3.5 w-3.5" /> Set a band role to see whether this gear improves your live performance.
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border p-2", fits ? "border-primary/30 bg-primary/5" : "bg-muted/20")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={fits ? "default" : "secondary"} className="gap-1">
          {fits ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {getPersonalGearFitLabel(gear, role)}
        </Badge>
        {fits && bonus > 0 && <span className="text-xs font-semibold text-primary">+{bonus}% role bonus</span>}
      </div>
      {!compact && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {fits
            ? "When equipped, this contributes to your musician role performance. Combined equipped personal-gear bonus is capped at +50%."
            : "You can still own or equip it, but it does not contribute to your current musician-role score."}
        </p>
      )}
    </div>
  );
}

export default function Gear() {
  const { profile } = useGameData();
  const profileId = profile?.id;

  const {
    catalog,
    inventory,
    isLoading,
    purchaseEquipment,
    maintainEquipment,
    isPurchasing,
    isMaintaining,
  } = useEquipmentStore(profileId);
  const { equipGear, isUpdating } = useEquipPlayerEquipment();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");

  const { data: bandRole } = useQuery({
    queryKey: ["personal-gear-band-role", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("band_members")
        .select("instrument_role,band_id")
        .eq("profile_id", profileId)
        .eq("is_touring_member", false)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.instrument_role as string | null) || null;
    },
  });

  const categories = useMemo(() => {
    const values = new Set(catalog.map((item) => item.category));
    return ["all", ...Array.from(values)];
  }, [catalog]);

  const brands = useMemo(() => {
    const values = new Set(catalog.map((item) => item.brand).filter(Boolean));
    return ["all", ...Array.from(values).sort()];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    const filtered = catalog.filter((item) => {
      const search = searchQuery.toLowerCase();
      const matchesSearch =
        item.name.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        item.brand?.toLowerCase().includes(search);
      return (
        matchesSearch &&
        (categoryFilter === "all" || item.category === categoryFilter) &&
        (rarityFilter === "all" || item.rarity?.toLowerCase() === rarityFilter) &&
        (brandFilter === "all" || item.brand === brandFilter)
      );
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low": return a.base_price - b.base_price;
        case "price-high": return b.base_price - a.base_price;
        case "quality": return (b.quality_rating || 0) - (a.quality_rating || 0);
        case "role-fit": {
          const aFit = personalGearMatchesRole(a.category, a.subcategory, bandRole) ? 1 : 0;
          const bFit = personalGearMatchesRole(b.category, b.subcategory, bandRole) ? 1 : 0;
          return bFit - aFit || a.name.localeCompare(b.name);
        }
        default: return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [catalog, searchQuery, categoryFilter, rarityFilter, brandFilter, sortBy, bandRole]);

  const equippedItems = useMemo(() => inventory.filter((item) => item.is_equipped), [inventory]);
  const needsMaintenance = useMemo(() => inventory.filter((item) => (item.condition || 100) < 70), [inventory]);

  const roleActiveEquipped = useMemo(
    () => equippedItems.filter((item) => personalGearMatchesRole(item.equipment.category, (item.equipment as any).subcategory, bandRole)),
    [equippedItems, bandRole],
  );

  const equippedRoleBonus = useMemo(
    () => Math.min(
      50,
      roleActiveEquipped.reduce(
        (total, item) => total + getPersonalGearRoleBonusPercent(asPersonalGear(item.equipment), bandRole),
        0,
      ),
    ),
    [roleActiveEquipped, bandRole],
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const renderStatBoosts = (statBoosts: any) => {
    if (!statBoosts || typeof statBoosts !== "object") return null;
    return (
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(statBoosts).map(([stat, value]) => {
          const Icon = statIcons[stat.toLowerCase()] || TrendingUp;
          return (
            <div key={stat} className="flex items-center gap-2 text-sm">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize text-muted-foreground">{stat}</span>
              <span className="font-semibold">+{String(value)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const handleEquip = (inventoryId: string, equip: boolean) => {
    equipGear({
      playerEquipmentId: inventoryId,
      equip,
      activityMessage: equip ? "Equipped personal gear" : "Unequipped personal gear",
    });
  };

  return (
    <FMPageScaffold
      title="Personal Gear"
      subtitle="Your instruments and personal rig improve your musician role. Band Equipment and Show Crew are handled separately in Live Setup."
      icon={Guitar}
      backTo="/hub/career-business"
      headerActions={
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground tracking-wide">Balance</div>
          <div className="text-base font-bold tabular-nums">{formatCurrency(profile?.cash || 0)}</div>
        </div>
      }
    >
      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1.2fr_1fr_1fr] md:items-center">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Current band role</div>
            <div className="text-xl font-bold">{bandRole || "No role set"}</div>
            <p className="mt-1 text-xs text-muted-foreground">Only compatible equipped gear contributes to your live musician-role calculation.</p>
          </div>
          <div className="rounded-md border bg-background/70 p-3">
            <div className="text-xs text-muted-foreground">Role-active equipped gear</div>
            <div className="text-2xl font-bold">{roleActiveEquipped.length}</div>
            <div className="text-xs text-muted-foreground">of {equippedItems.length} equipped item{equippedItems.length === 1 ? "" : "s"}</div>
          </div>
          <div className="rounded-md border bg-background/70 p-3">
            <div className="text-xs text-muted-foreground">Estimated personal gear bonus</div>
            <div className="text-2xl font-bold">+{equippedRoleBonus}%</div>
            <div className="text-xs text-muted-foreground">Applied to your role skill · capped at +50%</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="shop" className="space-y-4">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="shop" className="shrink-0"><ShoppingCart className="mr-1.5 h-4 w-4" />Shop</TabsTrigger>
          <TabsTrigger value="marketplace" className="shrink-0"><Store className="mr-1.5 h-4 w-4" />Marketplace</TabsTrigger>
          <TabsTrigger value="inventory" className="shrink-0"><Package className="mr-1.5 h-4 w-4" />My Gear ({inventory.length})</TabsTrigger>
          <TabsTrigger value="equipped" className="shrink-0"><Guitar className="mr-1.5 h-4 w-4" />Equipped ({equippedItems.length})</TabsTrigger>
          <TabsTrigger value="maintenance" className="shrink-0"><Wrench className="mr-1.5 h-4 w-4" />Maintenance ({needsMaintenance.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="space-y-4">
          <Card>
            <CardContent className="flex gap-3 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p><strong className="text-foreground">Personal Gear is not Band Equipment.</strong> Buy instruments, microphones, amps and personal rig items here. Use the role-fit badge to see whether an item will contribute to your current live-performance role.</p>
            </CardContent>
          </Card>

          <FMFilterBar
            label={`Catalog (${filteredCatalog.length})`}
            search={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search gear or brand…"
            pills={["all", "common", "uncommon", "rare", "epic", "legendary"].map((value) => ({ value, label: value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1) }))}
            activePill={rarityFilter}
            onPillChange={setRarityFilter}
            right={
              <>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>{categories.map((value) => <SelectItem key={value} value={value} className="capitalize">{value === "all" ? "All categories" : value}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Brand" /></SelectTrigger>
                  <SelectContent>{brands.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All brands" : value}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="role-fit">Best for my role</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="price-low">Price: Low → High</SelectItem>
                    <SelectItem value="price-high">Price: High → Low</SelectItem>
                    <SelectItem value="quality">Quality</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />

          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading equipment…</div>
          ) : filteredCatalog.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No gear matches these filters.</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCatalog.map((item) => {
                const owned = inventory.some((entry) => entry.equipment_id === item.id);
                const canAfford = (profile?.cash || 0) >= item.base_price;
                const stock = (item as any).stock_quantity;
                const soldOut = stock != null && stock <= 0;
                return (
                  <Card key={item.id} className={cn("overflow-hidden", soldOut && "opacity-60")}>
                    <div className="h-28 overflow-hidden bg-muted/30">
                      <img src={getGearImage(item.category, item.subcategory)} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><CardTitle className="truncate text-base">{item.name}</CardTitle><CardDescription>{item.brand || item.subcategory?.replace(/_/g, " ")}</CardDescription></div>
                        <Badge className={cn(rarityColors[item.rarity?.toLowerCase() || "common"])}>{item.rarity}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <RoleFit item={item} role={bandRole} />
                      <div className="flex justify-between text-xs text-muted-foreground"><span>Quality <strong className="text-foreground">{item.quality_rating}/10</strong></span><span>Durability <strong className="text-foreground">{item.durability}</strong></span></div>
                      {item.stat_boosts && Object.keys(item.stat_boosts).length > 0 && renderStatBoosts(item.stat_boosts)}
                      <Separator />
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">{formatCurrency(item.base_price)}</div>
                        <Button size="sm" onClick={() => purchaseEquipment(item.id)} disabled={owned || soldOut || !canAfford || isPurchasing}>
                          {soldOut ? "Sold out" : owned ? "Owned" : canAfford ? "Buy" : "Can't afford"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-6">
          <Tabs defaultValue="browse" className="space-y-4">
            <TabsList>
              <TabsTrigger value="browse">Browse Used Gear</TabsTrigger>
              <TabsTrigger value="my-listings">My Listings</TabsTrigger>
              <TabsTrigger value="purchases">Purchase History</TabsTrigger>
            </TabsList>
            <TabsContent value="browse"><GearMarketplaceBrowser /></TabsContent>
            <TabsContent value="my-listings"><GearMarketplaceListings /></TabsContent>
            <TabsContent value="purchases"><GearMarketplacePurchases /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading your gear…</div>
          ) : inventory.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Package className="mx-auto mb-4 h-14 w-14 text-muted-foreground" /><p className="text-muted-foreground">You don't own any personal gear yet.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inventory.map((item) => (
                <Card key={item.id} className={cn(item.is_equipped && "border-primary/50")}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div><CardTitle className="text-lg">{item.equipment.name}</CardTitle><CardDescription className="capitalize">{item.equipment.category}</CardDescription></div>
                      {item.is_equipped && <Badge>Equipped</Badge>}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <RoleFit item={item.equipment} role={bandRole} />
                    <div><div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">Condition</span><span className="font-semibold">{item.condition || 100}%</span></div><Progress value={item.condition || 100} /></div>
                    {renderStatBoosts(item.equipment.stat_boosts)}
                    <Separator />
                    <div className="flex gap-2">
                      <Button className="flex-1" size="sm" variant={item.is_equipped ? "outline" : "default"} onClick={() => handleEquip(item.id, !item.is_equipped)} disabled={isUpdating}>{item.is_equipped ? "Unequip" : "Equip"}</Button>
                      {(item.condition || 100) < 100 && <Button size="sm" variant="outline" onClick={() => maintainEquipment(item.id)} disabled={isMaintaining}><Wrench className="h-4 w-4" /></Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="equipped" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Active personal rig</CardTitle><CardDescription>This is the gear currently equipped on your character. Only items matching <strong>{bandRole || "your band role"}</strong> contribute to the live musician-role bonus.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Equipped</div><div className="text-2xl font-bold">{equippedItems.length}</div></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Active for role</div><div className="text-2xl font-bold">{roleActiveEquipped.length}</div></div>
              <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Role bonus</div><div className="text-2xl font-bold">+{equippedRoleBonus}%</div><div className="text-xs text-muted-foreground">combined cap +50%</div></div>
            </CardContent>
          </Card>

          {equippedItems.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No personal gear currently equipped.</CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {equippedItems.map((item) => (
                <Card key={item.id} className={cn(personalGearMatchesRole(item.equipment.category, (item.equipment as any).subcategory, bandRole) ? "border-primary/50" : "border-muted")}>
                  <CardHeader className="pb-2"><CardTitle className="text-lg">{item.equipment.name}</CardTitle><CardDescription className="capitalize">{item.equipment.category}</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    <RoleFit item={item.equipment} role={bandRole} />
                    {renderStatBoosts(item.equipment.stat_boosts)}
                    <Button size="sm" variant="outline" className="w-full" onClick={() => handleEquip(item.id, false)} disabled={isUpdating}>Unequip</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Personal Gear Maintenance</CardTitle><CardDescription>Condition is tracked separately from the role-fit bonus shown above. Maintain worn gear to keep it ready for systems that use condition and reliability. Maintenance costs 10% of base price.</CardDescription></CardHeader>
          </Card>
          {needsMaintenance.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Wrench className="mx-auto mb-4 h-14 w-14 text-muted-foreground" /><p className="text-muted-foreground">All personal gear is in good condition.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {needsMaintenance.map((item) => {
                const cost = Math.floor(item.equipment.base_price * 0.1);
                const condition = item.condition || 100;
                const canAfford = (profile?.cash || 0) >= cost;
                return (
                  <Card key={item.id} className={cn(condition < 30 && "border-destructive")}>
                    <CardHeader className="pb-3"><div className="flex items-start justify-between"><div><CardTitle className="text-lg">{item.equipment.name}</CardTitle><CardDescription className="capitalize">{item.equipment.category}</CardDescription></div>{condition < 30 && <Badge variant="destructive">Critical</Badge>}</div></CardHeader>
                    <CardContent className="space-y-3">
                      <RoleFit item={item.equipment} role={bandRole} compact />
                      <div><div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">Condition</span><span className="font-semibold">{condition}%</span></div><Progress value={condition} /></div>
                      <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Maintenance cost</div><div className="text-xl font-bold">{formatCurrency(cost)}</div></div>
                      <Button className="w-full" onClick={() => maintainEquipment(item.id)} disabled={!canAfford || isMaintaining}>{canAfford ? "Maintain" : "Can't afford"}</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
}
