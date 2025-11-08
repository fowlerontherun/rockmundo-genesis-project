import type { Database } from "@/lib/supabase-types";

export type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ActivityFeedRow = Database["public"]["Tables"]["activity_feed"]["Row"];
export type GlobalChatRow = Database["public"]["Tables"]["global_chat"]["Row"];

export interface DecoratedFriendship {
  friendship: FriendshipRow;
  otherProfile: ProfileRow | null;
  isRequester: boolean;
}

export interface RelationshipEvent {
  id: string;
  activityType: string;
  message: string;
  createdAt: string;
  userId: string;
  metadata: Record<string, unknown> | null;
}

export interface RelationshipSummary {
  affinityScore: number;
  tierId: string;
  tierLabel: string;
  tierMinimum: number;
  tierMaximum: number | null;
  progressToNextTier: number;
  events: RelationshipEvent[];
  milestoneProgress: Array<{
    id: string;
    label: string;
    threshold: number;
    achieved: boolean;
  }>;
}

export interface DirectMessage {
  id: string;
  channel: string | null;
  message: string;
  created_at: string | null;
  user_id: string;
}

export interface RelationshipPermissionSetting {
  level: string;
  allowProfilePeek: boolean;
  allowTrading: boolean;
  allowSharedAssets: boolean;
}

