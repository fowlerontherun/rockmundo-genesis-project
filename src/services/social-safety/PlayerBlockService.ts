import { supabase } from "@/integrations/supabase/client";
import type { BlockReasonCategory } from "./config";

export interface BlockedPlayerSummary {
  blocked_profile_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  reason_category: BlockReasonCategory | null;
  private_note: string | null;
  created_at: string;
}

export interface BlockPlayerInput {
  targetProfileId: string;
  reasonCategory?: BlockReasonCategory | null;
  privateNote?: string | null;
}

export async function blockPlayer(input: BlockPlayerInput) {
  const { data, error } = await (supabase as any).rpc("block_profile", {
    target_profile_id: input.targetProfileId,
    note: input.privateNote?.trim() || null,
    reason_category: input.reasonCategory ?? null,
  });
  if (error) throw new Error(normalizeBlockError(error.message));
  return data;
}

export async function unblockPlayer(targetProfileId: string) {
  const { error } = await (supabase as any).rpc("unblock_profile", { target_profile_id: targetProfileId });
  if (error) throw new Error(normalizeBlockError(error.message));
}

export async function fetchBlockedPlayers(search = "", page = 0, pageSize = 20): Promise<BlockedPlayerSummary[]> {
  let query = (supabase as any)
    .from("social_profile_blocks")
    .select("blocked_profile_id, reason_category, private_note, created_at, profiles!social_profile_blocks_blocked_profile_id_fkey(username, display_name, avatar_url)")
    .is("removed_at", null)
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);

  if (search.trim()) {
    query = query.or(`profiles.username.ilike.%${search.trim()}%,profiles.display_name.ilike.%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Blocked players are unavailable right now.");
  return ((data ?? []) as any[]).map((row) => ({
    blocked_profile_id: row.blocked_profile_id,
    username: row.profiles?.username ?? "unknown",
    display_name: row.profiles?.display_name ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
    reason_category: row.reason_category ?? null,
    private_note: row.private_note ?? null,
    created_at: row.created_at,
  }));
}

function normalizeBlockError(message?: string) {
  if (!message) return "Safety settings are unavailable right now.";
  if (/another player|self|yourself/i.test(message)) return "Choose another player for this safety action.";
  if (/active profile|auth|jwt/i.test(message)) return "Sign in with an active player profile first.";
  return "This safety action could not be completed. Please try again.";
}
