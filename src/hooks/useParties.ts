import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { PoliticalParty, PartyMembership } from "@/types/political-party";

export function useParties() {
  return useQuery({
    queryKey: ["political-parties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("political_parties")
        .select("*")
        .is("dissolved_at", null)
        .order("total_strength", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PoliticalParty[];
    },
  });
}

export function useParty(partyId: string | undefined) {
  return useQuery({
    queryKey: ["political-party", partyId],
    queryFn: async () => {
      if (!partyId) return null;
      const { data, error } = await supabase
        .from("political_parties")
        .select("*")
        .eq("id", partyId)
        .maybeSingle();
      if (error) throw error;
      return data as PoliticalParty | null;
    },
    enabled: !!partyId,
  });
}

export function usePartyMembers(partyId: string | undefined) {
  return useQuery({
    queryKey: ["party-members", partyId],
    queryFn: async () => {
      if (!partyId) return [];
      const { data, error } = await supabase
        .from("party_memberships")
        .select("*")
        .eq("party_id", partyId)
        .order("joined_at", { ascending: true });
      if (error) throw error;

      const memberships = (data ?? []) as PartyMembership[];
      const profileIds = memberships.map((m) => m.profile_id);
      if (profileIds.length === 0) return memberships.map((m) => ({ ...m, profile: null }));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, fame")
        .in("id", profileIds);

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return memberships.map((m) => ({ ...m, profile: profileMap.get(m.profile_id) ?? null }));
    },
    enabled: !!partyId,
  });
}

export function useMyParty() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["my-party", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data: membership } = await supabase
        .from("party_memberships")
        .select("*, party:political_parties(*)")
        .eq("profile_id", profileId)
        .maybeSingle();
      return membership as (PartyMembership & { party: PoliticalParty }) | null;
    },
    enabled: !!profileId,
  });
}

export function useCreateParty() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description: string;
      colour_hex: string;
      logo_url?: string | null;
      beliefs: [string, string, string, string, string];
    }) => {
      if (!profileId) throw new Error("Sign in with an active character first");

      const { data, error } = await supabase
        .from("political_parties")
        .insert({
          founder_profile_id: profileId,
          name: input.name,
          description: input.description,
          colour_hex: input.colour_hex.toLowerCase(),
          logo_url: input.logo_url ?? null,
          belief_1: input.beliefs[0],
          belief_2: input.beliefs[1],
          belief_3: input.beliefs[2],
          belief_4: input.beliefs[3],
          belief_5: input.beliefs[4],
        })
        .select()
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new Error("That party name or colour is already taken");
        }
        throw error;
      }
      return data as PoliticalParty;
    },
    onSuccess: () => {
      toast.success("Party founded!");
      queryClient.invalidateQueries({ queryKey: ["political-parties"] });
      queryClient.invalidateQueries({ queryKey: ["my-party"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useJoinParty() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async (partyId: string) => {
      if (!profileId) throw new Error("Sign in first");
      const { error } = await supabase
        .from("party_memberships")
        .insert({ party_id: partyId, profile_id: profileId, role: "member" });
      if (error) {
        if (error.code === "23505") throw new Error("You're already in a party — leave first");
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Welcome to the party!");
      queryClient.invalidateQueries({ queryKey: ["my-party"] });
      queryClient.invalidateQueries({ queryKey: ["party-members"] });
      queryClient.invalidateQueries({ queryKey: ["political-parties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLeaveParty() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error("Sign in first");
      const { error } = await supabase
        .from("party_memberships")
        .delete()
        .eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You have left the party");
      queryClient.invalidateQueries({ queryKey: ["my-party"] });
      queryClient.invalidateQueries({ queryKey: ["party-members"] });
      queryClient.invalidateQueries({ queryKey: ["political-parties"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
