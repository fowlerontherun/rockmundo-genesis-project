// Romantic Progression System Hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import { asAny } from "@/lib/type-helpers";
import type {
  RomanticRelationship,
  RomanticEvent,
  RomanceStage,
} from "@/types/romance-system";
import {
  ROMANCE_STAGES,
  canAdvanceStage,
  calculateRejectionConsequences,
  calculateAffairDetectionChance,
} from "@/types/romance-system";

const QUERY_KEY = "romantic-relationships";
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ─── Fetch All Romances ──────────────────────────────────

export const useRomanticRelationships = (activeOnly = true) => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: [QUERY_KEY, profileId, activeOnly],
    queryFn: async () => {
      let query = supabase
        .from("romantic_relationships")
        .select("*")
        .or(`partner_a_id.eq.${profileId},partner_b_id.eq.${profileId}`)
        .order("updated_at", { ascending: false });

      if (activeOnly) query = query.eq("is_active", true);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as RomanticRelationship[];
    },
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 2,
  });
};

// ─── Fetch Single Romance ────────────────────────────────

export const useRomanticRelationship = (romanceId: string | undefined) => {
  return useQuery({
    queryKey: [QUERY_KEY, "single", romanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("romantic_relationships")
        .select("*")
        .eq("id", romanceId!)
        .single();

      if (error) throw error;
      return data as unknown as RomanticRelationship;
    },
    enabled: !!romanceId,
  });
};

// ─── Start Romance ───────────────────────────────────────

export const useStartRomance = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: async (input: {
      partner_b_id: string;
      partner_b_type: 'player' | 'npc';
      partner_b_name: string;
      attraction_score?: number;
      compatibility_score?: number;
      is_secret?: boolean;
    }) => {
      if (!profileId) throw new Error("No profile");

      const { data, error } = await supabase
        .from("romantic_relationships")
        .insert(asAny({
          partner_a_id: profileId,
          partner_a_type: 'player',
          ...input,
          stage: input.is_secret ? 'secret_affair' : 'flirting',
          initiated_by: profileId,
        }))
        .select()
        .single();

      if (error) throw error;

      // Log the initial event
      await supabase.from("romantic_events").insert(asAny({
        romance_id: data.id,
        event_type: input.is_secret ? 'affair_started' : 'romance_started',
        new_stage: input.is_secret ? 'secret_affair' : 'flirting',
        description: input.is_secret
          ? `Started a secret affair with ${input.partner_b_name}`
          : `Started flirting with ${input.partner_b_name}`,
      }));

      return data as unknown as RomanticRelationship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Advance Stage ───────────────────────────────────────

export const useAdvanceRomanceStage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (romanceId: string) => {
      const { data: romance, error: fetchError } = await supabase
        .from("romantic_relationships")
        .select("*")
        .eq("id", romanceId)
        .single();

      if (fetchError || !romance) throw fetchError ?? new Error("Romance not found");

      const rel = romance as unknown as RomanticRelationship;
      const { canAdvance, nextStage, missingRequirements } = canAdvanceStage(rel);

      if (!canAdvance || !nextStage) {
        throw new Error(`Cannot advance: ${missingRequirements.join(', ')}`);
      }

      const stageDef = ROMANCE_STAGES.find(s => s.id === nextStage)!;

      // Update stage
      const { error: updateError } = await supabase
        .from("romantic_relationships")
        .update(asAny({
          stage: nextStage,
          stage_changed_at: new Date().toISOString(),
        }))
        .eq("id", romanceId);

      if (updateError) throw updateError;

      // Log event
      await supabase.from("romantic_events").insert(asAny({
        romance_id: romanceId,
        event_type: 'stage_advance',
        old_stage: rel.stage,
        new_stage: nextStage,
        reputation_axis: stageDef.reputationImpact?.axis ?? null,
        reputation_change: stageDef.reputationImpact?.change ?? 0,
        description: `Relationship advanced to ${stageDef.label}`,
      }));

      return { oldStage: rel.stage, newStage: nextStage, stageDef };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Romance Interaction (date, gift, argument, etc.) ────

export const useRomanceInteraction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      romanceId: string;
      eventType: string;
      attractionChange?: number;
      passionChange?: number;
      commitmentChange?: number;
      tensionChange?: number;
      description?: string;
    }) => {
      const { data: romance, error: fetchError } = await supabase
        .from("romantic_relationships")
        .select("*")
        .eq("id", input.romanceId)
        .single();

      if (fetchError || !romance) throw fetchError ?? new Error("Not found");

      const rel = romance as unknown as RomanticRelationship;

      const newScores = {
        attraction_score: clamp(rel.attraction_score + (input.attractionChange ?? 0), 0, 100),
        passion_score: clamp(rel.passion_score + (input.passionChange ?? 0), 0, 100),
        commitment_score: clamp(rel.commitment_score + (input.commitmentChange ?? 0), 0, 100),
        tension_score: clamp(rel.tension_score + (input.tensionChange ?? 0), 0, 100),
        last_date_at: input.eventType === 'date' ? new Date().toISOString() : rel.last_date_at,
      };

      // If secret affair, roll for detection
      let suspicionChange = 0;
      if (rel.is_secret) {
        const detectionChance = calculateAffairDetectionChance({
          currentSuspicion: rel.affair_suspicion,
          partnerFame: 0,
          isPublicVenue: false,
          interactionIntensity: 3,
          partnerHasRival: false,
          socialMediaActivity: 30,
        });

        const roll = Math.random() * 100;
        if (roll < detectionChance) {
          // Affair detected!
          await supabase
            .from("romantic_relationships")
            .update(asAny({
              ...newScores,
              affair_detected: true,
              affair_detected_at: new Date().toISOString(),
              affair_suspicion: 100,
            }))
            .eq("id", input.romanceId);

          await supabase.from("romantic_events").insert(asAny({
            romance_id: input.romanceId,
            event_type: 'affair_detected',
            suspicion_change: 100 - rel.affair_suspicion,
            description: 'The affair has been discovered!',
          }));

          queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
          return { detected: true };
        }

        // Suspicion increases slightly each interaction
        suspicionChange = Math.floor(Math.random() * 5) + 2;
      }

      await supabase
        .from("romantic_relationships")
        .update(asAny({
          ...newScores,
          affair_suspicion: clamp(rel.affair_suspicion + suspicionChange, 0, 100),
        }))
        .eq("id", input.romanceId);

      await supabase.from("romantic_events").insert(asAny({
        romance_id: input.romanceId,
        event_type: input.eventType,
        attraction_change: input.attractionChange ?? 0,
        passion_change: input.passionChange ?? 0,
        commitment_change: input.commitmentChange ?? 0,
        tension_change: input.tensionChange ?? 0,
        suspicion_change: suspicionChange,
        description: input.description ?? null,
      }));

      return { detected: false, newScores };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Reject / End Romance ────────────────────────────────

export const useEndRomance = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: async (input: {
      romanceId: string;
      reason: 'mutual' | 'rejection' | 'affair_caught' | 'incompatible' | 'abandoned';
      targetStage?: 'separated' | 'divorced';
    }) => {
      const { data: romance, error } = await supabase
        .from("romantic_relationships")
        .select("*")
        .eq("id", input.romanceId)
        .single();

      if (error || !romance) throw error ?? new Error("Not found");

      const rel = romance as unknown as RomanticRelationship;
      const stageDef = ROMANCE_STAGES.find(s => s.id === rel.stage);

      const newStage = input.targetStage
        ?? (rel.stage === 'married' || rel.stage === 'engaged' ? 'separated' : 'divorced');

      const isEnding = newStage === 'divorced' || input.reason === 'rejection';

      await supabase
        .from("romantic_relationships")
        .update(asAny({
          stage: newStage,
          stage_changed_at: new Date().toISOString(),
          is_active: isEnding ? false : true,
          ended_by: profileId,
          end_reason: input.reason,
        }))
        .eq("id", input.romanceId);

      const consequences = calculateRejectionConsequences(
        rel.stage,
        rel.commitment_score,
        stageDef?.isPublic ?? false,
      );

      await supabase.from("romantic_events").insert(asAny({
        romance_id: input.romanceId,
        event_type: isEnding ? 'romance_ended' : 'stage_regress',
        old_stage: rel.stage,
        new_stage: newStage,
        reputation_axis: stageDef?.isPublic ? 'reliability' : null,
        reputation_change: consequences.reputation_change,
        description: `Romance ended: ${input.reason}`,
        metadata: { consequences },
      }));

      return { newStage, consequences, isEnding };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Fetch Romance Event History ─────────────────────────

export const useRomanceEventHistory = (romanceId: string | undefined) => {
  return useQuery({
    queryKey: [QUERY_KEY, "events", romanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("romantic_events")
        .select("*")
        .eq("romance_id", romanceId!)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as unknown as RomanticEvent[];
    },
    enabled: !!romanceId,
  });
};

// ─── Check Stage Advancement ─────────────────────────────

export const useCanAdvanceRomance = (romanceId: string | undefined) => {
  const { data: romance } = useRomanticRelationship(romanceId);

  if (!romance) return { canAdvance: false, nextStage: null, missingRequirements: [] as string[] };

  return canAdvanceStage(romance);
};
