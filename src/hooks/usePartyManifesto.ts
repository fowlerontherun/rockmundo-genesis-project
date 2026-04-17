import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface ManifestoPlank {
  id: string;
  party_id: string;
  topic: string;
  position: string;
  details: string | null;
  position_order: number;
  created_by_profile_id: string;
  created_at: string;
  updated_at: string;
}

export const MANIFESTO_TOPICS = [
  "Taxes",
  "Nightlife & Curfew",
  "Drug Policy",
  "Music & Culture",
  "Venues & Permits",
  "Housing",
  "Public Safety",
  "Education",
  "Tourism",
  "Industry & Jobs",
  "Environment",
  "Other",
] as const;

export const MAX_PLANKS = 12;

export function usePartyManifesto(partyId: string | undefined) {
  return useQuery({
    queryKey: ["party-manifesto", partyId],
    queryFn: async (): Promise<ManifestoPlank[]> => {
      if (!partyId) return [];
      const { data, error } = await supabase
        .from("party_manifestos")
        .select("*")
        .eq("party_id", partyId)
        .order("position_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ManifestoPlank[];
    },
    enabled: !!partyId,
  });
}

export function useAddPlank() {
  const qc = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (input: {
      party_id: string;
      topic: string;
      position: string;
      details?: string;
      position_order: number;
    }) => {
      if (!profileId) throw new Error("Sign in first");
      const { error } = await supabase.from("party_manifestos").insert({
        party_id: input.party_id,
        topic: input.topic,
        position: input.position,
        details: input.details ?? null,
        position_order: input.position_order,
        created_by_profile_id: profileId,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Plank added to manifesto");
      qc.invalidateQueries({ queryKey: ["party-manifesto", vars.party_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePlank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; party_id: string }) => {
      const { error } = await supabase.from("party_manifestos").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success("Plank removed");
      qc.invalidateQueries({ queryKey: ["party-manifesto", vars.party_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
