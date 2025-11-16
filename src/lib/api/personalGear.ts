// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type GearItemRecord = Tables<"gear_items">;
export type PersonalLoadoutRecord = Tables<"personal_loadouts">;
export type PersonalLoadoutSlotRecord = Tables<"personal_loadout_slots">;

export interface PersonalGearLoadout extends PersonalLoadoutRecord {
  slots: Array<PersonalLoadoutSlotRecord & { gear: GearItemRecord | null }>;
}

export interface SlotAssignmentInput {
  gearItemId: string;
  gearType: PersonalLoadoutSlotRecord["gear_type"];
  pedalPosition?: PersonalLoadoutSlotRecord["pedal_position"] | null;
  pedalStage?: PersonalLoadoutSlotRecord["pedal_stage"] | null;
  notes?: PersonalLoadoutSlotRecord["notes"];
}

export interface UpsertPersonalGearLoadoutInput {
  characterId: string;
  loadoutId?: string;
  name: PersonalLoadoutRecord["name"];
  role?: PersonalLoadoutRecord["role"];
  scenario?: PersonalLoadoutRecord["scenario"];
  primaryInstrument?: PersonalLoadoutRecord["primary_instrument"];
  notes?: PersonalLoadoutRecord["notes"];
  isActive?: PersonalLoadoutRecord["is_active"];
  slots?: SlotAssignmentInput[];
}

type PersonalGearQueryRow = PersonalLoadoutRecord & {
  slots: Array<PersonalLoadoutSlotRecord & { gear: GearItemRecord | null }>;
};

const LOADOUT_WITH_SLOTS_SELECT = `*, slots:personal_loadout_slots (*, gear:gear_items (*))`;

const mapLoadout = (row: PersonalGearQueryRow): PersonalGearLoadout => ({
  ...row,
  slots: row.slots ?? [],
});

export const listPersonalGearLoadouts = async (
  characterId: string
): Promise<PersonalGearLoadout[]> => {
  const { data, error } = await supabase
    .from("personal_loadouts")
    .select(LOADOUT_WITH_SLOTS_SELECT)
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as PersonalGearQueryRow[] | null)?.map(mapLoadout) ?? [];
};

export const getPersonalGearLoadout = async (
  characterId: string,
  loadoutId: string
): Promise<PersonalGearLoadout | null> => {
  const { data, error } = await supabase
    .from("personal_loadouts")
    .select(LOADOUT_WITH_SLOTS_SELECT)
    .eq("character_id", characterId)
    .eq("id", loadoutId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapLoadout(data as PersonalGearQueryRow);
};

export const validateSlotAssignments = (slots: SlotAssignmentInput[] = []): void => {
  const pedalPositions = new Set<number>();
  const uniqueAssignments = new Set<string>();

  for (const slot of slots) {
    if (!slot.gearItemId) {
      throw new Error("Gear item ID is required for slot assignments.");
    }

    if (!slot.gearType) {
      throw new Error("Gear type is required for slot assignments.");
    }

    const assignmentKey = `${slot.gearItemId}:${slot.gearType}`;
    if (uniqueAssignments.has(assignmentKey)) {
      throw new Error("Duplicate gear assignment detected in loadout configuration.");
    }
    uniqueAssignments.add(assignmentKey);

    if (slot.gearType === "pedal") {
      if (slot.pedalPosition === undefined || slot.pedalPosition === null) {
        throw new Error("Pedal assignments require a position between 1 and 10.");
      }

      if (slot.pedalPosition < 1 || slot.pedalPosition > 10) {
        throw new Error("Pedal positions must be between 1 and 10.");
      }

      if (pedalPositions.has(slot.pedalPosition)) {
        throw new Error("Duplicate pedal position detected within the loadout.");
      }

      pedalPositions.add(slot.pedalPosition);
    } else {
      if (slot.pedalPosition !== undefined && slot.pedalPosition !== null) {
        throw new Error("Only pedal assignments may specify a pedal position.");
      }

      if (slot.pedalStage !== undefined && slot.pedalStage !== null) {
        throw new Error("Only pedal assignments may specify a pedal stage.");
      }
    }
  }
};

export const upsertPersonalGearLoadout = async (
  input: UpsertPersonalGearLoadoutInput
): Promise<PersonalGearLoadout> => {
  const {
    characterId,
    loadoutId: maybeExistingId,
    name,
    role,
    scenario,
    primaryInstrument,
    notes,
    isActive = true,
    slots,
  } = input;

  validateSlotAssignments(slots ?? []);

  const basePayload = {
    character_id: characterId,
    name,
    role: role ?? null,
    scenario: scenario ?? null,
    primary_instrument: primaryInstrument ?? null,
    notes: notes ?? null,
    is_active: isActive,
  } satisfies Partial<PersonalLoadoutRecord> & { character_id: string; name: string };

  let loadoutId = maybeExistingId;

  if (loadoutId) {
    const { error } = await supabase
      .from("personal_loadouts")
      .update({
        name: basePayload.name,
        role: basePayload.role,
        scenario: basePayload.scenario,
        primary_instrument: basePayload.primary_instrument,
        notes: basePayload.notes,
        is_active: basePayload.is_active,
      })
      .eq("id", loadoutId)
      .eq("character_id", characterId);

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await supabase
      .from("personal_loadouts")
      .insert([
        {
          character_id: characterId,
          name,
          role: role ?? null,
          scenario: scenario ?? null,
          primary_instrument: primaryInstrument ?? null,
          notes: notes ?? null,
          is_active: isActive,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    loadoutId = (data as PersonalLoadoutRecord).id;
  }

  if (slots) {
    const { error: deleteError } = await supabase
      .from("personal_loadout_slots")
      .delete()
      .eq("loadout_id", loadoutId);

    if (deleteError) {
      throw deleteError;
    }

    if (slots.length > 0) {
      const slotPayload = slots.map((slot) => ({
        loadout_id: loadoutId!,
        gear_item_id: slot.gearItemId,
        gear_type: slot.gearType,
        pedal_position: slot.pedalPosition ?? null,
        pedal_stage: slot.pedalStage ?? null,
        notes: slot.notes ?? null,
      }));

      const { error: insertError } = await supabase
        .from("personal_loadout_slots")
        .insert(slotPayload);

      if (insertError) {
        throw insertError;
      }
    }
  }

  const loadout = await getPersonalGearLoadout(characterId, loadoutId!);

  if (!loadout) {
    throw new Error("Unable to load personal gear loadout after upsert.");
  }

  return loadout;
};
