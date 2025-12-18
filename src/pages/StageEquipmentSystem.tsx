import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Badge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import type { Database } from "@/lib/supabase-types";
import {
  CheckCircle2,
  CircleDashed,
  Guitar,
  Loader2,
  Minus,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import {
  CONDITION_ORDER,
  EquipmentCatalogItem,
  equipmentLabelMap as labelMap,
  formatEquipmentCurrency as formatCurrency,
  EQUIPMENT_TYPES,
  RarityTier,
  SizeCategory,
  StageEquipmentType,
  WeightCategory,
  ConditionTier,
} from "@/features/stage-equipment/catalog";
import { useStageEquipmentCatalog } from "@/features/stage-equipment/catalog-context";

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
}

interface ConditionState {
  tier: ConditionTier;
  points: number;
  score: number;
}

const sizeToUnits = (size: SizeCategory): number => {
  switch (size) {
    case "tiny":
      return 1;
    case "small":
      return 2;
    case "medium":
      return 3;
    case "larger":
      return 4;
    case "huge":
      return 5;
    default:
      return 3;
  }
};

const unitsToSize = (units?: number | null): SizeCategory => {
  switch (units) {
    case 1:
      return "tiny";
    case 2:
      return "small";
    case 3:
      return "medium";
    case 4:
      return "larger";
    case 5:
      return "huge";
    default:
      return "medium";
  }
};

const calculateConditionState = (metadata: EquipmentMetadata): ConditionState => {
  const baseIndex = CONDITION_ORDER.indexOf(metadata.baseCondition);
  if (baseIndex === -1) {
    return { tier: "usable", points: 100, score: 400 };
  }

  const shows = metadata.showsPerformed ?? 0;
  if (shows <= 30) {
    const points = metadata.lastConditionPoints ?? 100;
    return { tier: metadata.baseCondition, points, score: baseIndex * 100 + points };
  }

  const degradeStart = 30;
  const degradeWindow = 20;
  let extraShows = Math.max(0, shows - degradeStart);
  const tiersLost = Math.floor(extraShows / degradeWindow);
  let remainder = extraShows % degradeWindow;

  let newIndex = Math.max(0, baseIndex - tiersLost);
  if (tiersLost > baseIndex) {
    newIndex = 0;
    remainder = 0;
  }

  let points = 100;
  if (remainder > 0) {
    points = Math.max(0, 100 - Math.round((remainder / degradeWindow) * 100));
  }

  if (newIndex === 0 && tiersLost > baseIndex) {
    points = 0;
  }

  return {
    tier: CONDITION_ORDER[newIndex],
    points,
    score: newIndex * 100 + points,
  };
};

const createDefaultMetadata = (item: StageEquipmentRecord): EquipmentMetadata => ({
  weight: "medium",
  size: unitsToSize(item.size_units ?? 3),
  baseCondition: "good",
  showsPerformed: 0,
  liveImpact: "General purpose upgrade",
  rarity: "normal",
  liveSelected: Boolean(item.is_active),
  value: item.purchase_cost ?? 0,
  lastConditionTier: "good",
  lastConditionPoints: item.condition_rating ?? 100,
});

const parseMetadata = (item: StageEquipmentRecord): EquipmentMetadata => {
  const fallback = createDefaultMetadata(item);
  if (!item.notes) {
    return fallback;
  }

  try {
    const raw = JSON.parse(item.notes) as Partial<EquipmentMetadata>;
    return {
      ...fallback,
      ...raw,
      weight: (raw?.weight as WeightCategory) ?? fallback.weight,
      size: (raw?.size as SizeCategory) ?? fallback.size,
      baseCondition: (raw?.baseCondition as ConditionTier) ?? fallback.baseCondition,
      rarity: (raw?.rarity as RarityTier) ?? fallback.rarity,
      liveSelected: raw?.liveSelected ?? fallback.liveSelected,
      value: raw?.value ?? fallback.value,
      showsPerformed: raw?.showsPerformed ?? fallback.showsPerformed,
      lastConditionTier: (raw?.lastConditionTier as ConditionTier) ?? fallback.lastConditionTier,
      lastConditionPoints: raw?.lastConditionPoints ?? fallback.lastConditionPoints,
    };
  } catch (error) {
    console.error("Failed to parse equipment metadata", error);
    return fallback;
  }
};

const buildMetadataPayload = (metadata: EquipmentMetadata, condition: ConditionState): EquipmentMetadata => ({
  ...metadata,
  liveSelected: metadata.liveSelected,
  lastConditionTier: condition.tier,
  lastConditionPoints: condition.points,
});

const StageEquipmentSystem = () => {
  const queryClient = useQueryClient();
  const { data: primaryBand, isLoading: loadingBand } = usePrimaryBand();
  const bandId = primaryBand?.band_id ?? null;
  const bandName = primaryBand?.bands?.name ?? "Band";

  const { catalog: localCatalog, setCatalog } = useStageEquipmentCatalog();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<EquipmentCatalogItem | null>(null);
  const [selectedDbItem, setSelectedDbItem] = useState<any | null>(null);

  // Fetch stage equipment from database
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
      return data;
    },
  });

  const { data: equipment, isLoading: loadingEquipment } = useQuery<StageEquipmentRecord[]>({
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

  const updateEquipmentMutation = useMutation({
    mutationFn: async ({
      equipmentId,
      metadata,
      conditionRating,
    }: {
      equipmentId: string;
      metadata: EquipmentMetadata;
      conditionRating: number;
    }) => {
      const { error } = await supabase
        .from("band_stage_equipment")
        .update({
          notes: JSON.stringify(metadata),
          condition_rating: conditionRating,
          is_active: metadata.liveSelected,
        })
        .eq("id", equipmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update equipment");
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (item: EquipmentCatalogItem) => {
      if (!bandId) {
        throw new Error("Join a band to purchase equipment");
      }

      const metadata: EquipmentMetadata = {
        weight: item.weight,
        size: item.size,
        baseCondition: item.baseCondition,
        showsPerformed: 0,
        liveImpact: item.liveImpact,
        rarity: item.rarity,
        liveSelected: false,
        value: item.cost,
        lastConditionTier: item.baseCondition,
        lastConditionPoints: 100,
      };

      const condition = calculateConditionState(metadata);

      const { error } = await supabase.from("band_stage_equipment").insert({
        band_id: bandId,
        equipment_name: item.name,
        equipment_type: item.type,
        quality_rating: 80,
        condition_rating: condition.points,
        power_draw: null,
        purchase_cost: item.cost,
        purchase_date: new Date().toISOString(),
        maintenance_due_at: null,
        maintenance_status: "good",
        size_units: sizeToUnits(item.size),
        notes: JSON.stringify(buildMetadataPayload(metadata, condition)),
      });

      if (error) throw error;
    },
    onSuccess: (_, item) => {
      toast.success(`${item.name} added to your stage inventory`);
      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
      setCatalog((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, amountAvailable: Math.max(0, entry.amountAvailable - 1) }
            : entry,
        ),
      );
      setPurchaseDialogOpen(false);
      setSelectedCatalogItem(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to buy equipment");
    },
  });

  const enrichedEquipment = useMemo(() => {
    return (equipment ?? []).map((item) => {
      const metadata = parseMetadata(item);
      const condition = calculateConditionState(metadata);
      const normalizedMetadata = buildMetadataPayload(metadata, condition);

      return {
        ...item,
        metadata: normalizedMetadata,
        condition,
      };
    });
  }, [equipment]);

  const inventory = useMemo(() => enrichedEquipment ?? [], [enrichedEquipment]);
  const liveSetup = useMemo(
    () => inventory.filter((item) => item.metadata.liveSelected || item.is_active),
    [inventory],
  );

  const totalValue = inventory.reduce((sum, item) => sum + (item.metadata.value ?? item.purchase_cost ?? 0), 0);
  const totalConditionScore = inventory.reduce((sum, item) => sum + item.condition.score, 0);
  const averageConditionScore = inventory.length > 0 ? totalConditionScore / inventory.length : 0;
  const averageConditionTierIndex = Math.min(
    CONDITION_ORDER.length - 1,
    Math.max(0, Math.floor(averageConditionScore / 100)),
  );
  const averageConditionTier = CONDITION_ORDER[averageConditionTierIndex];

  const handleToggleLive = (item: (typeof inventory)[number]) => {
    const nextMetadata = {
      ...item.metadata,
      liveSelected: !item.metadata.liveSelected,
    };
    updateEquipmentMutation.mutate({
      equipmentId: item.id,
      metadata: nextMetadata,
      conditionRating: item.condition.points,
    });
  };

  const handleLogShow = (item: (typeof inventory)[number]) => {
    const updatedMetadata: EquipmentMetadata = {
      ...item.metadata,
      showsPerformed: item.metadata.showsPerformed + 1,
    };
    const nextCondition = calculateConditionState(updatedMetadata);
    const payload = buildMetadataPayload(updatedMetadata, nextCondition);

    updateEquipmentMutation.mutate({
      equipmentId: item.id,
      metadata: payload,
      conditionRating: nextCondition.points,
    });

    toast.message(`${item.equipment_name ?? "Equipment"} logged for another show`, {
      description: `Condition now ${labelMap[nextCondition.tier]} (${nextCondition.points}/100).`,
    });
  };

  const filteredCatalog = useMemo(() => {
    if (selectedType === "all") return localCatalog;
    return localCatalog.filter((item) => item.type === selectedType);
  }, [localCatalog, selectedType]);

  // Filter DB catalog by subcategory
  const filteredDbCatalog = useMemo(() => {
    if (selectedType === "all") return dbCatalog;
    return dbCatalog.filter((item) => item.subcategory === selectedType);
  }, [dbCatalog, selectedType]);

  // Get unique subcategories from DB catalog
  const subcategories = useMemo(() => {
    const subs = new Set(dbCatalog.map(item => item.subcategory).filter(Boolean));
    return Array.from(subs).sort();
  }, [dbCatalog]);

  const openPurchaseDialog = (item: EquipmentCatalogItem) => {
    setSelectedCatalogItem(item);
    setPurchaseDialogOpen(true);
  };

  const openDbPurchaseDialog = (item: any) => {
    setSelectedDbItem(item);
    setPurchaseDialogOpen(true);
  };

  if (loadingBand || loadingEquipment) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading stage equipment data...
        </div>
      </div>
    );
  }

  if (!bandId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Join a band to manage stage equipment</CardTitle>
              <CardDescription>
                Stage gear lives with your band. Join or create a band to start tracking inventory, live rigs, and upgrades.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <CircleDashed className="h-4 w-4" />
                <AlertTitle>No band selected</AlertTitle>
                <AlertDescription>
                  Head to the bands hub to pick your crew. Once you're in, the full equipment system unlocks here.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Stage Equipment • {bandName}</CardTitle>
              <CardDescription>
                Track owned gear, curate your live stage setup, and expand your catalog with precision upgrades.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">{inventory.length}</span> pieces owned
              </div>
              <div>
                Live setup: <span className="font-semibold text-foreground">{liveSetup.length}</span>
              </div>
              <div>
                Total value: <span className="font-semibold text-foreground">{formatCurrency(totalValue)}</span>
              </div>
              {inventory.length > 0 && (
                <div className="flex items-center gap-1">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Avg condition: <span className="font-semibold text-foreground">{labelMap[averageConditionTier]}</span>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="inventory">Current Equipment</TabsTrigger>
            <TabsTrigger value="live">Live Stage Setup</TabsTrigger>
            <TabsTrigger value="market">Buy Equipment</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Owned Equipment</CardTitle>
                <CardDescription>
                  Review your inventory, monitor condition degradation across shows, and decide what stays in the live rig.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {inventory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <Guitar className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">No stage equipment yet.</p>
                      <p className="text-sm text-muted-foreground">
                        Head to the market tab to pick up your first pieces and build a signature stage presence.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipment</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Condition</TableHead>
                          <TableHead>Live Setup</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-semibold text-foreground">{item.equipment_name ?? "Equipment"}</div>
                              <div className="text-xs text-muted-foreground">{item.metadata.liveImpact}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{item.equipment_type ?? "—"}</Badge>
                            </TableCell>
                            <TableCell>{formatCurrency(item.metadata.value ?? item.purchase_cost)}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-emerald-600 hover:bg-emerald-700">
                                    {labelMap[item.condition.tier]}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {item.condition.points}/100 · {item.metadata.showsPerformed} shows
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <span>Weight: {labelMap[item.metadata.weight]}</span>
                                  <span>Size: {labelMap[item.metadata.size]}</span>
                                  <span>Rarity: {labelMap[item.metadata.rarity]}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.metadata.liveSelected ? (
                                <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
                                  In Live Setup
                                </Badge>
                              ) : (
                                <Badge variant="outline">Not Selected</Badge>
                              )}
                            </TableCell>
                            <TableCell className="space-x-2 text-right">
                              <Button
                                variant={item.metadata.liveSelected ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => handleToggleLive(item)}
                                disabled={updateEquipmentMutation.isPending}
                              >
                                {item.metadata.liveSelected ? "Remove" : "Add"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLogShow(item)}
                                disabled={updateEquipmentMutation.isPending}
                              >
                                Log Show
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Live Stage Setup</CardTitle>
                <CardDescription>
                  The gear currently locked into your touring rig. Keep condition healthy to avoid mid-show failures.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {liveSetup.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                    <CircleDashed className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">No equipment selected for the live setup.</p>
                      <p className="text-sm text-muted-foreground">
                        Add gear from the inventory tab to curate your touring configuration.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {liveSetup.map((item) => (
                      <Card key={item.id} className="border-primary/50">
                        <CardHeader>
                          <CardTitle className="text-lg">{item.equipment_name ?? "Equipment"}</CardTitle>
                          <CardDescription>{item.metadata.liveImpact}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="secondary">{item.equipment_type ?? "—"}</Badge>
                            <Badge variant="outline">{labelMap[item.metadata.weight]} weight</Badge>
                            <Badge variant="outline">{labelMap[item.metadata.size]} size</Badge>
                            <Badge variant="outline">{labelMap[item.metadata.rarity]}</Badge>
                          </div>
                          <div className="rounded-md bg-muted p-3 text-sm">
                            <div className="flex items-center gap-2 text-foreground">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              {labelMap[item.condition.tier]} · {item.condition.points}/100
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.metadata.showsPerformed} shows logged · Value {formatCurrency(item.metadata.value)}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleLive(item)}
                            disabled={updateEquipmentMutation.isPending}
                          >
                            Remove from live setup
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="market" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Buy Stage Equipment</CardTitle>
                  <CardDescription>
                    Browse real equipment from top brands - PA systems, lighting, effects, and more.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-muted-foreground">Filter</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All equipment</SelectItem>
                      {subcategories.map((sub) => (
                        <SelectItem key={sub} value={sub} className="capitalize">
                          {sub?.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {catalogLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredDbCatalog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
                    <CircleDashed className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No equipment found.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Group by subcategory */}
                    {Object.entries(
                      filteredDbCatalog.reduce((acc, item) => {
                        const sub = item.subcategory || 'other';
                        if (!acc[sub]) acc[sub] = [];
                        acc[sub].push(item);
                        return acc;
                      }, {} as Record<string, typeof filteredDbCatalog>)
                    ).sort(([a], [b]) => a.localeCompare(b)).map(([subcategory, items]) => {
                      const subcategoryLabels: Record<string, string> = {
                        pa_speaker: "🔊 PA Speakers",
                        subwoofer: "🔉 Subwoofers",
                        line_array: "📢 Line Arrays",
                        mixer: "🎛️ Digital Mixers",
                        monitor: "🎧 Stage Monitors",
                        moving_head: "💡 Moving Head Lights",
                        par_light: "🔦 Par Lights",
                        strobe: "⚡ Strobe Lights",
                        fog: "🌫️ Fog Machines",
                        hazer: "💨 Hazers",
                        iem: "🎧 In-Ear Monitors",
                        wireless_mic: "🎤 Wireless Microphones",
                        wireless_guitar: "🎸 Wireless Guitar Systems",
                        di_box: "📦 DI Boxes",
                        cable: "🔌 Cables",
                        effects: "✨ Stage Effects",
                      };

                      const rarityColors: Record<string, string> = {
                        common: "bg-slate-500",
                        uncommon: "bg-emerald-500",
                        rare: "bg-blue-500",
                        epic: "bg-purple-500",
                        legendary: "bg-amber-500",
                      };

                      return (
                        <div key={subcategory} className="space-y-4">
                          <div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur py-2 z-10 border-b border-border">
                            <h3 className="text-xl font-bold">
                              {subcategoryLabels[subcategory] || subcategory.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </h3>
                            <Badge variant="secondary">{items.length}</Badge>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {items.map((item) => (
                              <Card key={item.id} className="relative overflow-hidden">
                                <div 
                                  className={`absolute top-0 right-0 w-16 h-16 opacity-10 ${rarityColors[item.rarity?.toLowerCase() || 'common']}`}
                                  style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} 
                                />
                                <CardHeader className="pb-2 pt-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-sm truncate">{item.name}</CardTitle>
                                      {item.brand && (
                                        <CardDescription className="text-xs font-medium">{item.brand}</CardDescription>
                                      )}
                                    </div>
                                    <Badge className={`text-[10px] px-1.5 ${rarityColors[item.rarity?.toLowerCase() || 'common']}`}>
                                      {item.rarity}
                                    </Badge>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-2 pt-0 pb-3">
                                  <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                                  <div className="flex gap-3 text-[11px]">
                                    <span>
                                      <span className="text-muted-foreground">Q:</span>
                                      <span className="font-semibold ml-0.5">{item.quality_rating}/100</span>
                                    </span>
                                  </div>
                                  {item.stat_boosts && Object.keys(item.stat_boosts).length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(item.stat_boosts as Record<string, number>).slice(0, 2).map(([stat, value]) => (
                                        <Badge key={stat} variant="outline" className="text-[10px] py-0 px-1">
                                          {stat}: +{value}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between pt-2 border-t">
                                    <div className="text-base font-bold">
                                      ${item.base_price?.toLocaleString()}
                                    </div>
                                    <Button
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => openDbPurchaseDialog(item)}
                                      disabled={purchaseMutation.isPending}
                                    >
                                      <ShoppingCart className="h-3 w-3 mr-1" /> Buy
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </div>

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm equipment purchase</DialogTitle>
            <DialogDescription>
              Add this equipment to your band's inventory and make it available for your live setup.
            </DialogDescription>
          </DialogHeader>
          {selectedCatalogItem && (
            <div className="space-y-3">
              <div>
                <div className="text-lg font-semibold text-foreground">{selectedCatalogItem.name}</div>
                <div className="text-sm text-muted-foreground">{selectedCatalogItem.liveImpact}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{selectedCatalogItem.type}</Badge>
                <Badge variant="outline">{labelMap[selectedCatalogItem.weight]} weight</Badge>
                <Badge variant="outline">{labelMap[selectedCatalogItem.size]} size</Badge>
                <Badge variant="outline">{labelMap[selectedCatalogItem.rarity]}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Condition starts at <span className="font-medium text-foreground">{labelMap[selectedCatalogItem.baseCondition]}</span>. Expect wear after 30 shows.
              </div>
              <div className="text-lg font-semibold text-foreground">{formatCurrency(selectedCatalogItem.cost)}</div>
            </div>
          )}
          {selectedDbItem && !selectedCatalogItem && (
            <div className="space-y-3">
              <div>
                <div className="text-lg font-semibold text-foreground">{selectedDbItem.name}</div>
                <div className="text-sm text-muted-foreground">{selectedDbItem.brand} • {selectedDbItem.subcategory?.replace(/_/g, ' ')}</div>
              </div>
              <p className="text-sm text-muted-foreground">{selectedDbItem.description}</p>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary" className="capitalize">{selectedDbItem.rarity}</Badge>
                <Badge variant="outline">Quality: {selectedDbItem.quality_rating}/100</Badge>
              </div>
              {selectedDbItem.stat_boosts && Object.keys(selectedDbItem.stat_boosts).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedDbItem.stat_boosts as Record<string, number>).map(([stat, value]) => (
                    <Badge key={stat} variant="outline" className="text-xs">
                      {stat}: +{value}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="text-lg font-semibold text-foreground">${selectedDbItem.base_price?.toLocaleString()}</div>
            </div>
          )}
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => { setPurchaseDialogOpen(false); setSelectedDbItem(null); setSelectedCatalogItem(null); }}>
              <Minus className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDbItem) {
                  // Purchase from DB catalog
                  const metadata: EquipmentMetadata = {
                    weight: "medium",
                    size: "medium",
                    baseCondition: "brand_new",
                    showsPerformed: 0,
                    liveImpact: selectedDbItem.description || "Professional stage equipment",
                    rarity: selectedDbItem.rarity || "normal",
                    liveSelected: false,
                    value: selectedDbItem.base_price,
                    lastConditionTier: "brand_new",
                    lastConditionPoints: 100,
                  };
                  const condition = calculateConditionState(metadata);
                  
                  supabase.from("band_stage_equipment").insert({
                    band_id: bandId!,
                    equipment_name: selectedDbItem.name,
                    equipment_type: selectedDbItem.subcategory || "general",
                    quality_rating: selectedDbItem.quality_rating || 80,
                    condition_rating: 100,
                    purchase_cost: selectedDbItem.base_price,
                    purchase_date: new Date().toISOString(),
                    size_units: 3,
                    notes: JSON.stringify(buildMetadataPayload(metadata, condition)),
                  }).then(({ error }) => {
                    if (error) {
                      toast.error(error.message);
                    } else {
                      toast.success(`${selectedDbItem.name} added to your inventory`);
                      queryClient.invalidateQueries({ queryKey: ["band-stage-equipment", bandId] });
                    }
                    setPurchaseDialogOpen(false);
                    setSelectedDbItem(null);
                  });
                } else if (selectedCatalogItem) {
                  purchaseMutation.mutate(selectedCatalogItem);
                }
              }}
              disabled={(!selectedCatalogItem && !selectedDbItem) || purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              Confirm purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StageEquipmentSystem;
