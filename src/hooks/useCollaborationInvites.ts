import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useActiveProfile } from "@/hooks/useActiveProfile";

type CollaborationStatus = Database["public"]["Enums"]["collaboration_status"];
type CompensationType = Database["public"]["Enums"]["collaboration_compensation_type"];

export interface Collaboration {
  id: string;
  project_id: string;
  inviter_user_id: string;
  invitee_profile_id: string;
  status: CollaborationStatus;
  is_band_member: boolean;
  compensation_type: CompensationType;
  flat_fee_amount: number | null;
  royalty_percentage: number | null;
  fee_paid: boolean;
  contribution_notes: string | null;
  invited_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  invitee_profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  inviter_profile?: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  project?: {
    id: string;
    title: string;
    genres: string[] | null;
    quality_score: number | null;
  };
}

interface InviteCollaboratorParams {
  projectId: string;
  inviteeProfileId: string;
  isBandMember: boolean;
  compensationType: CompensationType;
  flatFeeAmount?: number;
  royaltyPercentage?: number;
}

export const useCollaborationInvites = (projectId?: string) => {
  const queryClient = useQueryClient();
  const { profileId: activeProfileId } = useActiveProfile();

  // Fetch collaborators for a specific project
  const { data: collaborators, isLoading: loadingCollaborators } = useQuery({
    queryKey: ["project-collaborators", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from("songwriting_collaborations")
        .select(`
          *,
          invitee_profile:profiles!songwriting_collaborations_invitee_profile_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Collaboration[];
    },
    enabled: !!projectId,
  });

  // Fetch pending invitations for the current user (as invitee)
  const { data: pendingInvitations, isLoading: loadingInvitations } = useQuery({
    queryKey: ["pending-collaboration-invitations", activeProfileId],
    queryFn: async () => {
      if (!activeProfileId) return [];

      const { data, error } = await supabase
        .from("songwriting_collaborations")
        .select(`
          *,
          project:songwriting_projects (
            id,
            title,
            genres,
            quality_score
          )
        `)
        .eq("invitee_profile_id", activeProfileId)
        .eq("status", "pending")
        .order("invited_at", { ascending: false });

      if (error) throw error;

      const inviterUserIds = Array.from(
        new Set((data || []).map((invitation) => invitation.inviter_user_id)),
      );
      const { data: inviterProfiles, error: inviterProfilesError } = inviterUserIds.length
        ? await supabase
            .from("profiles")
            .select("id, user_id, username, avatar_url, is_active, died_at")
            .in("user_id", inviterUserIds)
            .eq("is_active", true)
            .is("died_at", null)
        : { data: [], error: null };

      if (inviterProfilesError) throw inviterProfilesError;

      const inviterByUserId = new Map(
        (inviterProfiles || []).map((inviter) => [inviter.user_id, inviter]),
      );

      return (data || []).map((invitation) => ({
        ...invitation,
        inviter_profile: inviterByUserId.get(invitation.inviter_user_id)
          ? {
              id: inviterByUserId.get(invitation.inviter_user_id)!.id,
              username: inviterByUserId.get(invitation.inviter_user_id)!.username,
              avatar_url: inviterByUserId.get(invitation.inviter_user_id)!.avatar_url,
            }
          : undefined,
      })) as Collaboration[];
    },
    enabled: !!activeProfileId,
  });

  // Invite a collaborator
  const inviteCollaborator = useMutation({
    mutationFn: async (params: InviteCollaboratorParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate against the currently selected character. The database
      // performs the authoritative balance check again when the invite is accepted.
      if (params.compensationType === "flat_fee" && params.flatFeeAmount) {
        if (!activeProfileId) throw new Error("Select a character before sending an invitation");

        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
          .eq("id", activeProfileId)
          .eq("user_id", user.id)
          .single();

        if (!profile || (profile.cash || 0) < params.flatFeeAmount) {
          throw new Error("Insufficient funds for flat fee offer");
        }
      }

      const { data, error } = await supabase
        .from("songwriting_collaborations")
        .insert({
          project_id: params.projectId,
          inviter_user_id: user.id,
          invitee_profile_id: params.inviteeProfileId,
          is_band_member: params.isBandMember,
          compensation_type: params.compensationType,
          flat_fee_amount: params.compensationType === "flat_fee" ? params.flatFeeAmount : null,
          royalty_percentage: params.compensationType === "royalty" ? params.royaltyPercentage : null,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-collaborators", projectId] });
      toast.success("Invitation sent!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  // Respond to an invitation (accept or decline).
  // The database trigger owns validation, flat-fee settlement, inbox cleanup,
  // and the response notification so the whole transition is atomic.
  const respondToInvitation = useMutation({
    mutationFn: async ({ collaborationId, accept }: { collaborationId: string; accept: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("songwriting_collaborations")
        .update({
          status: accept ? "accepted" : "declined",
          responded_at: new Date().toISOString(),
        })
        .eq("id", collaborationId)
        .eq("status", "pending")
        .select("id, status, fee_paid")
        .single();

      if (error) throw error;
      if (!data) throw new Error("Invitation is no longer pending");

      return { accepted: data.status === "accepted" };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pending-collaboration-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["project-collaborators"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["inbox-unread-count"] });
      toast.success(data.accepted ? "Invitation accepted!" : "Invitation declined");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to respond to invitation");
    },
  });

  // Cancel a pending invitation
  const cancelInvitation = useMutation({
    mutationFn: async (collaborationId: string) => {
      const { error } = await supabase
        .from("songwriting_collaborations")
        .delete()
        .eq("id", collaborationId)
        .eq("status", "pending");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-collaborators", projectId] });
      toast.success("Invitation cancelled");
    },
    onError: () => {
      toast.error("Failed to cancel invitation");
    },
  });

  return {
    collaborators,
    loadingCollaborators,
    pendingInvitations,
    loadingInvitations,
    inviteCollaborator,
    respondToInvitation,
    cancelInvitation,
  };
};

// Get accepted collaborators with royalty percentages for a project
export const getAcceptedRoyaltyCollaborators = async (projectId: string) => {
  const { data, error } = await supabase
    .from("songwriting_collaborations")
    .select(`
      *,
      invitee_profile:profiles!songwriting_collaborations_invitee_profile_id_fkey (
        id,
        username,
        user_id
      )
    `)
    .eq("project_id", projectId)
    .eq("status", "accepted")
    .eq("compensation_type", "royalty");

  if (error) throw error;
  return data;
};
