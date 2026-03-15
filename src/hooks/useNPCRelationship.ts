import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export interface NPCRelationship {
  id: string;
  profile_id: string;
  npc_id: string;
  npc_name: string;
  npc_type: string;
  affinity_score: number;
  trust_score: number;
  respect_score: number;
  relationship_stage: string;
  interaction_count: number;
  last_interaction_at: string | null;
}

export function useNPCRelationship(npcId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: relationship, isLoading } = useQuery({
    queryKey: ["npc-relationship", npcId, user?.id],
    queryFn: async () => {
      if (!user?.id || !npcId) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!profile) return null;

      const { data } = await supabase
        .from("npc_relationships")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("npc_id", npcId)
        .maybeSingle();
      return (data as NPCRelationship) ?? null;
    },
    enabled: !!user?.id && !!npcId,
  });

  const updateRelationship = useMutation({
    mutationFn: async ({
      npcName,
      npcType,
      affinityDelta,
      trustDelta,
      respectDelta,
    }: {
      npcName: string;
      npcType: string;
      affinityDelta?: number;
      trustDelta?: number;
      respectDelta?: number;
    }) => {
      if (!user?.id || !npcId) throw new Error("Missing data");
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!profile) throw new Error("Profile not found");

      if (relationship) {
        const { error } = await supabase
          .from("npc_relationships")
          .update({
            affinity_score: Math.max(0, Math.min(100, relationship.affinity_score + (affinityDelta ?? 0))),
            trust_score: Math.max(0, Math.min(100, relationship.trust_score + (trustDelta ?? 0))),
            respect_score: Math.max(0, Math.min(100, relationship.respect_score + (respectDelta ?? 0))),
            interaction_count: relationship.interaction_count + 1,
            last_interaction_at: new Date().toISOString(),
          })
          .eq("id", relationship.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("npc_relationships")
          .insert({
            profile_id: profile.id,
            npc_id: npcId,
            npc_name: npcName,
            npc_type: npcType,
            affinity_score: Math.max(0, affinityDelta ?? 10),
            trust_score: Math.max(0, trustDelta ?? 5),
            respect_score: Math.max(0, respectDelta ?? 5),
            interaction_count: 1,
            last_interaction_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["npc-relationship", npcId] });
    },
  });

  return {
    relationship,
    isLoading,
    updateRelationship: updateRelationship.mutate,
    isUpdating: updateRelationship.isPending,
  };
}
