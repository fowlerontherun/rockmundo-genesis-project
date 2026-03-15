import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { asAny } from "@/lib/type-helpers";
import { toast } from "sonner";

export interface Marriage {
  id: string;
  partner_a_id: string;
  partner_b_id: string;
  status: string;
  proposed_at: string | null;
  wedding_date: string | null;
  started_at: string | null;
  ended_at: string | null;
  ended_by: string | null;
  end_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PartnerProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  fame: number;
  level: number;
}

export function useMarriageStatus(profileId: string | undefined) {
  return useQuery({
    queryKey: ["marriage-status", profileId],
    queryFn: async (): Promise<Marriage | null> => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from(asAny("marriages"))
        .select("*")
        .or(`partner_a_id.eq.${profileId},partner_b_id.eq.${profileId}`)
        .in("status", ["proposed", "accepted", "active"])
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Marriage | null;
    },
    enabled: !!profileId,
  });
}

export function usePartnerProfile(partnerId: string | undefined) {
  return useQuery({
    queryKey: ["partner-profile", partnerId],
    queryFn: async (): Promise<PartnerProfile | null> => {
      if (!partnerId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, fame, level")
        .eq("id", partnerId)
        .maybeSingle();
      if (error) throw error;
      return data as PartnerProfile | null;
    },
    enabled: !!partnerId,
  });
}

export function useMarriageHistory(profileId: string | undefined) {
  return useQuery({
    queryKey: ["marriage-history", profileId],
    queryFn: async (): Promise<Marriage[]> => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from(asAny("marriages"))
        .select("*")
        .or(`partner_a_id.eq.${profileId},partner_b_id.eq.${profileId}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Marriage[];
    },
    enabled: !!profileId,
  });
}

export function useProposeMarriage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ partnerAId, partnerBId, weddingDate }: {
      partnerAId: string;
      partnerBId: string;
      weddingDate?: string;
    }) => {
      const { data, error } = await supabase
        .from(asAny("marriages"))
        .insert(asAny({
          partner_a_id: partnerAId,
          partner_b_id: partnerBId,
          status: "proposed",
          proposed_at: new Date().toISOString(),
          wedding_date: weddingDate ?? null,
        }))
        .select()
        .single();
      if (error) throw error;

      // Post activity feed entry
      if (user?.id) {
        await supabase.from("activity_feed").insert({
          user_id: user.id,
          activity_type: "marriage_proposal",
          message: "💍 Proposed marriage!",
          metadata: { marriage_id: (data as any)?.id },
        });
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Marriage proposal sent! 💍");
      queryClient.invalidateQueries({ queryKey: ["marriage-status"] });
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to propose");
    },
  });
}

export function useRespondToProposal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ marriageId, accept }: { marriageId: string; accept: boolean }) => {
      const updates = accept
        ? { status: "active", started_at: new Date().toISOString() }
        : { status: "divorced", ended_at: new Date().toISOString(), end_reason: "proposal_declined" };

      const { error } = await supabase
        .from(asAny("marriages"))
        .update(asAny(updates))
        .eq("id", marriageId);
      if (error) throw error;

      // Post activity feed
      if (user?.id && accept) {
        await supabase.from("activity_feed").insert({
          user_id: user.id,
          activity_type: "marriage",
          message: "💒 Got married!",
          metadata: { marriage_id: marriageId },
        });
      }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.accept ? "You're married! 💒" : "Proposal declined");
      queryClient.invalidateQueries({ queryKey: ["marriage-status"] });
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to respond to proposal");
    },
  });
}

export function useInitiateDivorce() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ marriageId, profileId }: { marriageId: string; profileId: string }) => {
      const { error } = await supabase
        .from(asAny("marriages"))
        .update(asAny({
          status: "divorced",
          ended_at: new Date().toISOString(),
          ended_by: profileId,
          end_reason: "divorce",
        }))
        .eq("id", marriageId);
      if (error) throw error;

      if (user?.id) {
        await supabase.from("activity_feed").insert({
          user_id: user.id,
          activity_type: "divorce",
          message: "📝 Filed for divorce",
          metadata: { marriage_id: marriageId },
        });
      }
    },
    onSuccess: () => {
      toast.info("Divorce finalized");
      queryClient.invalidateQueries({ queryKey: ["marriage-status"] });
      queryClient.invalidateQueries({ queryKey: ["marriage-history"] });
      queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to initiate divorce");
    },
  });
}
