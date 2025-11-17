import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchFriendshipsForProfile,
  fetchProfilesByIds,
} from "@/integrations/supabase/friends";
import type { Database } from "@/lib/supabase-types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
// type MentorProfileRow = Database["public"]["Tables"]["community_mentorship_profiles"]["Row"];
type MentorProfileRow = any; // Table doesn't exist in current schema
type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];

type FriendRecommendation = Pick<
  ProfileRow,
  "id" | "username" | "display_name" | "bio" | "level" | "fame" | "avatar_url"
>;

type MentorRecommendation = MentorProfileRow & { profile: FriendRecommendation | null };

type CollaborationInvite = {
  friendship: FriendshipRow;
  requester: FriendRecommendation | null;
};

interface UseSocialOpportunitiesOptions {
  profileId: string | null | undefined;
  excludeProfileIds?: string[];
}

interface UseSocialOpportunitiesReturn {
  friendRecommendations: FriendRecommendation[];
  mentorRecommendations: MentorRecommendation[];
  collabInvites: CollaborationInvite[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const FRIEND_RECOMMENDATION_LIMIT = 3;
const MENTOR_RECOMMENDATION_LIMIT = 3;

export const useSocialOpportunities = ({
  profileId,
  excludeProfileIds = [],
}: UseSocialOpportunitiesOptions): UseSocialOpportunitiesReturn => {
  const [friendRecommendations, setFriendRecommendations] = useState<FriendRecommendation[]>([]);
  const [mentorRecommendations, setMentorRecommendations] = useState<MentorRecommendation[]>([]);
  const [collabInvites, setCollabInvites] = useState<CollaborationInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exclusionSignature = useMemo(() => {
    const uniqueIds = Array.from(new Set([...(excludeProfileIds ?? []), profileId ?? ""]));
    uniqueIds.sort();
    return uniqueIds.join(",");
  }, [excludeProfileIds, profileId]);

  const refetch = useCallback(async () => {
    if (!profileId) {
      setFriendRecommendations([]);
      setMentorRecommendations([]);
      setCollabInvites([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const exclusionSet = new Set([profileId, ...excludeProfileIds]);

    try {
      const [friendResponse, friendships] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, bio, level, fame, avatar_url")
          .order("fame", { ascending: false })
          .limit(20),
        fetchFriendshipsForProfile(profileId),
      ]);
      
      // Mentor profiles table doesn't exist in current schema
      const mentorResponse = { data: [], error: null } as any;

      if (friendResponse.error) {
        throw friendResponse.error;
      }

      if (mentorResponse.error) {
        throw mentorResponse.error;
      }

      const friendRows = ((friendResponse.data ?? []) as FriendRecommendation[]).filter(
        (profile) => !exclusionSet.has(profile.id),
      );
      setFriendRecommendations(friendRows.slice(0, FRIEND_RECOMMENDATION_LIMIT));

      const mentorRows = ((mentorResponse.data ?? []) as MentorRecommendation[]).filter(
        (mentor) => mentor.profile?.id !== profileId && mentor.profile !== null,
      );
      setMentorRecommendations(mentorRows.slice(0, MENTOR_RECOMMENDATION_LIMIT));

      const pendingIncoming = friendships.filter(
        (friendship) => friendship.status === "pending" && friendship.addressee_id === profileId,
      );

      if (pendingIncoming.length === 0) {
        setCollabInvites([]);
      } else {
        const requesterIds = Array.from(new Set(pendingIncoming.map((entry) => entry.requestor_id)));
        const requesterProfiles = await fetchProfilesByIds(requesterIds);
        const invites: CollaborationInvite[] = pendingIncoming.map((friendship) => ({
          friendship,
          requester: requesterProfiles[friendship.requestor_id] ?? null,
        }));
        invites.sort((a, b) => {
          const aDate = a.friendship.created_at ? new Date(a.friendship.created_at).getTime() : 0;
          const bDate = b.friendship.created_at ? new Date(b.friendship.created_at).getTime() : 0;
          return bDate - aDate;
        });
        setCollabInvites(invites.slice(0, 3));
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to load social opportunities right now.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [profileId, exclusionSignature]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    friendRecommendations,
    mentorRecommendations,
    collabInvites,
    loading,
    error,
    refetch,
  };
};
