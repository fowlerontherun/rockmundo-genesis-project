import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

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
    queryKey: ["pending-collaboration-invitations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // First get the user's profile id
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return [];

      const { data, error } = await supabase
        .from("songwriting_collaborations")
        .select(`
          *,
          project:songwriting_projects (
            id,
            title,
            genres,
            quality_score
          ),
          inviter_profile:profiles!songwriting_collaborations_inviter_user_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .eq("invitee_profile_id", profile.id)
        .eq("status", "pending")
        .order("invited_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Invite a collaborator
  const inviteCollaborator = useMutation({
    mutationFn: async (params: InviteCollaboratorParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validate flat fee - check if user has enough cash
      if (params.compensationType === "flat_fee" && params.flatFeeAmount) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cash")
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

  // Respond to an invitation (accept or decline)
  const respondToInvitation = useMutation({
    mutationFn: async ({ collaborationId, accept }: { collaborationId: string; accept: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the collaboration details
      const { data: collaboration, error: fetchError } = await supabase
        .from("songwriting_collaborations")
        .select("*")
        .eq("id", collaborationId)
        .single();

      if (fetchError) throw fetchError;

      // If accepting a flat fee offer, process the payment
      if (accept && collaboration.compensation_type === "flat_fee" && collaboration.flat_fee_amount) {
        // Get inviter's profile
        const { data: inviterProfile } = await supabase
          .from("profiles")
          .select("id, cash")
          .eq("user_id", collaboration.inviter_user_id)
          .single();

        if (!inviterProfile || (inviterProfile.cash || 0) < collaboration.flat_fee_amount) {
          throw new Error("Inviter has insufficient funds");
        }

        // Get invitee's profile (current user)
        const { data: inviteeProfile } = await supabase
          .from("profiles")
          .select("id, cash, user_id")
          .eq("id", collaboration.invitee_profile_id)
          .single();

        if (!inviteeProfile) throw new Error("Profile not found");

        // Deduct from inviter
        const { error: deductError } = await supabase
          .from("profiles")
          .update({ cash: (inviterProfile.cash || 0) - collaboration.flat_fee_amount })
          .eq("id", inviterProfile.id);

        if (deductError) throw deductError;

        // Add to invitee
        const { error: addError } = await supabase
          .from("profiles")
          .update({ cash: (inviteeProfile.cash || 0) + collaboration.flat_fee_amount })
          .eq("id", inviteeProfile.id);

        if (addError) throw addError;

        // Record the payment
        await supabase.from("collaboration_payments").insert({
          collaboration_id: collaborationId,
          payer_user_id: collaboration.inviter_user_id,
          payee_profile_id: collaboration.invitee_profile_id,
          amount: collaboration.flat_fee_amount,
          payment_type: "flat_fee",
        });

        // Update collaboration to mark fee as paid
        const { error: updateError } = await supabase
          .from("songwriting_collaborations")
          .update({
            status: "accepted",
            fee_paid: true,
            responded_at: new Date().toISOString(),
          })
          .eq("id", collaborationId);

        if (updateError) throw updateError;
      } else {
        // Just update status for royalty or band member invitations
        const { error: updateError } = await supabase
          .from("songwriting_collaborations")
          .update({
            status: accept ? "accepted" : "declined",
            responded_at: new Date().toISOString(),
          })
          .eq("id", collaborationId);

        if (updateError) throw updateError;
      }

      return { accepted: accept };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pending-collaboration-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["project-collaborators"] });
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
