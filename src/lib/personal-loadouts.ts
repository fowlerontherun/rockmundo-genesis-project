import { supabase } from "@/integrations/supabase/client";
import { assertNonEmptyString, throwDbError } from "@/lib/db-errors";

const db = supabase as any;

export type PersonalLoadoutRecord = Record<string, any>;
export type PersonalLoadoutItemRecord = Record<string, any>;
export type PersonalLoadoutPedalSlotRecord = Record<string, any>;
export type GearItemRecord = Record<string, any>;

export interface PersonalLoadoutWithGear extends PersonalLoadoutRecord {
  items: Array<PersonalLoadoutItemRecord & { gear: GearItemRecord | null }>;
  pedal_slots: Array<PersonalLoadoutPedalSlotRecord & { gear: GearItemRecord | null }>;
}

export interface LoadoutItemInput {
  gearItemId: string;
  slotKind: string;
  notes?: string | null;
}

export interface PedalSlotInput {
  slotNumber: number;
  slotType: string;
  gearItemId?: string | null;
  notes?: string | null;
}

export interface CreatePersonalLoadoutInput {
  characterId: string;
  name: string;
  role?: string | null;
  scenario?: string | null;
  primaryInstrument?: string | null;
  notes?: string | null;
  isActive?: boolean;
  items?: LoadoutItemInput[];
  pedalSlots?: PedalSlotInput[];
}

export interface UpdatePersonalLoadoutInput {
  characterId: string;
  loadoutId: string;
  changes?: {
    name?: string;
    role?: string | null;
    scenario?: string | null;
    primaryInstrument?: string | null;
    notes?: string | null;
    isActive?: boolean;
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
  const validCharacterId = assertNonEmptyString(characterId, "characterId");

  const { data, error } = await db
    .from("personal_loadouts")
    .select(
      `*,
        items:personal_loadout_items (*, gear:gear_items (*)),
        pedal_slots:personal_loadout_pedal_slots (*, gear:gear_items (*))`
    )
    .eq("character_id", validCharacterId)
    .order("created_at", { ascending: true });

  if (error) {
    throwDbError(error, { operation: "list", table: "personal_loadouts", filters: { characterId: validCharacterId }, rlsHint: "Verify RLS allows the current user to read this character." });
  }

  return (data as PersonalLoadoutQueryRow[] | null)?.map(mapLoadout) ?? [];
};

const fetchPersonalLoadoutById = async (
  loadoutId: string
): Promise<PersonalLoadoutWithGear | null> => {
  const validLoadoutId = assertNonEmptyString(loadoutId, "loadoutId");

  const { data, error } = await db
    .from("personal_loadouts")
    .select(
      `*,
        items:personal_loadout_items (*, gear:gear_items (*)),
        pedal_slots:personal_loadout_pedal_slots (*, gear:gear_items (*))`
    )
    .eq("id", validLoadoutId)
    .maybeSingle();

  if (error) {
    throwDbError(error, { operation: "fetch", table: "personal_loadouts", filters: { loadoutId: validLoadoutId }, rlsHint: "A null row can mean not found or hidden by RLS." });
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

  const validLoadoutId = assertNonEmptyString(loadoutId, "loadoutId");
  const payload = items.map((item) => ({
    loadout_id: validLoadoutId,
    gear_item_id: assertNonEmptyString(item.gearItemId, "items[].gearItemId"),
    slot_kind: assertNonEmptyString(item.slotKind, "items[].slotKind"),
    notes: item.notes ?? null,
  }));

  const { error } = await db
    .from("personal_loadout_items")
    .insert(payload);

  if (error) {
    throwDbError(error, { operation: "insert", table: "personal_loadout_items", filters: { loadoutId: validLoadoutId }, rlsHint: "Verify loadout_id and gear_item_id foreign keys are visible and valid." });
  }
};

const insertPedalSlots = async (
  loadoutId: string,
  pedalSlots?: PedalSlotInput[]
) => {
  if (!pedalSlots || pedalSlots.length === 0) {
    return;
  }

  const validLoadoutId = assertNonEmptyString(loadoutId, "loadoutId");
  const payload = pedalSlots.map((slot) => ({
    loadout_id: validLoadoutId,
    slot_number: slot.slotNumber,
    slot_type: assertNonEmptyString(slot.slotType, "pedalSlots[].slotType"),
    gear_item_id: slot.gearItemId ?? null,
    notes: slot.notes ?? null,
  }));

  const { error } = await db
    .from("personal_loadout_pedal_slots")
    .insert(payload);

  if (error) {
    throwDbError(error, { operation: "insert", table: "personal_loadout_pedal_slots", filters: { loadoutId: validLoadoutId }, rlsHint: "Verify loadout_id and optional gear_item_id foreign keys are visible and valid." });
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

  const { data, error } = await db
    .from("personal_loadouts")
    .insert([
      {
        character_id: assertNonEmptyString(characterId, "characterId"),
        name: assertNonEmptyString(name, "name"),
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
    throwDbError(error, { operation: "insert", table: "personal_loadouts", filters: { characterId }, rlsHint: "Verify RLS allows inserts for this character and required FKs exist." });
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
  const validCharacterId = assertNonEmptyString(characterId, "characterId");
  const validLoadoutId = assertNonEmptyString(loadoutId, "loadoutId");

  const updatePayload: Record<string, unknown> = {};
  if (changes) {
    if (changes.name !== undefined) updatePayload.name = assertNonEmptyString(changes.name, "changes.name");
    if (changes.role !== undefined) updatePayload.role = changes.role ?? null;
    if (changes.scenario !== undefined) updatePayload.scenario = changes.scenario ?? null;
    if (changes.primaryInstrument !== undefined) updatePayload.primary_instrument = changes.primaryInstrument ?? null;
    if (changes.notes !== undefined) updatePayload.notes = changes.notes ?? null;
    if (changes.isActive !== undefined) updatePayload.is_active = changes.isActive;
  }

  if (Object.keys(updatePayload).length > 0) {
    const { error } = await db
      .from("personal_loadouts")
      .update(updatePayload)
      .eq("id", validLoadoutId)
      .eq("character_id", validCharacterId);

    if (error) {
      throwDbError(error, { operation: "update", table: "personal_loadouts", filters: { loadoutId: validLoadoutId, characterId: validCharacterId }, rlsHint: "A zero-row update can indicate RLS or ownership mismatch." });
    }
  }

  if (items) {
    const { error: deleteError } = await db
      .from("personal_loadout_items")
      .delete()
      .eq("loadout_id", validLoadoutId);

    if (deleteError) {
      throwDbError(deleteError, { operation: "delete", table: "personal_loadout_items", filters: { loadoutId: validLoadoutId }, rlsHint: "Verify child rows are covered by loadout ownership RLS." });
    }

    await insertLoadoutItems(loadoutId, items);
  }

  if (pedalSlots) {
    const { error: deleteError } = await db
      .from("personal_loadout_pedal_slots")
      .delete()
      .eq("loadout_id", validLoadoutId);

    if (deleteError) {
      throwDbError(deleteError, { operation: "delete", table: "personal_loadout_pedal_slots", filters: { loadoutId: validLoadoutId }, rlsHint: "Verify child rows are covered by loadout ownership RLS." });
    }

    await insertPedalSlots(loadoutId, pedalSlots);
  }

  return fetchPersonalLoadoutById(validLoadoutId);
};
