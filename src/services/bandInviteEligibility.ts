import type { PublicProfileSearchResult } from "@/services/publicProfileSearch";

interface BandInviteContext {
  inviterProfileId: string;
  inviterAccountId?: string | null;
  memberUserIds: ReadonlySet<string>;
  pendingUserIds: ReadonlySet<string>;
}

/**
 * Helpful UI hints only. The send_band_invitation RPC remains the authority
 * for band permissions, profile privacy, blocking, capacity and membership.
 */
export function bandInviteUnavailability(
  player: PublicProfileSearchResult,
  context: BandInviteContext,
): string | null {
  if (player.id === context.inviterProfileId || (context.inviterAccountId && player.user_id === context.inviterAccountId)) {
    return "Your own character";
  }
  if (context.memberUserIds.has(player.user_id)) return "Already a band member";
  if (context.pendingUserIds.has(player.user_id)) return "Invitation pending";
  if (player.bands.length > 0) return "Already in another band";
  return null;
}
