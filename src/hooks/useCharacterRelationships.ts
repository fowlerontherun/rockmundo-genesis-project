// Unified Character Relationship System Hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import type {
  CharacterRelationship,
  CreateRelationshipInput,
  UpdateRelationshipScoresInput,
  LogInteractionInput,
  RelationshipInteraction,
  RelationshipThresholdEvent,
  RelationshipEntityType,
} from "@/types/character-relationships";
import { RELATIONSHIP_THRESHOLDS } from "@/types/character-relationships";
import { asAny } from "@/lib/type-helpers";

const QUERY_KEY = "character-relationships";

// ─── Helpers ─────────────────────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Check if a threshold was crossed and return events to log
 */
function detectThresholdEvents(
  relationshipId: string,
  oldScores: Record<string, number>,
  newScores: Record<string, number>,
): Array<Omit<RelationshipThresholdEvent, 'id' | 'created_at'>> {
  const events: Array<Omit<RelationshipThresholdEvent, 'id' | 'created_at'>> = [];

  for (const def of Object.values(RELATIONSHIP_THRESHOLDS)) {
    const oldVal = oldScores[def.score] ?? 0;
    const newVal = newScores[def.score] ?? 0;

    const crossed =
      (def.direction === 'up' && oldVal < def.threshold && newVal >= def.threshold) ||
      (def.direction === 'down' && oldVal > def.threshold && newVal <= def.threshold) ||
      (def.direction === 'cross' && ((oldVal < def.threshold && newVal >= def.threshold) || (oldVal > def.threshold && newVal <= def.threshold)));

    if (crossed) {
      events.push({
        relationship_id: relationshipId,
        event_type: 'threshold_crossed',
        event_key: def.event_key,
        score_name: def.score,
        old_value: oldVal,
        new_value: newVal,
        threshold: def.threshold,
        message: `${def.score} crossed ${def.threshold} (${oldVal} → ${newVal})`,
        processed: false,
      });
    }
  }

  return events;
}

// ─── Fetch All Relationships ─────────────────────────────

export const useCharacterRelationships = (entityBType?: RelationshipEntityType) => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: [QUERY_KEY, profileId, entityBType],
    queryFn: async () => {
      let query = supabase
        .from("character_relationships")
        .select("*")
        .eq("entity_a_id", profileId!)
        .order("last_interaction_at", { ascending: false });

      if (entityBType) {
        query = query.eq("entity_b_type", entityBType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as CharacterRelationship[];
    },
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 2,
  });
};

// ─── Fetch Single Relationship ───────────────────────────

export const useCharacterRelationship = (entityBId: string | undefined, entityBType: RelationshipEntityType) => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: [QUERY_KEY, profileId, entityBId, entityBType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("character_relationships")
        .select("*")
        .eq("entity_a_id", profileId!)
        .eq("entity_b_id", entityBId!)
        .eq("entity_b_type", entityBType)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as CharacterRelationship | null;
    },
    enabled: !!user && !!profileId && !!entityBId,
    staleTime: 1000 * 60 * 2,
  });
};

// ─── Create Relationship ─────────────────────────────────

export const useCreateCharacterRelationship = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateRelationshipInput) => {
      const { data, error } = await supabase
        .from("character_relationships")
        .insert(asAny(input))
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CharacterRelationship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Update Relationship Scores ──────────────────────────

export const useUpdateCharacterRelationship = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      relationshipId,
      updates,
    }: {
      relationshipId: string;
      updates: UpdateRelationshipScoresInput;
    }) => {
      const { data, error } = await supabase
        .from("character_relationships")
        .update(asAny({ ...updates, last_interaction_at: new Date().toISOString() }))
        .eq("id", relationshipId)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as CharacterRelationship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Log Interaction (with threshold detection) ──────────

export const useLogInteraction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogInteractionInput) => {
      // 1. Fetch current relationship
      const { data: rel, error: relError } = await supabase
        .from("character_relationships")
        .select("*")
        .eq("id", input.relationship_id)
        .single();

      if (relError || !rel) throw relError ?? new Error("Relationship not found");

      const current = rel as unknown as CharacterRelationship;

      // 2. Calculate new scores
      const oldScores = {
        affection_score: current.affection_score,
        trust_score: current.trust_score,
        attraction_score: current.attraction_score,
        loyalty_score: current.loyalty_score,
        jealousy_score: current.jealousy_score,
      };

      const newScores = {
        affection_score: clamp(oldScores.affection_score + (input.affection_change ?? 0), -100, 100),
        trust_score: clamp(oldScores.trust_score + (input.trust_change ?? 0), 0, 100),
        attraction_score: clamp(oldScores.attraction_score + (input.attraction_change ?? 0), 0, 100),
        loyalty_score: clamp(oldScores.loyalty_score + (input.loyalty_change ?? 0), 0, 100),
        jealousy_score: clamp(oldScores.jealousy_score + (input.jealousy_change ?? 0), 0, 100),
      };

      // 3. Update relationship
      const { error: updateError } = await supabase
        .from("character_relationships")
        .update(asAny({ ...newScores, last_interaction_at: new Date().toISOString() }))
        .eq("id", input.relationship_id);

      if (updateError) throw updateError;

      // 4. Insert interaction log
      const { error: logError } = await supabase
        .from("relationship_interactions")
        .insert(asAny({
          relationship_id: input.relationship_id,
          interaction_type: input.interaction_type,
          description: input.description ?? null,
          affection_change: input.affection_change ?? 0,
          trust_change: input.trust_change ?? 0,
          attraction_change: input.attraction_change ?? 0,
          loyalty_change: input.loyalty_change ?? 0,
          jealousy_change: input.jealousy_change ?? 0,
          initiated_by: input.initiated_by ?? null,
          context_type: input.context_type ?? null,
          context_id: input.context_id ?? null,
        }));

      if (logError) throw logError;

      // 5. Detect threshold events
      const events = detectThresholdEvents(input.relationship_id, oldScores, newScores);
      if (events.length > 0) {
        await supabase.from("relationship_events").insert(asAny(events));
      }

      return { newScores, events };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Fetch Interaction History ───────────────────────────

export const useRelationshipInteractions = (relationshipId: string | undefined) => {
  return useQuery({
    queryKey: [QUERY_KEY, "interactions", relationshipId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relationship_interactions")
        .select("*")
        .eq("relationship_id", relationshipId!)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as RelationshipInteraction[];
    },
    enabled: !!relationshipId,
    staleTime: 1000 * 60,
  });
};

// ─── Fetch Unprocessed Events ────────────────────────────

export const useUnprocessedRelationshipEvents = () => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: [QUERY_KEY, "events", profileId],
    queryFn: async () => {
      const { data: rels } = await supabase
        .from("character_relationships")
        .select("id")
        .eq("entity_a_id", profileId!);

      if (!rels?.length) return [];

      const relIds = rels.map((r: any) => r.id);

      const { data, error } = await supabase
        .from("relationship_events")
        .select("*")
        .in("relationship_id", relIds)
        .eq("processed", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as RelationshipThresholdEvent[];
    },
    enabled: !!user && !!profileId,
    staleTime: 1000 * 30,
  });
};

// ─── Get or Create Relationship ──────────────────────────

export const useGetOrCreateCharacterRelationship = () => {
  const createRel = useCreateCharacterRelationship();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  const getOrCreate = async (
    entityBId: string,
    entityBType: RelationshipEntityType,
    entityBName: string,
    initialScores?: Partial<CreateRelationshipInput>,
  ): Promise<CharacterRelationship | null> => {
    if (!profileId) return null;

    const { data } = await supabase
      .from("character_relationships")
      .select("*")
      .eq("entity_a_id", profileId)
      .eq("entity_b_id", entityBId)
      .eq("entity_b_type", entityBType)
      .maybeSingle();

    if (data) return data as unknown as CharacterRelationship;

    return createRel.mutateAsync({
      entity_a_id: profileId,
      entity_b_id: entityBId,
      entity_b_type: entityBType,
      entity_b_name: entityBName,
      ...initialScores,
    });
  };

  return { getOrCreate, isPending: createRel.isPending };
};
