import { supabase } from "@/integrations/supabase/client";
import {
  fetchFriendshipsForProfile,
  fetchProfilesByIds,
  updateFriendshipStatus,
  sendFriendRequest,
  deleteFriendship,
  searchProfilesByQuery,
} from "@/integrations/supabase/friends";
import type { Database } from "@/lib/supabase-types";
import type {
  DecoratedFriendship,
  RelationshipEvent,
  DirectMessage,
  ProfileRow,
} from "./types";
import { RELATIONSHIP_EVENT_WEIGHTS, RELATIONSHIP_MILESTONES, FRIENDSHIP_TIERS } from "./config";

export type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];

const RELATIONSHIP_METADATA_KEY = "relationship_profile_id";
const RELATIONSHIP_PAIR_KEY = "relationship_pair_key";

export async function loadFriendships(profileId: string): Promise<DecoratedFriendship[]> {
  const friendships = await fetchFriendshipsForProfile(profileId);
  if (friendships.length === 0) {
    return [];
  }

  const relatedProfileIds = new Set<string>();
  friendships.forEach((friendship) => {
    relatedProfileIds.add(friendship.requestor_id);
    relatedProfileIds.add(friendship.addressee_id);
  });
  relatedProfileIds.delete(profileId);

  const profileMap = await fetchProfilesByIds(Array.from(relatedProfileIds));

  return friendships.map((friendship) => {
    const isRequester = friendship.requestor_id === profileId;
    const otherProfileId = isRequester ? friendship.addressee_id : friendship.requestor_id;
    return {
      friendship,
      otherProfile: profileMap[otherProfileId] ?? null,
      isRequester,
    } satisfies DecoratedFriendship;
  });
}

export async function respondToFriendship(
  friendshipId: string,
  status: Exclude<FriendshipStatus, "pending">,
): Promise<void> {
  await updateFriendshipStatus(friendshipId, status);
}

export async function cancelFriendship(friendshipId: string): Promise<void> {
  await deleteFriendship(friendshipId);
}

export async function createFriendRequest(requestorProfileId: string, targetProfileId: string) {
  return sendFriendRequest({ requestorProfileId, addresseeProfileId: targetProfileId });
}

export async function searchProfiles(query: string, excludeProfileIds: string[] = []) {
  return searchProfilesByQuery(query, excludeProfileIds);
}

const buildPairKey = (profileId: string, otherProfileId: string) =>
  [profileId, otherProfileId].sort().join(":");

interface RecordRelationshipEventInput {
  userId: string;
  profileId: string;
  otherProfileId: string;
  otherUserId?: string | null;
  activityType: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function recordRelationshipEvent({
  userId,
  profileId,
  otherProfileId,
  otherUserId,
  activityType,
  message,
  metadata,
}: RecordRelationshipEventInput): Promise<void> {
  if (!userId || !profileId || !otherProfileId) {
    throw new Error("Missing identifiers for relationship event");
  }

  const affinityValue = RELATIONSHIP_EVENT_WEIGHTS[activityType] ?? 5;
  const payload: Database["public"]["Tables"]["activity_feed"]["Insert"] = {
    user_id: userId,
    activity_type: activityType,
    message,
    metadata: {
      [RELATIONSHIP_METADATA_KEY]: otherProfileId,
      [RELATIONSHIP_PAIR_KEY]: buildPairKey(profileId, otherProfileId),
      other_profile_user_id: otherUserId ?? null,
      affinity_value: affinityValue,
      ...metadata,
    },
  };

  const { error } = await supabase.from("activity_feed").insert(payload);
  if (error) {
    throw error;
  }
}

interface FetchRelationshipEventsOptions {
  profileId: string;
  otherProfileId: string;
  userIds: string[];
  limit?: number;
}

export async function fetchRelationshipEvents({
  profileId,
  otherProfileId,
  userIds,
  limit = 75,
}: FetchRelationshipEventsOptions): Promise<RelationshipEvent[]> {
  if (!profileId || !otherProfileId || userIds.length === 0) {
    return [];
  }

  const pairKey = buildPairKey(profileId, otherProfileId);
  const { data, error } = await supabase
    .from("activity_feed")
    .select("id, user_id, activity_type, message, metadata, created_at")
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  if (error) {
    if (error.code === "42501" || error.code === "P0001") {
      // RLS rejection when attempting to read the friend's activity feed; retry with current user only
      const fallback = await supabase
        .from("activity_feed")
        .select("id, user_id, activity_type, message, metadata, created_at")
        .eq("user_id", userIds[0])
        .order("created_at", { ascending: false })
        .limit(limit * 2);

      if (fallback.error) {
        throw fallback.error;
      }

      return filterRelationshipEvents(fallback.data ?? [], otherProfileId, pairKey, limit);
    }

    throw error;
  }

  return filterRelationshipEvents(data ?? [], otherProfileId, pairKey, limit);
}

function filterRelationshipEvents(
  rows: Array<{ 
    activity_type: string; 
    created_at: string; 
    id: string; 
    message: string; 
    metadata: any; 
    user_id: string;
  }>,
  otherProfileId: string,
  pairKey: string,
  limit: number,
): RelationshipEvent[] {
  const filtered = rows
    .map((row) => ({
      id: row.id,
      activityType: row.activity_type,
      message: row.message,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      userId: row.user_id,
      createdAt: row.created_at ?? new Date().toISOString(),
    }))
    .filter((event) => {
      const metadata = event.metadata ?? {};
      const targetProfileId = (metadata as { [key: string]: unknown })[RELATIONSHIP_METADATA_KEY];
      const targetPairKey = (metadata as { [key: string]: unknown })[RELATIONSHIP_PAIR_KEY];
      return targetProfileId === otherProfileId || targetPairKey === pairKey;
    })
    .slice(0, limit);

  return filtered;
}

export function calculateRelationshipSummary(events: RelationshipEvent[]): {
  affinityScore: number;
  tierId: string;
  tierLabel: string;
  tierMinimum: number;
  tierMaximum: number | null;
  progressToNextTier: number;
  milestoneProgress: Array<{
    id: string;
    label: string;
    threshold: number;
    achieved: boolean;
  }>;
} {
  const affinityScore = events.reduce((total, event) => {
    const weight =
      (typeof event.metadata?.affinity_value === "number"
        ? event.metadata.affinity_value
        : RELATIONSHIP_EVENT_WEIGHTS[event.activityType]) ?? 0;
    return total + Number(weight);
  }, 0);

  const tier = [...FRIENDSHIP_TIERS].reverse().find((entry) => affinityScore >= entry.minAffinity) ?? FRIENDSHIP_TIERS[0];
  const nextTier = FRIENDSHIP_TIERS.find((entry) => entry.minAffinity > tier.minAffinity);
  let progressToNextTier = 1;

  if (nextTier) {
    const range = (nextTier.minAffinity - tier.minAffinity) || 1;
    progressToNextTier = Math.min(
      1,
      Math.max(0, (affinityScore - tier.minAffinity) / range),
    );
  }

  const milestoneProgress = RELATIONSHIP_MILESTONES.map((milestone) => ({
    id: milestone.id,
    label: milestone.label,
    threshold: milestone.threshold,
    achieved: affinityScore >= milestone.threshold,
  }));

  return {
    affinityScore,
    tierId: tier.id,
    tierLabel: tier.label,
    tierMinimum: tier.minAffinity,
    tierMaximum: tier.maxAffinity,
    progressToNextTier,
    milestoneProgress,
  };
}

export async function fetchDirectMessages(channel: string): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from("global_chat")
    .select("id, channel, message, created_at, user_id")
    .eq("channel", channel)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw error;
  }

  return (data ?? []) as DirectMessage[];
}

export async function sendDirectMessage(
  channel: string,
  userId: string,
  message: string,
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) {
    return;
  }

  const { error } = await supabase.from("global_chat").insert({
    channel,
    user_id: userId,
    message: trimmed,
  });

  if (error) {
    throw error;
  }
}

export function subscribeToDirectMessages(
  channel: string,
  onMessage: (message: DirectMessage) => void,
) {
  const subscription = supabase
    .channel(`relationship-dm:${channel}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "global_chat", filter: `channel=eq.${channel}` },
      (payload) => {
        onMessage(payload.new as DirectMessage);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}

export function resolveRelationshipPairKey(profileId: string, otherProfileId: string) {
  return buildPairKey(profileId, otherProfileId);
}

export async function upsertPermissionSettings(
  profileId: string,
  otherProfileId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  // Persist settings using the activity feed so we can reference history without a dedicated table.
  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const userId = profileRow?.user_id;
  if (!userId) {
    throw new Error("Unable to resolve user id for profile");
  }

  await recordRelationshipEvent({
    userId,
    profileId,
    otherProfileId,
    activityType: "relationship_permission_update",
    message: "Updated trust permissions",
    metadata: { permissions: settings },
  });
}

export async function fetchPermissionHistory(
  profileId: string,
  otherProfileId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("activity_feed")
    .select("metadata")
    .eq("user_id", userId)
    .eq("activity_type", "relationship_permission_update")
    .contains("metadata", { [RELATIONSHIP_METADATA_KEY]: otherProfileId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const metadata = (data?.metadata as Record<string, unknown> | null) ?? null;
  if (!metadata) {
    return null;
  }

  const permissions = (metadata as { permissions?: unknown }).permissions;
  if (!permissions || typeof permissions !== "object") {
    return null;
  }

  return permissions as Record<string, unknown>;
}

export async function fetchBandMemberships(profileId: string): Promise<Array<{
  band_id: string;
  role: string | null;
  bands: { id: string; name: string | null; genre: string | null; fame: number | null } | null;
}>> {
  // Use untyped client to avoid type instantiation depth issues
  const { data, error }: { data: any; error: any } = await (supabase as any)
    .from("band_members")
    .select("band_id, role, bands!band_members_band_id_fkey(id, name, genre, fame)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchActivityFeedForProfile(profileId: string, limit = 30) {
  const profile = await fetchProfileById(profileId);

  if (!profile?.user_id) {
    return [];
  }

  const { data, error } = await supabase
    .from("activity_feed")
    .select("id, activity_type, message, metadata, created_at")
    .eq("user_id", profile.user_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchProfileById(profileId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, username, display_name, bio, fame, fans, level, age, cash, current_city_id, avatar_url")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProfileRow | null) ?? null;
}

