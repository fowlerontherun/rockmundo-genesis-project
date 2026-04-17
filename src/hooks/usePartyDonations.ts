import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface PartyDonation {
  id: string;
  party_id: string;
  donor_profile_id: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export function usePartyDonations(partyId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["party-donations", partyId, limit],
    queryFn: async () => {
      if (!partyId) return [];
      const { data, error } = await supabase
        .from("party_donations")
        .select("*")
        .eq("party_id", partyId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      const rows = (data ?? []) as PartyDonation[];
      const donorIds = Array.from(new Set(rows.map((r) => r.donor_profile_id)));
      if (donorIds.length === 0) return rows.map((r) => ({ ...r, donor: null }));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", donorIds);
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return rows.map((r) => ({ ...r, donor: map.get(r.donor_profile_id) ?? null }));
    },
    enabled: !!partyId,
  });
}

export function useDonateToParty() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (input: { party_id: string; amount_cents: number; note?: string }) => {
      if (!profileId) throw new Error("Sign in first");
      if (input.amount_cents <= 0) throw new Error("Donation must be positive");

      const { data, error } = await supabase.rpc("donate_to_party", {
        p_party_id: input.party_id,
        p_amount: input.amount_cents,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_, vars) => {
      toast.success("Donation sent — thank you!");
      queryClient.invalidateQueries({ queryKey: ["party-donations", vars.party_id] });
      queryClient.invalidateQueries({ queryKey: ["political-party", vars.party_id] });
      queryClient.invalidateQueries({ queryKey: ["my-party"] });
      queryClient.invalidateQueries({ queryKey: ["political-parties"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["activeProfile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
