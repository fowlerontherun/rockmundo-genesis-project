import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NominatableBand {
  id: string;
  name: string;
  genre: string | null;
  fame: number | null;
  popularity: number | null;
}

/** Search every active band in the world so players can nominate anyone. */
export const useNominatableBands = (search: string) => {
  const term = search.trim();

  return useQuery({
    queryKey: ["nominatable-bands", term],
    queryFn: async (): Promise<NominatableBand[]> => {
      let query = (supabase as any)
        .from("bands")
        .select("id, name, genre, fame, popularity")
        .eq("status", "active")
        .order("fame", { ascending: false })
        .limit(40);

      if (term.length > 0) {
        query = query.ilike("name", `%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as NominatableBand[];
    },
    staleTime: 30 * 1000,
  });
};

export interface AwardShowInviteRow {
  id: string;
  award_show_id: string;
  invite_type: string;
  invitee_band_id: string | null;
  invitee_user_id: string | null;
  category_name: string | null;
  slot_label: string | null;
  stage: string | null;
  performance_fee: number;
  message: string | null;
  response_status: string;
  created_at: string;
  bands?: { name: string } | null;
}

export const useAwardShowInvites = (showId?: string) =>
  useQuery({
    queryKey: ["award-show-invites", showId ?? "all"],
    queryFn: async (): Promise<AwardShowInviteRow[]> => {
      let query = (supabase as any)
        .from("award_show_invites")
        .select("*, bands:invitee_band_id(name)")
        .order("created_at", { ascending: false });

      if (showId) query = query.eq("award_show_id", showId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AwardShowInviteRow[];
    },
  });

export const useInviteBandToPerform = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      award_show_id: string;
      band_id: string;
      invite_type?: "performer" | "presenter" | "attendee" | "nominee";
      slot_label?: string;
      stage?: string;
      performance_fee?: number;
      category_name?: string;
      message?: string;
    }) => {
      const { data, error } = await (supabase as any).rpc("award_show_invite_band", {
        p_award_show_id: input.award_show_id,
        p_band_id: input.band_id,
        p_invite_type: input.invite_type ?? "performer",
        p_slot_label: input.slot_label ?? null,
        p_stage: input.stage ?? null,
        p_performance_fee: Math.max(0, Math.round(input.performance_fee ?? 0)),
        p_category_name: input.category_name ?? null,
        p_message: input.message ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["award-show-invites"] });
      queryClient.invalidateQueries({ queryKey: ["award-invites"] });
      toast.success("Performance invitation sent");
    },
    onError: (error: any) => {
      toast.error("Failed to send invitation", { description: error.message });
    },
  });
};
