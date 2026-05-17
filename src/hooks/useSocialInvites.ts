import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SocialInviteKind =
  | "gig"
  | "recording"
  | "jam"
  | "songwriting"
  | "meetup"
  | "date";

export type SocialInviteStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled";

export interface SocialInviteRow {
  id: string;
  from_profile_id: string;
  to_profile_id: string;
  kind: SocialInviteKind;
  ref_id: string | null;
  scheduled_at: string | null;
  location_city_id: string | null;
  message: string | null;
  status: SocialInviteStatus;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export const INVITE_KIND_LABELS: Record<SocialInviteKind, string> = {
  gig: "Gig",
  recording: "Recording Session",
  jam: "Jam Session",
  songwriting: "Songwriting Session",
  meetup: "Meet up",
  date: "Date",
};

export function useIncomingInvites(profileId?: string | null) {
  return useQuery({
    queryKey: ["social-invites-in", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<SocialInviteRow[]> => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("social_invites")
        .select("*")
        .eq("to_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SocialInviteRow[];
    },
  });
}

export function useOutgoingInvites(profileId?: string | null) {
  return useQuery({
    queryKey: ["social-invites-out", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<SocialInviteRow[]> => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("social_invites")
        .select("*")
        .eq("from_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SocialInviteRow[];
    },
  });
}

export function useInviteRealtime(profileId?: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`invites-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "social_invites" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["social-invites-in", profileId] });
          queryClient.invalidateQueries({ queryKey: ["social-invites-out", profileId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, queryClient]);
}

export interface CreateInviteInput {
  from_profile_id: string;
  to_profile_id: string;
  kind: SocialInviteKind;
  scheduled_at?: string | null;
  location_city_id?: string | null;
  ref_id?: string | null;
  message?: string | null;
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInviteInput) => {
      const { data, error } = await (supabase as any)
        .from("social_invites")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return data as SocialInviteRow;
    },
    onSuccess: (row) => {
      toast.success(`${INVITE_KIND_LABELS[row.kind]} invite sent`);
      queryClient.invalidateQueries({ queryKey: ["social-invites-out", row.from_profile_id] });
    },
    onError: (error: Error) => {
      toast.error(error.message ?? "Failed to send invite");
    },
  });
}

export function useRespondInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: SocialInviteStatus }) => {
      const { error } = await (supabase as any)
        .from("social_invites")
        .update({ status: params.status, responded_at: new Date().toISOString() })
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-invites-in"] });
      queryClient.invalidateQueries({ queryKey: ["social-invites-out"] });
    },
  });
}
