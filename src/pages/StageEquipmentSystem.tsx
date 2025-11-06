import { useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useGameData } from "@/hooks/useGameData";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useUserRole } from "@/hooks/useUserRole";
import type { Database } from "@/lib/supabase-types";
import {
  CheckCircle2,
  CircleDashed,
  Guitar,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

type BandStageEquipmentRow = Database["public"]["Tables"]["band_stage_equipment"]["Row"];

type StageEquipmentRecord = BandStageEquipmentRow & {
  notes?: string | null;
};

type StageEquipmentType =
  | "Sound"
  | "Lighting"
  | "Visuals"
  | "Effects"
  | "Decor"
  | "Transport"
  | "Utility";

type WeightCategory = "light" | "medium" | "heavy" | "very_heavy";
type SizeCategory = "tiny" | "small" | "medium" | "larger" | "huge";
type ConditionTier =
  | "almost_dead"
  | "terrible"
  | "bad"
  | "usable"
  | "ok"
  | "good"
  | "very_good"
  | "brand_new";
type RarityTier =
  | "common"
  | "normal"
  | "rare"
  | "ultra_rare"
  | "super_ultra_rare"
  | "wow_you_cant_find_these_anywhere";

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

interface EquipmentCatalogItem {
  id: string;
  name: string;
  type: StageEquipmentType;
  cost: number;
  liveImpact: string;
  weight: WeightCategory;
  size: SizeCategory;
  baseCondition: ConditionTier;
  amountAvailable: number;
  rarity: RarityTier;
  description?: string;
}

interface AdminEquipmentFormValues {
  name: string;
  type: StageEquipmentType;
  cost: number;
  liveImpact: string;
  weight: WeightCategory;
  size: SizeCategory;
  condition: ConditionTier;
  amountAvailable: number;
  rarity: RarityTier;
  description?: string;
}

const EQUIPMENT_TYPES: StageEquipmentType[] = [
  "Sound",
  "Lighting",
  "Visuals",
  "Effects",
  "Decor",
  "Transport",
  "Utility",
];

const CONDITION_ORDER: ConditionTier[] = [
  "almost_dead",
  "terrible",
  "bad",
  "usable",
  "ok",
  "good",
  "very_good",
  "brand_new",
];

const WEIGHT_OPTIONS: WeightCategory[] = ["light", "medium", "heavy", "very_heavy"];
const SIZE_OPTIONS: SizeCategory[] = ["tiny", "small", "medium", "larger", "huge"];
const RARITY_OPTIONS: RarityTier[] = [
  "common",
  "normal",
  "rare",
  "ultra_rare",
  "super_ultra_rare",
  "wow_you_cant_find_these_anywhere",
];

const INITIAL_CATALOG: EquipmentCatalogItem[] = [
  {
    id: "sound-elite-array",
    name: "Elite Line Array System",
    type: "Sound",
    cost: 18500,
    liveImpact: "Arena-grade clarity with directional control for massive rooms.",
    weight: "very_heavy",
    size: "huge",
    baseCondition: "brand_new",
    amountAvailable: 2,
    rarity: "rare",
    description: "Engineered for headline stages that demand pristine dispersion across festival fields.",
  },
  {
    id: "lighting-halo",
    name: "Halo Beam Matrix",
    type: "Lighting",
    cost: 7600,
    liveImpact: "Programmable pan/tilt beams with synchronized pixel waves.",
    weight: "medium",
    size: "larger",
    baseCondition: "very_good",
    amountAvailable: 4,
    rarity: "ultra_rare",
    description: "Ride dramatic sweeps and aerial bursts that punctuate breakdowns and finales.",
  },
  {
    id: "visuals-vortex",
    name: "Vortex LED Wall",
    type: "Visuals",
    cost: 9200,
    liveImpact: "High-density LED mesh for reactive backdrops and dynamic storytelling.",
    weight: "heavy",
    size: "huge",
    baseCondition: "good",
    amountAvailable: 3,
    rarity: "super_ultra_rare",
    description: "Transforms every venue into a cinematic canvas tied to your setlist cues.",
  },
  {
    id: "effects-thunder",
    name: "Thunderstrike FX Rack",
    type: "Effects",
    cost: 5400,
    liveImpact: "Modular CO₂ jets and spark fountains for high-impact drops.",
    weight: "medium",
    size: "medium",
    baseCondition: "good",
    amountAvailable: 5,
    rarity: "rare",
    description: "Stackable effects kit to punctuate anthems without overshooting power limits.",
  },
  {
    id: "decor-backline",
    name: "Neon Skyline Backline",
    type: "Decor",
    cost: 2800,
    liveImpact: "Immersive stage mood with programmable neon and skyline silhouettes.",
    weight: "light",
    size: "larger",
    baseCondition: "ok",
    amountAvailable: 7,
    rarity: "normal",
    description: "A versatile design pack to dress intimate clubs and mid-size theatres.",
  },
  {
    id: "utility-powergrid",
    name: "Road Guardian Power Grid",
    type: "Utility",
    cost: 3600,
    liveImpact: "Smart power distribution with surge analytics and per-phase balancing.",
    weight: "medium",
    size: "medium",
    baseCondition: "very_good",
    amountAvailable: 6,
    rarity: "ultra_rare",
    description: "Keeps your rig humming across unpredictable venues with automated health reports.",
  },
];

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

const labelMap: Record<ConditionTier | WeightCategory | SizeCategory | RarityTier, string> = {
  almost_dead: "Almost Dead",
  terrible: "Terrible",
  bad: "Bad",
  usable: "Usable",
  ok: "Ok",
  good: "Good",
  very_good: "Very Good",
  brand_new: "Brand New",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  very_heavy: "Very Heavy",
  tiny: "Tiny",
  small: "Small",
  larger: "Larger",
  huge: "Huge",
  common: "Common",
  normal: "Normal",
  rare: "Rare",
  ultra_rare: "Ultra Rare",
  super_ultra_rare: "Super Ultra Rare",
  wow_you_cant_find_these_anywhere: "Wow you can't find these anywhere",
};

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value ?? 0);

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

const generateId = () => `catalog-${Math.random().toString(36).slice(2, 10)}`;

const StageEquipmentSystem = () => {
  const queryClient = useQueryClient();
  const { profile } = useGameData();
  const { data: primaryBand, isLoading: loadingBand } = usePrimaryBand();
  const { isAdmin, loading: loadingRole } = useUserRole();
  const bandId = primaryBand?.band_id ?? null;
  const bandName = primaryBand?.bands?.name ?? "Band";

  const [catalog, setCatalog] = useState<EquipmentCatalogItem[]>(INITIAL_CATALOG);
  const [selectedType, setSelectedType] = useState<StageEquipmentType | "all">("all");
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<EquipmentCatalogItem | null>(null);

  const adminForm = useForm<AdminEquipmentFormValues>({
    defaultValues: {
      name: "",
      type: "Sound",
      cost: 1000,
      liveImpact: "Improves live presence",
      weight: "medium",
      size: "medium",
      condition: "good",
      amountAvailable: 1,
      rarity: "normal",
      description: "",
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
    if (selectedType === "all") return catalog;
    return catalog.filter((item) => item.type === selectedType);
  }, [catalog, selectedType]);

  const handleSubmitAdmin = adminForm.handleSubmit((values) => {
    const newItem: EquipmentCatalogItem = {
      id: generateId(),
      name: values.name.trim(),
      type: values.type,
      cost: Number(values.cost) || 0,
      liveImpact: values.liveImpact,
      weight: values.weight,
      size: values.size,
      baseCondition: values.condition,
      amountAvailable: Number(values.amountAvailable) || 0,
      rarity: values.rarity,
      description: values.description?.trim() || undefined,
    };

    setCatalog((prev) => [...prev, newItem]);
    toast.success(`${newItem.name} added to the catalog`);
    adminForm.reset();
  });

  const openPurchaseDialog = (item: EquipmentCatalogItem) => {
    setSelectedCatalogItem(item);
    setPurchaseDialogOpen(true);
  };

  if (loadingBand || loadingEquipment || loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading stage equipment data...
        </div>
      </div>
    );
  }

  if (!profile || !bandId) {
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
                    Filter by stage equipment type and pick the upgrades that elevate your next run of shows.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-muted-foreground">Filter type</Label>
                  <Select value={selectedType} onValueChange={(value) => setSelectedType(value as StageEquipmentType | "all") }>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {EQUIPMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredCatalog.map((item) => (
                    <Card key={item.id} className="flex h-full flex-col justify-between">
                      <CardHeader className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-lg">{item.name}</CardTitle>
                          <Badge variant="secondary">{item.type}</Badge>
                        </div>
                        <CardDescription>{item.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{labelMap[item.weight]} weight</Badge>
                          <Badge variant="outline">{labelMap[item.size]} size</Badge>
                          <Badge variant="outline">{labelMap[item.baseCondition]}</Badge>
                          <Badge variant="outline">{labelMap[item.rarity]}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="font-semibold text-foreground">{formatCurrency(item.cost)}</div>
                          <div className="text-muted-foreground">{item.amountAvailable} available</div>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.liveImpact}</p>
                        <Button
                          className="mt-2"
                          onClick={() => openPurchaseDialog(item)}
                          disabled={item.amountAvailable === 0 || purchaseMutation.isPending}
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" /> Buy equipment
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <div className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
                      <CircleDashed className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No equipment in this category yet. Ask your admin to add more options.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {isAdmin() && (
          <Card>
            <CardHeader>
              <CardTitle>Stage Equipment Admin</CardTitle>
              <CardDescription>
                Curate the global catalog. Define type, rarity, weight, and how each item impacts live performance before bands buy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitAdmin} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Equipment name</Label>
                  <Input id="admin-name" placeholder="Enter equipment name" {...adminForm.register("name", { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Equipment type</Label>
                  <Controller
                    control={adminForm.control}
                    name="type"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {EQUIPMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-cost">Cost</Label>
                  <Input
                    id="admin-cost"
                    type="number"
                    min={0}
                    step={100}
                    {...adminForm.register("cost", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Live performance impact</Label>
                  <Textarea
                    placeholder="Describe how this gear influences a live show"
                    className="min-h-[80px]"
                    {...adminForm.register("liveImpact")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weight</Label>
                  <Controller
                    control={adminForm.control}
                    name="weight"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select weight" />
                        </SelectTrigger>
                        <SelectContent>
                          {WEIGHT_OPTIONS.map((weight) => (
                            <SelectItem key={weight} value={weight}>
                              {labelMap[weight]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Controller
                    control={adminForm.control}
                    name="size"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={size}>
                              {labelMap[size]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Controller
                    control={adminForm.control}
                    name="condition"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_ORDER.slice().reverse().map((condition) => (
                            <SelectItem key={condition} value={condition}>
                              {labelMap[condition]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-amount">Amount available</Label>
                  <Input
                    id="admin-amount"
                    type="number"
                    min={0}
                    {...adminForm.register("amountAvailable", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rareity</Label>
                  <Controller
                    control={adminForm.control}
                    name="rarity"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rarity" />
                        </SelectTrigger>
                        <SelectContent>
                          {RARITY_OPTIONS.map((rarity) => (
                            <SelectItem key={rarity} value={rarity}>
                              {labelMap[rarity]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full md:w-auto">
                    <Plus className="mr-2 h-4 w-4" /> Add equipment to catalog
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
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
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
              <Minus className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button
              onClick={() => selectedCatalogItem && purchaseMutation.mutate(selectedCatalogItem)}
              disabled={!selectedCatalogItem || purchaseMutation.isPending}
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
