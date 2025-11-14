import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocation, useSearchParams } from "react-router-dom";

import {
  OTHER_GEAR_LIMIT,
  gearDefinitions,
  initialLoadoutState,
  type GearDefinition,
  type LoadoutOtherItem,
  type LoadoutPedalSlot,
  type LoadoutState,
} from "@/data/personal-loadout";
import { usePlayerEquipment, type PlayerEquipmentWithItem } from "@/hooks/usePlayerEquipment";
import { getQualityLabel, qualityTierStyles, deriveQualityTier } from "@/utils/gearQuality";
import { GearRarityKey, getRarityLabel, parseRarityKey, rarityStyles } from "@/utils/gearRarity";
import { normalizeEquipmentStatBoosts } from "@/types/gear";

const UNASSIGNED_VALUE = "unassigned";
const PEDAL_SLOT_LIMIT = initialLoadoutState.pedalBoard.length;

const mapCategoryToSections = (category: string, subcategory?: string | null) => {
  const normalizedCategory = category.toLowerCase();
  const normalizedSubcategory = subcategory?.toLowerCase() ?? "";

  if (normalizedCategory.includes("mic") || normalizedCategory === "vocal") {
    return ["vocal", "other"] as const;
  }

  if (normalizedCategory.includes("pedal") || normalizedCategory.includes("effect") || normalizedSubcategory.includes("pedal")) {
    return ["pedal", "other"] as const;
  }

  if (normalizedCategory.includes("amp") || normalizedCategory.includes("guitar") || normalizedCategory.includes("instrument")) {
    return ["other"] as const;
  }

  if (normalizedCategory.includes("audio") || normalizedCategory.includes("monitor") || normalizedCategory.includes("interface")) {
    return ["other"] as const;
  }

  return ["other"] as const;
};

const getQualityBadgeClass = (gear: GearDefinition) =>
  gear.qualityTierKey ? qualityTierStyles[gear.qualityTierKey] : "border-muted bg-muted/40 text-muted-foreground";

const getRarityBadgeClass = (gear: GearDefinition) =>
  gear.rarityKey ? rarityStyles[gear.rarityKey as GearRarityKey] : "border-muted bg-muted/40 text-muted-foreground";

const getStatBoostEntries = (boosts?: Record<string, number>) => {
  if (!boosts) {
    return [];
  }

  return Object.entries(boosts).filter(([, value]) => typeof value === "number");
};

const formatSectionList = (sections: GearDefinition["sections"]) =>
  sections
    .map((section) => `${section.charAt(0).toUpperCase()}${section.slice(1)}`)
    .join(" • ");

const buildInventoryGearDefinition = (entry: PlayerEquipmentWithItem): GearDefinition | null => {
  if (!entry.equipment) {
    return null;
  }

  const { equipment } = entry;
  const statBoosts = normalizeEquipmentStatBoosts(equipment.stat_boosts);
  const qualityTier = deriveQualityTier(equipment.price, statBoosts);
  const sections = mapCategoryToSections(equipment.category, equipment.subcategory);
  const rarityKey = parseRarityKey(equipment.rarity);

  return {
    id: entry.id,
    name: equipment.name,
    manufacturer: undefined,
    sections: Array.from(new Set(sections)) as GearDefinition["sections"],
    quality: getQualityLabel(qualityTier) as GearDefinition["quality"],
    rarity: getRarityLabel(equipment.rarity) as GearDefinition["rarity"],
    description: equipment.description ?? undefined,
    price: equipment.price,
    statBoosts: statBoosts ?? undefined,
    stock: equipment.stock ?? null,
    equipmentItemId: equipment.id,
    inventoryId: entry.id,
    source: "inventory",
    rarityKey,
    qualityTierKey: qualityTier,
  };
};

const createFreshLoadout = (): LoadoutState =>
  JSON.parse(JSON.stringify(initialLoadoutState)) as LoadoutState;

const formatSlotLabel = (slot: LoadoutPedalSlot) =>
  `${slot.slotType.charAt(0).toUpperCase()}${slot.slotType.slice(1)} slot`;

type LoadoutTabKey = "vocal" | "pedal" | "other";

interface PrefillNoticeState {
  gearId: string;
  tab: LoadoutTabKey;
  assigned: boolean;
}

const MyGear: React.FC = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loadout, setLoadout] = useState<LoadoutState>(() => createFreshLoadout());
  const [pedalValidation, setPedalValidation] = useState<Record<number, string | null>>({});
  const [otherValidation, setOtherValidation] = useState<Record<string, string | null>>({});
  const {
    data: equipmentData,
    isLoading: loadingInventory,
    error: inventoryError,
  } = usePlayerEquipment();
  const inventory: PlayerEquipmentWithItem[] = equipmentData?.items ?? [];
  const gearPoolStatus = equipmentData?.poolStatus ?? [];
  const inventoryErrorMessage = inventoryError
    ? inventoryError instanceof Error
      ? inventoryError.message
      : String(inventoryError)
    : null;

  const presetGear = useMemo(
    () =>
      gearDefinitions.map((gear) => ({
        ...gear,
        source: gear.source ?? "preset",
        rarityKey: gear.rarityKey ?? parseRarityKey(gear.rarity),
      })),
    []
  );

  const inventoryGear = useMemo(() => {
    if (!inventory.length) {
      return [] as GearDefinition[];
    }

    return inventory
      .map((entry) => buildInventoryGearDefinition(entry))
      .filter((gear): gear is GearDefinition => Boolean(gear));
  }, [inventory]);

  const allGearOptions = useMemo(() => [...presetGear, ...inventoryGear], [presetGear, inventoryGear]);

  const gearById = useMemo(
    () => new Map<string, GearDefinition>(allGearOptions.map((gear) => [gear.id, gear])),
    [allGearOptions]
  );

  const [activeTab, setActiveTab] = useState<LoadoutTabKey>("vocal");
  const [prefillNotice, setPrefillNotice] = useState<PrefillNoticeState | null>(null);
  const [pendingPreselectId, setPendingPreselectId] = useState<string | null>(() => {
    const state = location.state as { preselectGearId?: string | null } | null;
    return state?.preselectGearId ?? searchParams.get("gearId");
  });

  useEffect(() => {
    const state = location.state as { preselectGearId?: string | null } | null;
    if (state?.preselectGearId) {
      setPendingPreselectId(state.preselectGearId);
    }
  }, [location.state]);

  useEffect(() => {
    if (!pendingPreselectId) {
      return;
    }

    const gear = gearById.get(pendingPreselectId);
    if (!gear) {
      return;
    }

    let targetTab: LoadoutTabKey = gear.sections.includes("vocal")
      ? "vocal"
      : gear.sections.includes("pedal")
      ? "pedal"
      : "other";
    let assigned = false;

    setLoadout((prev) => {
      if (gear.sections.includes("vocal")) {
        const openSlot = prev.vocalSetup.find((slot) => !slot.gearId);
        if (openSlot) {
          assigned = true;
          targetTab = "vocal";
          return {
            ...prev,
            vocalSetup: prev.vocalSetup.map((slot) =>
              slot.id === openSlot.id ? { ...slot, gearId: gear.id, equipped: true } : slot
            ),
          };
        }
      }

      if (!assigned && gear.sections.includes("pedal")) {
        const openSlot = prev.pedalBoard.find((slot) => !slot.gearId);
        if (openSlot) {
          assigned = true;
          targetTab = "pedal";
          return {
            ...prev,
            pedalBoard: prev.pedalBoard.map((slot) =>
              slot.slotNumber === openSlot.slotNumber ? { ...slot, gearId: gear.id, equipped: true } : slot
            ),
          };
        }
      }

      if (!assigned && gear.sections.includes("other")) {
        const openItem = prev.otherGear.find((item) => !item.gearId);
        if (openItem) {
          assigned = true;
          targetTab = "other";
          return {
            ...prev,
            otherGear: prev.otherGear.map((item) =>
              item.id === openItem.id ? { ...item, gearId: gear.id, equipped: true } : item
            ),
          };
        }
      }

      return prev;
    });

    setActiveTab(targetTab);
    setPrefillNotice({ gearId: gear.id, tab: targetTab, assigned });
    setPendingPreselectId(null);
  }, [pendingPreselectId, gearById, setLoadout]);

  const vocalGearOptions = useMemo(
    () => allGearOptions.filter((gear) => gear.sections.includes("vocal")),
    [allGearOptions]
  );
  const pedalGearOptions = useMemo(
    () => allGearOptions.filter((gear) => gear.sections.includes("pedal")),
    [allGearOptions]
  );
  const otherGearOptions = useMemo(
    () => allGearOptions.filter((gear) => gear.sections.includes("other")),
    [allGearOptions]
  );

  const handleResetLoadout = () => {
    setLoadout(createFreshLoadout());
    setPedalValidation({});
    setOtherValidation({});
  };

  const handleVocalGearChange = (slotId: string, value: string) => {
    const nextGearId = value === UNASSIGNED_VALUE ? null : value;

    setLoadout((prev) => ({
      ...prev,
      vocalSetup: prev.vocalSetup.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              gearId: nextGearId,
              equipped: nextGearId ? true : false,
            }
          : slot
      ),
    }));
  };

  const handleVocalEquippedChange = (slotId: string, equipped: boolean) => {
    setLoadout((prev) => ({
      ...prev,
      vocalSetup: prev.vocalSetup.map((slot) => (slot.id === slotId ? { ...slot, equipped } : slot)),
    }));
  };

  const handlePedalGearChange = (slotNumber: number, value: string) => {
    if (value === UNASSIGNED_VALUE) {
      setPedalValidation((prev) => ({ ...prev, [slotNumber]: null }));
      setLoadout((prev) => ({
        ...prev,
        pedalBoard: prev.pedalBoard.map((slot) =>
          slot.slotNumber === slotNumber
            ? {
                ...slot,
                gearId: null,
                equipped: false,
              }
            : slot
        ),
      }));
      return;
    }

    const selectedGear = gearById.get(value);
    const targetSlot = loadout.pedalBoard.find((slot) => slot.slotNumber === slotNumber);

    if (!selectedGear || !targetSlot) {
      return;
    }

    const currentAssignments = loadout.pedalBoard.filter((slot) => Boolean(slot.gearId)).length;
    const isSlotCurrentlyEmpty = !targetSlot.gearId;

    if (isSlotCurrentlyEmpty && currentAssignments >= PEDAL_SLOT_LIMIT) {
      setPedalValidation((prev) => ({
        ...prev,
        [slotNumber]: `All ${PEDAL_SLOT_LIMIT} pedal slots are assigned. Remove a pedal before adding another.`,
      }));
      return;
    }

    if (
      selectedGear.compatiblePedalSlots &&
      !selectedGear.compatiblePedalSlots.includes(targetSlot.slotType)
    ) {
      setPedalValidation((prev) => ({
        ...prev,
        [slotNumber]: `${selectedGear.name} is not compatible with ${targetSlot.slotType} slots.`,
      }));
      return;
    }

    const duplicate = loadout.pedalBoard.find(
      (slot) => slot.slotNumber !== slotNumber && slot.gearId === value
    );

    if (duplicate) {
      setPedalValidation((prev) => ({
        ...prev,
        [slotNumber]: `${selectedGear.name} is already assigned to slot ${duplicate.slotNumber}.`,
      }));
      return;
    }

    setPedalValidation((prev) => ({ ...prev, [slotNumber]: null }));
    setLoadout((prev) => ({
      ...prev,
      pedalBoard: prev.pedalBoard.map((slot) =>
        slot.slotNumber === slotNumber
          ? {
              ...slot,
              gearId: value,
              equipped: true,
            }
          : slot
      ),
    }));
  };

  const handlePedalEquippedChange = (slotNumber: number, equipped: boolean) => {
    setLoadout((prev) => ({
      ...prev,
      pedalBoard: prev.pedalBoard.map((slot) =>
        slot.slotNumber === slotNumber ? { ...slot, equipped } : slot
      ),
    }));
  };

  const handleOtherGearChange = (itemId: string, value: string) => {
    if (value === UNASSIGNED_VALUE) {
      setOtherValidation((prev) => ({ ...prev, [itemId]: null }));
      setLoadout((prev) => ({
        ...prev,
        otherGear: prev.otherGear.map((item) =>
          item.id === itemId
            ? {
                ...item,
                gearId: null,
                equipped: false,
              }
            : item
        ),
      }));
      return;
    }

    const selectedGear = gearById.get(value);

    if (!selectedGear) {
      return;
    }

    const duplicate = loadout.otherGear.find(
      (item) => item.id !== itemId && item.gearId === value
    );

    if (duplicate) {
      setOtherValidation((prev) => ({
        ...prev,
        [itemId]: `${selectedGear.name} already assigned to ${duplicate.label}.`,
      }));
      return;
    }

    setOtherValidation((prev) => ({ ...prev, [itemId]: null }));
    setLoadout((prev) => ({
      ...prev,
      otherGear: prev.otherGear.map((item) =>
        item.id === itemId
          ? {
              ...item,
              gearId: value,
              equipped: true,
            }
          : item
      ),
    }));
  };

  const handleOtherEquippedChange = (itemId: string, equipped: boolean) => {
    setLoadout((prev) => ({
      ...prev,
      otherGear: prev.otherGear.map((item) =>
        item.id === itemId ? { ...item, equipped } : item
      ),
    }));
  };

  const handleRemoveOtherGear = (itemId: string) => {
    setLoadout((prev) => ({
      ...prev,
      otherGear: prev.otherGear.filter((item) => item.id !== itemId),
    }));
    setOtherValidation((prev) => {
      const { [itemId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleAddOtherGear = () => {
    if (loadout.otherGear.length >= OTHER_GEAR_LIMIT) {
      return;
    }

    const identifier = `other-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const nextItem: LoadoutOtherItem = {
      id: identifier,
      label: `Additional Gear ${loadout.otherGear.length + 1}`,
      gearId: null,
      equipped: false,
    };

    setLoadout((prev) => ({
      ...prev,
      otherGear: [...prev.otherGear, nextItem],
    }));
  };

  const tabLabelMap: Record<LoadoutTabKey, string> = {
    vocal: "Vocal Setup",
    pedal: "Pedal Board",
    other: "Auxiliary Gear",
  };

  const noticeGear = prefillNotice ? gearById.get(prefillNotice.gearId) : null;
  const handleDismissNotice = () => setPrefillNotice(null);

  const renderGearStatus = (gearId: string | null) => {
    if (!gearId) {
      return <Badge variant="outline">Unassigned</Badge>;
    }

    const selectedGear = gearById.get(gearId);
    if (!selectedGear) {
      return <Badge variant="outline">Unknown Gear</Badge>;
    }

    return (
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={getQualityBadgeClass(selectedGear)}>
            {selectedGear.quality}
          </Badge>
          <Badge variant="outline" className={getRarityBadgeClass(selectedGear)}>
            {selectedGear.rarity}
          </Badge>
          {selectedGear.source === "inventory" ? <Badge variant="secondary">Owned</Badge> : null}
        </div>
        <div className="text-muted-foreground">
          Cost: {typeof selectedGear.price === "number" ? `$${selectedGear.price.toLocaleString()}` : "—"}
        </div>
        {typeof selectedGear.stock === "number" ? (
          <div className="text-muted-foreground">
            Shop stock: {selectedGear.stock <= 0 ? "Sold out" : selectedGear.stock}
          </div>
        ) : null}
        {getStatBoostEntries(selectedGear.statBoosts).length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {getStatBoostEntries(selectedGear.statBoosts).map(([stat, value]) => (
              <Badge key={stat} variant="outline" className={getRarityBadgeClass(selectedGear)}>
                {stat}: +{value}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Personal Loadout Planner</h1>
          <p className="max-w-3xl text-muted-foreground">
            Build and tune your performance rig. Assign microphones, dial in pedal board slots, and track auxiliary gear in a
            single view. Inline editors update the loadout instantly while enforcing slot limits and compatibility rules.
          </p>
      </div>
      <Button variant="outline" size="sm" onClick={handleResetLoadout}>
        <RefreshCcw className="h-4 w-4" />
        Reset to defaults
      </Button>
    </div>

      {prefillNotice && noticeGear ? (
        <Alert className="border-primary/40 bg-primary/5">
          <AlertTitle className="flex items-center justify-between gap-2 text-sm font-semibold">
            <span>
              {noticeGear.name} {prefillNotice.assigned ? "equipped" : "ready"} in {tabLabelMap[prefillNotice.tab]}
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleDismissNotice}>
              Dismiss
            </Button>
          </AlertTitle>
          <AlertDescription className="text-sm">
            {prefillNotice.assigned
              ? "We slotted your latest purchase into the first available position. Adjust placement if needed."
              : "All slots are filled—open the highlighted tab to choose where this gear should live."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>{loadout.metadata.name}</CardTitle>
            <CardDescription>
              {loadout.metadata.role} • {loadout.metadata.scenario}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loadout.metadata.isActive ? <Badge variant="default">Active</Badge> : <Badge variant="secondary">Archived</Badge>}
            <Badge variant="outline">Primary: {loadout.metadata.primaryInstrument}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{loadout.metadata.notes}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory highlights</CardTitle>
          <CardDescription>Purchased gear from the shop is ready for slot assignments and stat bonuses.</CardDescription>
        </CardHeader>
        <CardContent>
          {inventoryErrorMessage ? (
            <Alert variant="destructive" className="max-w-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Inventory unavailable</AlertTitle>
              <AlertDescription>{inventoryErrorMessage}</AlertDescription>
            </Alert>
          ) : loadingInventory ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : inventoryGear.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              You haven&apos;t purchased any gear yet. Visit the Gear Shop to unlock stat-boosting equipment tiers.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {inventoryGear.map((gear) => {
                const boosts = getStatBoostEntries(gear.statBoosts);
                const highlight = prefillNotice?.gearId === gear.id;
                const cardClasses = highlight
                  ? "rounded-lg border border-primary p-4 shadow-[0_0_0_2px] shadow-primary/20"
                  : "rounded-lg border p-4";

                return (
                  <div key={gear.id} className={cardClasses}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{gear.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSectionList(gear.sections)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={getQualityBadgeClass(gear)}>
                          {gear.quality}
                        </Badge>
                        <Badge variant="outline" className={getRarityBadgeClass(gear)}>
                          {gear.rarity}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Cost</span>
                      <span className="text-right">
                        {typeof gear.price === "number" ? `$${gear.price.toLocaleString()}` : "—"}
                      </span>
                      <span>Shop stock</span>
                      <span className="text-right">
                        {typeof gear.stock === "number"
                          ? gear.stock <= 0
                            ? "Sold out"
                            : gear.stock
                          : "—"}
                      </span>
                    </div>
                    {boosts.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-1 text-[10px]">
                        {boosts.map(([stat, value]) => (
                          <Badge key={stat} variant="outline" className={getRarityBadgeClass(gear)}>
                            {stat}: +{value}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LoadoutTabKey)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vocal">Vocal Setup</TabsTrigger>
          <TabsTrigger value="pedal">Pedal Board</TabsTrigger>
          <TabsTrigger value="other">Other Gear</TabsTrigger>
        </TabsList>

        <TabsContent value="vocal" className="space-y-4">
          <VocalSetupPanel
            slots={loadout.vocalSetup}
            gearOptions={vocalGearOptions}
            onGearChange={handleVocalGearChange}
            onEquippedChange={handleVocalEquippedChange}
            gearLookup={gearById}
          />
        </TabsContent>

        <TabsContent value="pedal" className="space-y-4">
          <PedalBoardGrid
            slots={loadout.pedalBoard}
            gearOptions={pedalGearOptions}
            validationMessages={pedalValidation}
            onGearChange={handlePedalGearChange}
            onEquippedChange={handlePedalEquippedChange}
            gearLookup={gearById}
            remainingSlots={undefined}
          />
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <OtherGearList
            items={loadout.otherGear}
            gearOptions={otherGearOptions}
            validationMessages={otherValidation}
            onGearChange={handleOtherGearChange}
            onEquippedChange={handleOtherEquippedChange}
            onAddItem={handleAddOtherGear}
            onRemoveItem={handleRemoveOtherGear}
            isAddDisabled={loadout.otherGear.length >= OTHER_GEAR_LIMIT}
            gearLookup={gearById}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface GearAssignmentStatusProps {
  gearId: string | null;
  gearLookup: Map<string, GearDefinition>;
}

const GearAssignmentStatus: React.FC<GearAssignmentStatusProps> = ({ gearId, gearLookup }) => {
  if (!gearId) {
    return <Badge variant="outline">Unassigned</Badge>;
  }

  const selectedGear = gearLookup.get(gearId);

  if (!selectedGear) {
    return <Badge variant="outline">Unknown Gear</Badge>;
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={getQualityBadgeClass(selectedGear)}>
          {selectedGear.quality}
        </Badge>
        <Badge variant="outline" className={getRarityBadgeClass(selectedGear)}>
          {selectedGear.rarity}
        </Badge>
        {selectedGear.source === "inventory" ? <Badge variant="secondary">Owned</Badge> : null}
      </div>
      <div className="text-muted-foreground">
        Cost: {typeof selectedGear.price === "number" ? `$${selectedGear.price.toLocaleString()}` : "—"}
      </div>
      {typeof selectedGear.stock === "number" ? (
        <div className="text-muted-foreground">
          Shop stock: {selectedGear.stock <= 0 ? "Sold out" : selectedGear.stock}
        </div>
      ) : null}
      {getStatBoostEntries(selectedGear.statBoosts).length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {getStatBoostEntries(selectedGear.statBoosts).map(([stat, value]) => (
            <Badge key={stat} variant="outline" className={getRarityBadgeClass(selectedGear)}>
              {stat}: +{value}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Outlines editing controls for the vocal chain, exposing selection and equipped toggles per slot.
 * onGearChange expects a slot id and a value (gear id or UNASSIGNED_VALUE) to persist the selection upstream.
 * onEquippedChange surfaces live state changes for status messaging or validation higher in the tree.
 */
interface VocalSetupPanelProps {
  slots: LoadoutState["vocalSetup"];
  gearOptions: GearDefinition[];
  onGearChange: (slotId: string, nextGearId: string) => void;
  onEquippedChange: (slotId: string, equipped: boolean) => void;
  gearLookup: Map<string, GearDefinition>;
}

const VocalSetupPanel: React.FC<VocalSetupPanelProps> = ({
  slots,
  gearOptions,
  onGearChange,
  onEquippedChange,
  gearLookup,
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Vocal Signal Flow</CardTitle>
      <CardDescription>
        Assign microphones, preamps, and monitoring for the front-of-house vocal chain.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {slots.map((slot) => {
        const selectedGear = slot.gearId ? gearLookup.get(slot.gearId) : undefined;

        return (
          <div key={slot.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-base font-semibold">{slot.label}</p>
                {slot.notes ? (
                  <p className="text-sm text-muted-foreground">{slot.notes}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={slot.equipped}
                  onCheckedChange={(checked) => onEquippedChange(slot.id, checked)}
                  disabled={!slot.gearId}
                  aria-label={`Toggle ${slot.label} equipped state`}
                />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {slot.equipped ? "Equipped" : "Standby"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:max-w-md">
                <Select
                  value={slot.gearId ?? UNASSIGNED_VALUE}
                  onValueChange={(next) => onGearChange(slot.id, next)}
                >
                  <SelectTrigger aria-label={`Select gear for ${slot.label}`}>
                    <SelectValue placeholder="Assign gear" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                    {gearOptions.map((gear) => (
                      <SelectItem key={gear.id} value={gear.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{gear.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {gear.source === "inventory" ? "Owned" : "Preset"} • {gear.rarity}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <GearAssignmentStatus gearId={slot.gearId} gearLookup={gearLookup} />
            </div>

            {selectedGear?.description ? (
              <p className="mt-3 text-sm text-muted-foreground">{selectedGear.description}</p>
            ) : null}
          </div>
        );
      })}
    </CardContent>
  </Card>
);

/**
 * PedalBoardGrid centralizes pedal slot editing. Validation messages should be keyed by slot number
 * and will render inline under the selector. RemainingSlots communicates capacity for UI feedback or toast messaging.
 */
interface PedalBoardGridProps {
  slots: LoadoutState["pedalBoard"];
  gearOptions: GearDefinition[];
  validationMessages: Record<number, string | null>;
  onGearChange: (slotNumber: number, nextGearId: string) => void;
  onEquippedChange: (slotNumber: number, equipped: boolean) => void;
  gearLookup: Map<string, GearDefinition>;
  remainingSlots: number;
}

const PedalBoardGrid: React.FC<PedalBoardGridProps> = ({
  slots,
  gearOptions,
  validationMessages,
  onGearChange,
  onEquippedChange,
  gearLookup,
  remainingSlots,
}) => (
  <Card>
    <CardHeader>
      <CardTitle>Pedal Board Routing</CardTitle>
      <CardDescription>
        Ten configurable slots handle the full guitar signal chain. Slot validation keeps incompatible pedals out of the wrong
        lane.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="mb-4 text-xs text-muted-foreground">
        {remainingSlots > 0
          ? `${remainingSlots} pedal ${remainingSlots === 1 ? "slot" : "slots"} available for new assignments.`
          : "Pedal board is full—swap or clear a slot to add new pedals."}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {slots.map((slot) => {
          const selectedGear = slot.gearId ? gearLookup.get(slot.gearId) : undefined;
          const errorMessage = validationMessages[slot.slotNumber] ?? null;

          return (
            <div key={slot.slotNumber} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-base font-semibold">Slot {slot.slotNumber}</p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {formatSlotLabel(slot)}
                  </p>
                  {slot.notes ? (
                    <p className="text-sm text-muted-foreground">{slot.notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={slot.equipped}
                    onCheckedChange={(checked) => onEquippedChange(slot.slotNumber, checked)}
                    disabled={!slot.gearId}
                    aria-label={`Toggle slot ${slot.slotNumber} equipped state`}
                  />
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {slot.equipped ? "Equipped" : "Bypassed"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <Select
                  value={slot.gearId ?? UNASSIGNED_VALUE}
                  onValueChange={(next) => onGearChange(slot.slotNumber, next)}
                >
                  <SelectTrigger aria-label={`Select pedal for slot ${slot.slotNumber}`}>
                    <SelectValue placeholder="Assign pedal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                    {gearOptions.map((gear) => (
                      <SelectItem key={gear.id} value={gear.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{gear.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {gear.source === "inventory" ? "Owned" : "Preset"} • {gear.rarity}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <GearAssignmentStatus gearId={slot.gearId} gearLookup={gearLookup} />
                {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
              </div>

              {selectedGear?.description ? (
                <p className="mt-3 text-sm text-muted-foreground">{selectedGear.description}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
);

/**
 * OtherGearList manages add/remove actions plus assignment validation for auxiliary equipment.
 * Validation messages should be keyed by item id. onAddItem/onRemoveItem allow the parent to handle persistence or limits.
 */
interface OtherGearListProps {
  items: LoadoutState["otherGear"];
  gearOptions: GearDefinition[];
  validationMessages: Record<string, string | null>;
  onGearChange: (itemId: string, nextGearId: string) => void;
  onEquippedChange: (itemId: string, equipped: boolean) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
  isAddDisabled: boolean;
  gearLookup: Map<string, GearDefinition>;
}

const OtherGearList: React.FC<OtherGearListProps> = ({
  items,
  gearOptions,
  validationMessages,
  onGearChange,
  onEquippedChange,
  onAddItem,
  onRemoveItem,
  isAddDisabled,
  gearLookup,
}) => (
  <Card>
    <CardHeader className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <CardTitle>Auxiliary & Backup Gear</CardTitle>
        <CardDescription>Track backup guitars, wireless packs, and anything beyond the core board.</CardDescription>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onAddItem}
        disabled={isAddDisabled}
      >
        <Plus className="h-4 w-4" />
        Add gear slot
      </Button>
    </CardHeader>
    <CardContent className="space-y-4">
      {isAddDisabled ? (
        <p className="text-xs text-muted-foreground">
          Maximum of {OTHER_GEAR_LIMIT} auxiliary items reached. Free up a slot to add more equipment.
        </p>
      ) : null}

      {items.map((item) => {
        const selectedGear = item.gearId ? gearLookup.get(item.gearId) : undefined;
        const errorMessage = validationMessages[item.id] ?? null;

        return (
          <div key={item.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-base font-semibold">{item.label}</p>
                {item.notes ? (
                  <p className="text-sm text-muted-foreground">{item.notes}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={item.equipped}
                  onCheckedChange={(checked) => onEquippedChange(item.id, checked)}
                  disabled={!item.gearId}
                  aria-label={`Toggle ${item.label} equipped state`}
                />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.equipped ? "Packed" : "Reserve"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label={`Remove ${item.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:max-w-md">
                <Select
                  value={item.gearId ?? UNASSIGNED_VALUE}
                  onValueChange={(next) => onGearChange(item.id, next)}
                >
                  <SelectTrigger aria-label={`Select gear for ${item.label}`}>
                    <SelectValue placeholder="Assign gear" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                    {gearOptions.map((gear) => (
                      <SelectItem key={gear.id} value={gear.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{gear.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {gear.source === "inventory" ? "Owned" : "Preset"} • {gear.rarity}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <GearAssignmentStatus gearId={item.gearId} gearLookup={gearLookup} />
            </div>

            {errorMessage ? <p className="mt-2 text-xs text-destructive">{errorMessage}</p> : null}

            {selectedGear?.description ? (
              <p className="mt-3 text-sm text-muted-foreground">{selectedGear.description}</p>
            ) : null}
          </div>
        );
      })}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No auxiliary gear assigned yet. Use “Add gear slot” to start tracking extras.
        </div>
      ) : null}
    </CardContent>
  </Card>
);

export default MyGear;
