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
  // A hiatus or disbanded membership need not prevent joining. Public search
  // exposes band names but not their active status; the guarded invite RPC is
  // authoritative about which other memberships are actually disqualifying.
  return null;
}

/** Mirrors the visible recruiter roles, never replaces server-side permission checks. */
export function canShowBandInvite(input: { isLeader: boolean; role?: string | null; bandStatus: string; isSoloArtist: boolean }): boolean {
  const recruiterRoles = new Set(["leader", "founder", "co-leader", "co_leader", "manager", "recruiter"]);
  return input.bandStatus === "active" && !input.isSoloArtist
    && (input.isLeader || recruiterRoles.has((input.role || "").toLowerCase()));
}
