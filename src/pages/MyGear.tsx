import React, { useMemo, useState } from "react";
import { Plus, RefreshCcw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  OTHER_GEAR_LIMIT,
  gearDefinitions,
  initialLoadoutState,
  type GearDefinition,
  type LoadoutOtherItem,
  type LoadoutPedalSlot,
  type LoadoutState,
} from "@/data/personal-loadout";

const UNASSIGNED_VALUE = "unassigned";

const createFreshLoadout = (): LoadoutState =>
  JSON.parse(JSON.stringify(initialLoadoutState)) as LoadoutState;

const formatSlotLabel = (slot: LoadoutPedalSlot) =>
  `${slot.slotType.charAt(0).toUpperCase()}${slot.slotType.slice(1)} slot`;

const MyGear: React.FC = () => {
  const [loadout, setLoadout] = useState<LoadoutState>(() => createFreshLoadout());
  const [pedalValidation, setPedalValidation] = useState<Record<number, string | null>>({});
  const [otherValidation, setOtherValidation] = useState<Record<string, string | null>>({});

  const gearById = useMemo(
    () => new Map<string, GearDefinition>(gearDefinitions.map((gear) => [gear.id, gear])),
    []
  );

  const vocalGearOptions = useMemo(
    () => gearDefinitions.filter((gear) => gear.sections.includes("vocal")),
    []
  );
  const pedalGearOptions = useMemo(
    () => gearDefinitions.filter((gear) => gear.sections.includes("pedal")),
    []
  );
  const otherGearOptions = useMemo(
    () => gearDefinitions.filter((gear) => gear.sections.includes("other")),
    []
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

  const renderGearStatus = (gearId: string | null) => {
    if (!gearId) {
      return <Badge variant="outline">Unassigned</Badge>;
    }

    const selectedGear = gearById.get(gearId);
    if (!selectedGear) {
      return <Badge variant="outline">Unknown Gear</Badge>;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{selectedGear.quality}</Badge>
        <Badge variant="outline">{selectedGear.rarity}</Badge>
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

      <Tabs defaultValue="vocal" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vocal">Vocal Setup</TabsTrigger>
          <TabsTrigger value="pedal">Pedal Board</TabsTrigger>
          <TabsTrigger value="other">Other Gear</TabsTrigger>
        </TabsList>

        <TabsContent value="vocal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vocal Signal Flow</CardTitle>
              <CardDescription>
                Assign microphones, preamps, and monitoring for the front-of-house vocal chain.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadout.vocalSetup.map((slot) => {
                const selectedGear = slot.gearId ? gearById.get(slot.gearId) : undefined;

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
                          onCheckedChange={(checked) => handleVocalEquippedChange(slot.id, checked)}
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
                          onValueChange={(next) => handleVocalGearChange(slot.id, next)}
                        >
                          <SelectTrigger aria-label={`Select gear for ${slot.label}`}>
                            <SelectValue placeholder="Assign gear" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                            {vocalGearOptions.map((gear) => (
                              <SelectItem key={gear.id} value={gear.id}>
                                {gear.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {renderGearStatus(slot.gearId)}
                    </div>

                    {selectedGear?.description ? (
                      <p className="mt-3 text-sm text-muted-foreground">{selectedGear.description}</p>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pedal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pedal Board Routing</CardTitle>
              <CardDescription>
                Ten configurable slots handle the full guitar signal chain. Slot validation keeps incompatible pedals out of the
                wrong lane.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
                {loadout.pedalBoard.map((slot) => {
                  const selectedGear = slot.gearId ? gearById.get(slot.gearId) : undefined;
                  const errorMessage = pedalValidation[slot.slotNumber] ?? null;

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
                            onCheckedChange={(checked) => handlePedalEquippedChange(slot.slotNumber, checked)}
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
                          onValueChange={(next) => handlePedalGearChange(slot.slotNumber, next)}
                        >
                          <SelectTrigger aria-label={`Select pedal for slot ${slot.slotNumber}`}>
                            <SelectValue placeholder="Assign pedal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                            {pedalGearOptions.map((gear) => (
                              <SelectItem key={gear.id} value={gear.id}>
                                {gear.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {renderGearStatus(slot.gearId)}
                        {errorMessage ? (
                          <p className="text-xs text-destructive">{errorMessage}</p>
                        ) : null}
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
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
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
                onClick={handleAddOtherGear}
                disabled={loadout.otherGear.length >= OTHER_GEAR_LIMIT}
              >
                <Plus className="h-4 w-4" />
                Add gear slot
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadout.otherGear.length >= OTHER_GEAR_LIMIT ? (
                <p className="text-xs text-muted-foreground">
                  Maximum of {OTHER_GEAR_LIMIT} auxiliary items reached. Free up a slot to add more equipment.
                </p>
              ) : null}

              {loadout.otherGear.map((item) => {
                const selectedGear = item.gearId ? gearById.get(item.gearId) : undefined;
                const errorMessage = otherValidation[item.id] ?? null;

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
                          onCheckedChange={(checked) => handleOtherEquippedChange(item.id, checked)}
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
                          onClick={() => handleRemoveOtherGear(item.id)}
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
                          onValueChange={(next) => handleOtherGearChange(item.id, next)}
                        >
                          <SelectTrigger aria-label={`Select gear for ${item.label}`}>
                            <SelectValue placeholder="Assign gear" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
                            {otherGearOptions.map((gear) => (
                              <SelectItem key={gear.id} value={gear.id}>
                                {gear.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {renderGearStatus(item.gearId)}
                    </div>

                    {errorMessage ? (
                      <p className="mt-2 text-xs text-destructive">{errorMessage}</p>
                    ) : null}

                    {selectedGear?.description ? (
                      <p className="mt-3 text-sm text-muted-foreground">{selectedGear.description}</p>
                    ) : null}
                  </div>
                );
              })}

              {loadout.otherGear.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No auxiliary gear assigned yet. Use “Add gear slot” to start tracking extras.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyGear;
