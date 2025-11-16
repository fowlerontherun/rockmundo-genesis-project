// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";

export type PersonalLoadoutRecord = Tables<"personal_loadouts">;
export type PersonalLoadoutItemRecord = Tables<"personal_loadout_items">;
export type PersonalLoadoutPedalSlotRecord = Tables<"personal_loadout_pedal_slots">;
export type GearItemRecord = Tables<"gear_items">;

export interface PersonalLoadoutWithGear extends PersonalLoadoutRecord {
  items: Array<PersonalLoadoutItemRecord & { gear: GearItemRecord | null }>;
  pedal_slots: Array<PersonalLoadoutPedalSlotRecord & { gear: GearItemRecord | null }>;
}

export interface LoadoutItemInput {
  gearItemId: string;
  slotKind: PersonalLoadoutItemRecord["slot_kind"];
  notes?: string | null;
}

export interface PedalSlotInput {
  slotNumber: PersonalLoadoutPedalSlotRecord["slot_number"];
  slotType: PersonalLoadoutPedalSlotRecord["slot_type"];
  gearItemId?: string | null;
  notes?: string | null;
}

export interface CreatePersonalLoadoutInput {
  characterId: string;
  name: PersonalLoadoutRecord["name"];
  role?: PersonalLoadoutRecord["role"];
  scenario?: PersonalLoadoutRecord["scenario"];
  primaryInstrument?: PersonalLoadoutRecord["primary_instrument"];
  notes?: PersonalLoadoutRecord["notes"];
  isActive?: PersonalLoadoutRecord["is_active"];
  items?: LoadoutItemInput[];
  pedalSlots?: PedalSlotInput[];
}

export interface UpdatePersonalLoadoutInput {
  characterId: string;
  loadoutId: PersonalLoadoutRecord["id"];
  changes?: {
    name?: PersonalLoadoutRecord["name"];
    role?: PersonalLoadoutRecord["role"];
    scenario?: PersonalLoadoutRecord["scenario"];
    primaryInstrument?: PersonalLoadoutRecord["primary_instrument"];
    notes?: PersonalLoadoutRecord["notes"];
    isActive?: PersonalLoadoutRecord["is_active"];
  };
  items?: LoadoutItemInput[];
  pedalSlots?: PedalSlotInput[];
}

type PersonalLoadoutQueryRow = PersonalLoadoutRecord & {
  items: Array<PersonalLoadoutItemRecord & { gear: GearItemRecord | null }>;
  pedal_slots: Array<PersonalLoadoutPedalSlotRecord & { gear: GearItemRecord | null }>;
};

const mapLoadout = (row: PersonalLoadoutQueryRow): PersonalLoadoutWithGear => ({
  ...row,
  items: row.items ?? [],
  pedal_slots: row.pedal_slots ?? [],
});

export const listPersonalLoadoutsByCharacter = async (
  characterId: string
): Promise<PersonalLoadoutWithGear[]> => {
  const { data, error } = await supabase
    .from("personal_loadouts")
    .select(
      `*,
        items:personal_loadout_items (*, gear:gear_items (*)),
        pedal_slots:personal_loadout_pedal_slots (*, gear:gear_items (*))`
    )
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as PersonalLoadoutQueryRow[] | null)?.map(mapLoadout) ?? [];
};

const fetchPersonalLoadoutById = async (
  loadoutId: string
): Promise<PersonalLoadoutWithGear | null> => {
  const { data, error } = await supabase
    .from("personal_loadouts")
    .select(
      `*,
        items:personal_loadout_items (*, gear:gear_items (*)),
        pedal_slots:personal_loadout_pedal_slots (*, gear:gear_items (*))`
    )
    .eq("id", loadoutId)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapLoadout(data as PersonalLoadoutQueryRow);
};

const insertLoadoutItems = async (
  loadoutId: string,
  items?: LoadoutItemInput[]
) => {
  if (!items || items.length === 0) {
    return;
  }

  const payload = items.map((item) => ({
    loadout_id: loadoutId,
    gear_item_id: item.gearItemId,
    slot_kind: item.slotKind,
    notes: item.notes ?? null,
  }));

  const { error } = await supabase
    .from("personal_loadout_items")
    .insert(payload);

  if (error) {
    throw error;
  }
};

const insertPedalSlots = async (
  loadoutId: string,
  pedalSlots?: PedalSlotInput[]
) => {
  if (!pedalSlots || pedalSlots.length === 0) {
    return;
  }

  const payload = pedalSlots.map((slot) => ({
    loadout_id: loadoutId,
    slot_number: slot.slotNumber,
    slot_type: slot.slotType,
    gear_item_id: slot.gearItemId ?? null,
    notes: slot.notes ?? null,
  }));

  const { error } = await supabase
    .from("personal_loadout_pedal_slots")
    .insert(payload);

  if (error) {
    throw error;
  }
};

export const createPersonalLoadout = async (
  input: CreatePersonalLoadoutInput
): Promise<PersonalLoadoutWithGear> => {
  const {
    characterId,
    name,
    role,
    scenario,
    primaryInstrument,
    notes,
    isActive = true,
    items,
    pedalSlots,
  } = input;

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

  const loadoutId = (data as PersonalLoadoutRecord).id;

  await insertLoadoutItems(loadoutId, items);
  await insertPedalSlots(loadoutId, pedalSlots);

  const created = await fetchPersonalLoadoutById(loadoutId);
  if (!created) {
    throw new Error("Failed to load created personal loadout");
  }

  return created;
};

export const updatePersonalLoadout = async (
  input: UpdatePersonalLoadoutInput
): Promise<PersonalLoadoutWithGear | null> => {
  const { characterId, loadoutId, changes, items, pedalSlots } = input;

  const updatePayload: Record<string, unknown> = {};
  if (changes) {
    if (changes.name !== undefined) {
      updatePayload.name = changes.name;
    }
    if (changes.role !== undefined) {
      updatePayload.role = changes.role ?? null;
    }
    if (changes.scenario !== undefined) {
      updatePayload.scenario = changes.scenario ?? null;
    }
    if (changes.primaryInstrument !== undefined) {
      updatePayload.primary_instrument = changes.primaryInstrument ?? null;
    }
    if (changes.notes !== undefined) {
      updatePayload.notes = changes.notes ?? null;
    }
    if (changes.isActive !== undefined) {
      updatePayload.is_active = changes.isActive;
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await supabase
      .from("personal_loadouts")
      .update(updatePayload)
      .eq("id", loadoutId)
      .eq("character_id", characterId);

    if (error) {
      throw error;
    }
  }

  if (items) {
    const { error: deleteError } = await supabase
      .from("personal_loadout_items")
      .delete()
      .eq("loadout_id", loadoutId);

    if (deleteError) {
      throw deleteError;
    }

    await insertLoadoutItems(loadoutId, items);
  }

  if (pedalSlots) {
    const { error: deleteError } = await supabase
      .from("personal_loadout_pedal_slots")
      .delete()
      .eq("loadout_id", loadoutId);

    if (deleteError) {
      throw deleteError;
    }

    await insertPedalSlots(loadoutId, pedalSlots);
  }

  return fetchPersonalLoadoutById(loadoutId);
};
