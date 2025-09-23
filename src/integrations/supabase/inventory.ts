import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/supabase-types";
import type { FriendProfileRow } from "@/integrations/supabase/friends";

export type InventoryTransferRow = Tables<"inventory_transfers">;
// Note: These tables don't exist in the current schema, using fallback types
export type PlayerSkillBookRow = { id: string; title: string; [key: string]: any };
export type SkillBookRow = { id: string; title: string; [key: string]: any };

export interface InventoryTransferWithRelations extends InventoryTransferRow {
  sender_profile?: FriendProfileRow | null;
  recipient_profile?: FriendProfileRow | null;
  book_details?: (PlayerSkillBookRow & { skill_books: SkillBookRow | null }) | null;
}

export interface TransferInventoryItemsParams {
  senderProfileId: string;
  recipientProfileId: string;
  itemIds: string[];
  inventoryTable?: "player_equipment";
}

export const transferInventoryItems = async ({
  senderProfileId,
  recipientProfileId,
  itemIds,
  inventoryTable = "player_equipment", // Use existing table
}: TransferInventoryItemsParams): Promise<string[]> => {
  const { data, error } = await supabase.rpc("transfer_inventory_items", {
    p_sender_profile_id: senderProfileId,
    p_recipient_profile_id: recipientProfileId,
    p_inventory_table: inventoryTable,
    p_item_ids: itemIds,
  });

  if (error) {
    throw error;
  }

  return (data as string[] | null) ?? [];
};

export const acknowledgeInventoryTransfer = async (
  transferId: string,
  recipientProfileId: string,
): Promise<InventoryTransferRow> => {
  const { data, error } = await supabase.rpc("acknowledge_inventory_transfer", {
    p_transfer_id: transferId,
    p_recipient_profile_id: recipientProfileId,
  });

  if (error) {
    throw error;
  }

  return data as InventoryTransferRow;
};

export const fetchInventoryTransfersForProfile = async (
  profileId: string,
): Promise<InventoryTransferWithRelations[]> => {
  const { data, error } = await supabase
    .from("inventory_transfers")
    .select(
      `*,
      sender_profile:sender_profile_id (id, display_name, username, level, fame, bio),
      recipient_profile:recipient_profile_id (id, display_name, username, level, fame, bio)`,
    )
    .or(`sender_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data as any ?? []) as InventoryTransferWithRelations[];

  const recipientBookIds = rows
    .filter((row) => row.item_table === "player_skill_books" && row.recipient_profile_id === profileId)
    .map((row) => row.item_id);

  let bookDetails: (PlayerSkillBookRow & { skill_books: SkillBookRow | null })[] = [];

  // Skip book details lookup for now since tables don't exist
  if (recipientBookIds.length > 0) {
    bookDetails = [];
  }

  const bookLookup = bookDetails.reduce<Record<string, PlayerSkillBookRow & { skill_books: SkillBookRow | null }>>(
    (accumulator, book) => {
      accumulator[book.id] = book;
      return accumulator;
    },
    {},
  );

  return rows.map((row) => ({
    ...row,
    book_details: row.item_table === "player_skill_books" ? bookLookup[row.item_id] ?? null : null,
  }));
};

export const extractInventorySummary = (row: InventoryTransferWithRelations): string => {
  if (row.item_table === "player_skill_books") {
    const snapshot = row.item_snapshot as Record<string, unknown> | null;
    const titleFromSnapshot =
      snapshot && typeof snapshot["title"] === "string" ? (snapshot["title"] as string) : undefined;
    const title = row.book_details?.skill_books?.title ?? titleFromSnapshot;
    return title ? `${title} (Skill Book)` : "Skill book";
  }

  return row.item_table.replace(/_/g, " ");
};
