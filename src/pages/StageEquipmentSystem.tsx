import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { EquipmentRepairButton } from "@/components/stage-equipment/EquipmentRepairButton";
import { RecommendedSetup } from "@/components/stage-equipment/RecommendedSetup";
import {
  ConditionTier,
  RarityTier,
  SizeCategory,
  WeightCategory,
  equipmentLabelMap as labelMap,
  formatEquipmentCurrency as formatCurrency,
} from "@/features/stage-equipment/catalog";
import { supabase } from "@/integrations/supabase/client";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import type { Database } from "@/lib/supabase-types";
import {
  CheckCircle2,
  CircleDashed,
  Guitar,
  Loader2,
  Minus,
  PackageCheck,
  ShoppingCart,
  Sparkles,
  Wand2,
  Wrench,
} from "lucide-react";
import {
  getBandEquipmentEffectiveScore,
  resolveBandEquipmentLiveSetup,
} from "@/utils/liveSetup";

type BandStageEquipmentRow = Database["public"]["Tables"]["band_stage_equipment"]["Row"];

type StageEquipmentRecord = BandStageEquipmentRow & {
  notes?: string | null;
};

interface EquipmentMetadata {
  weight: WeightCategory;
  size: SizeCategory;
  baseCondition: ConditionTier;
  showsPerformed: number;
  liveImpact: string;
  rarity: RarityTier;
  liveSelected: boolean;
  value: number;
  lastConditionTier?: ConditionTier;
  lastConditionPoints?: number;
  wearGigIds?: string[];
}

const unitsToSize = (units?: number | null): SizeCategory => {
  switch (units) {
    case 1:
      return "tiny";
    case 2:
      return "small";
    case 4:
      return "larger";
    case 5:
      return "huge";
    default:
      return "medium";
  }
};

const conditionTierFromPoints = (points?: number | null): ConditionTier => {
  const value = Math.max(0, Math.min(100, Number(points ?? 70)));
  if (value >= 90) return "brand_new";
  if (value >= 80) return "very_good";
  if (value >= 65) return "good";
  if (value >= 50) return "ok";
  if (value >= 35) return "usable";
  if (value >= 20) return "bad";
  if (value >= 10) return "terrible";
  return "almost_dead";
};

const createDefaultMetadata = (item: StageEquipmentRecord): EquipmentMetadata => ({
  weight: "medium",
  size: unitsToSize(item.size_units ?? 3),
  baseCondition: conditionTierFromPoints(item.condition_rating),
  showsPerformed: 0,
  liveImpact: "Shared production equipment for your band's live show.",
  rarity: "normal",
  liveSelected: Boolean(item.is_active),
  value: item.purchase_cost ?? 0,
  lastConditionTier: conditionTierFromPoints(item.condition_rating),
  lastConditionPoints: item.condition_rating ?? 100,
});

const parseMetadata = (item: StageEquipmentRecord): EquipmentMetadata => {
  const fallback = createDefaultMetadata(item);
  if (!item.notes) return fallback;

  try {
    const raw = JSON.parse(item.notes) as Partial<EquipmentMetadata>;
    return {
      ...fallback,
      ...raw,
      weight: (raw.weight as WeightCategory) ?? fallback.weight,
      size: (raw.size as SizeCategory) ?? fallback.size,
      baseCondition: (raw.baseCondition as ConditionTier) ?? fallback.baseCondition,
      rarity: (raw.rarity as RarityTier) ?? fallback.rarity,
      // is_active is authoritative. notes only preserves legacy metadata/display fields.
      liveSelected: Boolean(item.is_active),
      value: raw.value ?? fallback.value,
      showsPerformed: raw.showsPerformed ?? fallback.showsPerformed,
      wearGigIds: Array.isArray(raw.wearGigIds) ? raw.wearGigIds : undefined,
    };
  } catch (error) {
    console.error("Failed to parse equipment metadata", error);
    return fallback;
  }
};

const StageEquipmentSystem = () => {
  const queryClient = useQueryClient();
  const { data: primaryBand, isLoading: loadingBand } = usePrimaryBand();
  const bandId = primaryBand?.band_id ?? null;
  const bandName = primaryBand?.bands?.name ?? "Band";
  const bandGenre = primaryBand?.bands?.genre ?? "Rock";
  const bandFame = primaryBand?.bands?.fame ?? 0;

  const [selectedType, setSelectedType] = useState("all");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedDbItem, setSelectedDbItem] = useState<any | null>(null);

  const { data: memberCount = 1 } = useQuery({
    queryKey: ["band-member-count", bandId],
    queryFn: async () => {
      if (!bandId) return 1;
      const { count, error } = await supabase
        .from("band_members")
        .select("*", { count: "exact", head: true })
        .eq("band_id", bandId)
        .eq("is_touring_member", false);
      if (error) throw error;
      return count || 1;
    },
    enabled: Boolean(bandId),
  });

  const { data: dbCatalog = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["stage-equipment-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_catalog")
        .select("*")
        .eq("category", "stage")
        .eq("is_available", true)
        .order("subcategory", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: equipment = [], isLoading: loadingEquipment } = useQuery<StageEquipmentRecord[]>({
    queryKey: ["band-stage-equipment", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data, error } = await supabase
        .from("band_stage_equipment")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as StageEquipmentRecord[];
    },
    enabled: Boolean(bandId),
  });

  const inventory = useMemo(
    () => equipment.map((item) => ({ ...item, metadata: parseMetadata(item) })),
    [equipment],
  );

  const equipmentResolution = useMemo(
    () => resolveBandEquipmentLiveSetup(
      inventory.map((item) => ({
        id: item.id,
        equipment_type: item.equipment_type,
        quality_rating: item.quality_rating,
        condition_rating: item.condition_rating,
        is_active: item.is_active,
      })),
    ),
    [inventory],
  );

  const usedIds = useMemo(() => new Set(equipmentResolution.selectedIds), [equipmentResolution.selectedIds]);
  const liveSetup = useMemo(() => inventory.filter((item) => usedIds.has(item.id)), [inventory, usedIds]);
  const explicitlySelectedCount = inventory.filter((item) => item.is_active).length;
  const totalValue = inventory.reduce((sum, item) => sum + (item.metadata.value ?? item.purchase_cost ?? 0), 0);
  const averageCondition = inventory.length > 0
    ? Math.round(inventory.reduce((sum, item) => sum + Number(item.condition_rating ?? 70), 0) / inventory.length)
    : 0;

  const updateLiveSetupMutation = useMutation({
    mutationFn: async ({ activateIds }: { activateIds: Set<string> }) => {
      const updates = inventory.map(async (item) => {
        const nextActive = activateIds.has(item.id);
        if (Boolean(item.is_active) === nextActive) return;
        const metadata = { ...item.metadata, liveSelected: nextActive };
        const { error } = await supabase
          .from("band_stage_equipment")
          .update({ is_active: nextActive, notes: JSON.stringify(metadata) })
          .eq("id", item.id)
          .eq("band_id", bandId!);
        if (error) throw error;
      });
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      queryClient.invalidateQueries({ queryKey: ["live-setup-preview"] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update Live Setup"),
  });

  const handleToggleLive = (item: (typeof inventory)[number]) => {
    const currentManual = new Set(inventory.filter((row) => row.is_active).map((row) => row.id));

    if (currentManual.size === 0) {
      // First customisation starts from the automatic setup so a single click does not
      // accidentally remove every other useful equipment type from the show.
      equipmentResolution.selectedIds.forEach((id) => currentManual.add(id));
    }

    if (currentManual.has(item.id)) currentManual.delete(item.id);
    else currentManual.add(item.id);

    updateLiveSetupMutation.mutate({ activateIds: currentManual });
  };

  const returnToAutomaticSetup = () => {
    updateLiveSetupMutation.mutate({ activateIds: new Set<string>() });
  };

  const purchaseMutation = useMutation({
    mutationFn: async (item: any) => {
      if (!bandId) throw new Error("Join a band to purchase equipment");
      const price = Number(item.base_price ?? 0);

      const { data: band, error: bandError } = await supabase
        .from("bands")
        .select("band_balance")
        .eq("id", bandId)
        .single();
      if (bandError) throw bandError;

      const currentBalance = Number(band?.band_balance ?? 0);
      if (currentBalance < price) {
        throw new Error(`Insufficient band funds. Need ${formatCurrency(price)}.`);
      }

      const { error: balanceError } = await supabase
        .from("bands")
        .update({ band_balance: currentBalance - price })
        .eq("id", bandId);
      if (balanceError) throw balanceError;

      const metadata: EquipmentMetadata = {
        weight: "medium",
        size: "medium",
        baseCondition: "brand_new",
        showsPerformed: 0,
        liveImpact: item.description || "Professional shared stage equipment.",
        rarity: (item.rarity as RarityTier) || "normal",
        liveSelected: false,
        value: price,
        lastConditionTier: "brand_new",
        lastConditionPoints: 100,
      };

      const { error: insertError } = await supabase.from("band_stage_equipment").insert({
        band_id: bandId,
        equipment_name: item.name,
        equipment_type: item.subcategory || "general",
        quality_rating: Number(item.quality_rating ?? 80),
        condition_rating: 100,
        purchase_cost: price,
        purchase_date: new Date().toISOString(),
        size_units: 3,
        notes: JSON.stringify(metadata),
        is_active: false,
      });

      if (insertError) {
        // Best-effort compensation so a failed inventory insert does not silently charge the band.
        await supabase.from("bands").update({ band_balance: currentBalance }).eq("id", bandId);
        throw insertError;
      }

      return { price };
    },
    onSuccess: ({ price }) => {
      toast.success(`${selectedDbItem?.name ?? "Equipment"} purchased for ${formatCurrency(price)}`);
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      queryClient.invalidateQueries({ queryKey: ["band", bandId] });
      setPurchaseDialogOpen(false);
      setSelectedDbItem(null);
    },
    onError: (error: Error) => toast.error(error.message || "Failed to buy equipment"),
  });

  const filteredDbCatalog = useMemo(() => {
    if (selectedType === "all") return dbCatalog;
    return dbCatalog.filter((item) => item.subcategory === selectedType);
  }, [dbCatalog, selectedType]);

  const subcategories = useMemo(
    () => Array.from(new Set(dbCatalog.map((item) => item.subcategory).filter(Boolean))).sort(),
    [dbCatalog],
  );

  const openDbPurchaseDialog = (item: any) => {
    setSelectedDbItem(item);
    setPurchaseDialogOpen(true);
  };

  if (loadingBand || loadingEquipment) {
    return (
      <FMPageScaffold title="Band Equipment" subtitle="Loading shared live rig…" icon={Guitar} backTo="/hub/band-live">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading band equipment...
        </div>
      </FMPageScaffold>
    );
  }

  if (!bandId) {
    return (
      <FMPageScaffold title="Band Equipment" subtitle="Join a band to manage shared live equipment." icon={Guitar} backTo="/hub/band-live">
        <Alert>
          <CircleDashed className="h-4 w-4" />
          <AlertTitle>No band selected</AlertTitle>
          <AlertDescription>Band Equipment belongs to the band. Join or create a band to build a shared live rig.</AlertDescription>
        </Alert>
      </FMPageScaffold>
    );
  }

  const selectionLabel = equipmentResolution.selectionMode === "selected"
    ? "Custom Setup"
    : equipmentResolution.selectionMode === "automatic"
      ? "Auto Setup"
      : "Venue Baseline";

  return (
    <FMPageScaffold
      title={`Band Equipment • ${bandName}`}
      subtitle="Shared PA, lighting and production gear used by the whole band. Your own instrument and personal rig stay under Personal Gear."
      icon={Guitar}
      backTo="/hub/band-live"
      headerActions={
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={equipmentResolution.selectionMode === "selected" ? "default" : "secondary"}>{selectionLabel}</Badge>
          <span className="text-muted-foreground">{equipmentResolution.selectedCount} used · {inventory.length} owned</span>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Shared Equipment Score</CardTitle>
                  <CardDescription>One part of Live Setup: Band Equipment 60% + Show Crew 40%.</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{equipmentResolution.score}<span className="text-base text-muted-foreground">/100</span></div>
                  <Badge variant="outline">{selectionLabel}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={equipmentResolution.score} />
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Gear in score</div>
                  <div className="font-semibold">{equipmentResolution.selectedCount} items</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Formula</div>
                  <div className="font-semibold">75% quality · 25% condition</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Owned value</div>
                  <div className="font-semibold">{formatCurrency(totalValue)}</div>
                </div>
              </div>
              {equipmentResolution.selectionMode === "automatic" && (
                <Alert>
                  <Wand2 className="h-4 w-4" />
                  <AlertTitle>Auto Setup is active</AlertTitle>
                  <AlertDescription>
                    No custom rig is saved, so RockMundo uses your strongest owned item in each equipment type. Customise only when you want specific gear used.
                  </AlertDescription>
                </Alert>
              )}
              {equipmentResolution.selectionMode === "baseline" && (
                <Alert>
                  <CircleDashed className="h-4 w-4" />
                  <AlertTitle>Using venue baseline equipment</AlertTitle>
                  <AlertDescription>Buy shared stage equipment to improve this part of Live Setup above the basic 40/100 fallback.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Condition</CardTitle>
              <CardDescription>Wear is tied to real completed gigs.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{averageCondition || "—"}</span>
                {inventory.length > 0 && <span className="text-sm text-muted-foreground">/100 average</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                Used equipment wears automatically when gigs complete. Repair worn items from Inventory to restore them to 100 using band funds.
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="live" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="live" className="gap-1"><PackageCheck className="h-4 w-4" /> Live Setup</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="recommended" className="gap-1"><Wand2 className="h-4 w-4" /> Recommended</TabsTrigger>
            <TabsTrigger value="market">Buy Equipment</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>{selectionLabel}</CardTitle>
                  <CardDescription>
                    This shared production rig supplies the equipment contribution to gig performance. Personal instruments are scored separately against each musician's role.
                  </CardDescription>
                </div>
                {explicitlySelectedCount > 0 && (
                  <Button variant="outline" size="sm" onClick={returnToAutomaticSetup} disabled={updateLiveSetupMutation.isPending}>
                    <Wand2 className="mr-2 h-4 w-4" /> Return to Auto Setup
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {liveSetup.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                    <CircleDashed className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium">No band-owned stage equipment yet.</p>
                      <p className="text-sm text-muted-foreground">The venue baseline is being used until the band buys shared production gear.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {liveSetup.map((item) => {
                      const condition = Number(item.condition_rating ?? 70);
                      const effective = getBandEquipmentEffectiveScore(item);
                      return (
                        <Card key={item.id} className="border-primary/40">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <CardTitle className="text-base">{item.equipment_name ?? "Equipment"}</CardTitle>
                                <CardDescription>{item.metadata.liveImpact}</CardDescription>
                              </div>
                              <Badge variant={equipmentResolution.selectionMode === "selected" ? "default" : "secondary"}>
                                {equipmentResolution.selectionMode === "selected" ? "Selected" : "Auto"}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Badge variant="secondary">{item.equipment_type ?? "General"}</Badge>
                              <Badge variant="outline">Quality {item.quality_rating ?? 40}</Badge>
                              <Badge variant="outline">Condition {condition}</Badge>
                            </div>
                            <div className="rounded-md bg-muted p-3">
                              <div className="text-xs text-muted-foreground">Effective equipment score</div>
                              <div className="text-xl font-semibold">{effective}/100</div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleToggleLive(item)} disabled={updateLiveSetupMutation.isPending}>
                              {item.is_active ? "Remove from setup" : equipmentResolution.selectionMode === "automatic" ? "Customise setup" : "Add to setup"}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Band Equipment Inventory</CardTitle>
                <CardDescription>Choose the shared gear the band takes on stage. Worn items can be repaired to 100 condition using band funds.</CardDescription>
              </CardHeader>
              <CardContent>
                {inventory.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No shared stage equipment owned yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipment</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Quality</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead>Effective</TableHead>
                          <TableHead>Setup</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventory.map((item) => {
                          const condition = Number(item.condition_rating ?? 70);
                          const isUsed = usedIds.has(item.id);
                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-medium">{item.equipment_name ?? "Equipment"}</div>
                                <div className="text-xs text-muted-foreground">{formatCurrency(item.metadata.value ?? item.purchase_cost)}</div>
                              </TableCell>
                              <TableCell><Badge variant="secondary">{item.equipment_type ?? "General"}</Badge></TableCell>
                              <TableCell>{item.quality_rating ?? 40}/100</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{condition}/100</span>
                                  <Badge variant="outline">{labelMap[conditionTierFromPoints(condition)]}</Badge>
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold">{getBandEquipmentEffectiveScore(item)}/100</TableCell>
                              <TableCell>
                                {isUsed ? (
                                  <Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Selected" : "Auto"}</Badge>
                                ) : (
                                  <Badge variant="outline">Stored</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <EquipmentRepairButton item={item} bandId={bandId} />
                                  <Button variant={item.is_active ? "secondary" : "outline"} size="sm" onClick={() => handleToggleLive(item)} disabled={updateLiveSetupMutation.isPending}>
                                    {item.is_active ? "Remove" : isUsed && equipmentResolution.selectionMode === "automatic" ? "Customise" : "Add"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommended" className="space-y-4">
            <RecommendedSetup
              bandProfile={{ genre: bandGenre, fame: bandFame, memberCount }}
              catalogItems={dbCatalog.map((item) => ({
                ...item,
                stat_boosts: item.stat_boosts as Record<string, number> | null,
              }))}
              ownedItemNames={inventory.map((item) => item.equipment_name || "")}
              onPurchase={openDbPurchaseDialog}
              isPurchasing={purchaseMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="market" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Buy Band Equipment</CardTitle>
                  <CardDescription>Shared PA, lighting, monitoring, effects and production equipment is paid for from band funds.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-muted-foreground">Filter</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="All equipment" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All equipment</SelectItem>
                      {subcategories.map((sub) => (
                        <SelectItem key={String(sub)} value={String(sub)} className="capitalize">{String(sub).replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {catalogLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : filteredDbCatalog.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No equipment found.</div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredDbCatalog.map((item) => (
                      <Card key={item.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-sm">{item.name}</CardTitle>
                              <CardDescription className="text-xs">{item.brand || String(item.subcategory || "Stage equipment").replace(/_/g, " ")}</CardDescription>
                            </div>
                            <Badge variant="secondary" className="capitalize">{item.rarity}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                          <div className="flex items-center justify-between border-t pt-3">
                            <div>
                              <div className="text-xs text-muted-foreground">Quality {item.quality_rating ?? 80}/100</div>
                              <div className="font-bold">{formatCurrency(item.base_price)}</div>
                            </div>
                            <Button size="sm" onClick={() => openDbPurchaseDialog(item)} disabled={purchaseMutation.isPending}>
                              <ShoppingCart className="mr-1 h-3 w-3" /> Buy
                            </Button>
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

        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>Band Equipment is not Personal Gear</AlertTitle>
          <AlertDescription>
            Guitars, basses, drums, microphones and other equipped personal items improve the musician using them. This page controls the band's shared production layer that combines with Show Crew to form Live Setup.
          </AlertDescription>
        </Alert>

        <Dialog open={purchaseDialogOpen} onOpenChange={(open) => {
          setPurchaseDialogOpen(open);
          if (!open) setSelectedDbItem(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm band equipment purchase</DialogTitle>
              <DialogDescription>The cost is paid from the band's balance. New equipment enters inventory and Auto Setup can use it immediately if it is the strongest item of its type.</DialogDescription>
            </DialogHeader>
            {selectedDbItem && (
              <div className="space-y-3">
                <div>
                  <div className="text-lg font-semibold">{selectedDbItem.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedDbItem.brand} · {String(selectedDbItem.subcategory || "stage equipment").replace(/_/g, " ")}</div>
                </div>
                <p className="text-sm text-muted-foreground">{selectedDbItem.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">{selectedDbItem.rarity}</Badge>
                  <Badge variant="outline">Quality {selectedDbItem.quality_rating ?? 80}/100</Badge>
                  <Badge variant="outline">Starts at 100 condition</Badge>
                </div>
                <div className="text-lg font-semibold">{formatCurrency(selectedDbItem.base_price)}</div>
              </div>
            )}
            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={() => { setPurchaseDialogOpen(false); setSelectedDbItem(null); }}>
                <Minus className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button onClick={() => selectedDbItem && purchaseMutation.mutate(selectedDbItem)} disabled={!selectedDbItem || purchaseMutation.isPending}>
                {purchaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                Confirm purchase
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </FMPageScaffold>
  );
};

export default StageEquipmentSystem;
