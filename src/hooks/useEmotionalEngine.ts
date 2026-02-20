// Dynamic Emotional Engine Hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import { asAny } from "@/lib/type-helpers";
import type {
  CharacterEmotionalState,
  EmotionalStateEvent,
  ApplyEmotionInput,
} from "@/types/emotional-engine";

const QUERY_KEY = "emotional-state";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ─── Fetch Emotional State ───────────────────────────────

export const useEmotionalState = () => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: [QUERY_KEY, profileId],
    queryFn: async () => {
      // Try to fetch existing state
      const { data, error } = await supabase
        .from("character_emotional_states")
        .select("*")
        .eq("profile_id", profileId!)
        .maybeSingle();

      if (error) throw error;

      // Auto-create if missing
      if (!data) {
        const { data: created, error: createError } = await supabase
          .from("character_emotional_states")
          .insert(asAny({ profile_id: profileId }))
          .select()
          .single();

        if (createError) throw createError;
        return created as unknown as CharacterEmotionalState;
      }

      return data as unknown as CharacterEmotionalState;
    },
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60,
  });
};

// ─── Apply Emotional Event ───────────────────────────────

export const useApplyEmotion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ApplyEmotionInput) => {
      // 1. Fetch current state
      const { data: state, error: fetchError } = await supabase
        .from("character_emotional_states")
        .select("*")
        .eq("profile_id", input.profile_id)
        .single();

      if (fetchError || !state) {
        // Auto-create if missing
        const { error: createError } = await supabase
          .from("character_emotional_states")
          .insert(asAny({ profile_id: input.profile_id }));
        if (createError) throw createError;

        // Re-fetch
        const { data: newState, error: refetchError } = await supabase
          .from("character_emotional_states")
          .select("*")
          .eq("profile_id", input.profile_id)
          .single();
        if (refetchError || !newState) throw refetchError ?? new Error("Failed to create emotional state");
        Object.assign(state ?? {}, newState);
      }

      const current = (state ?? {}) as unknown as CharacterEmotionalState;

      // 2. Calculate new scores
      const newScores = {
        happiness: clamp(current.happiness + (input.happiness_change ?? 0), 0, 100),
        loneliness: clamp(current.loneliness + (input.loneliness_change ?? 0), 0, 100),
        inspiration: clamp(current.inspiration + (input.inspiration_change ?? 0), 0, 100),
        jealousy: clamp(current.jealousy + (input.jealousy_change ?? 0), 0, 100),
        resentment: clamp(current.resentment + (input.resentment_change ?? 0), 0, 100),
        obsession: clamp(current.obsession + (input.obsession_change ?? 0), 0, 100),
        last_event_at: new Date().toISOString(),
      };

      // 3. Update state (trigger recalculates modifiers)
      const { data: updated, error: updateError } = await supabase
        .from("character_emotional_states")
        .update(asAny(newScores))
        .eq("profile_id", input.profile_id)
        .select()
        .single();

      if (updateError) throw updateError;

      // 4. Log the event
      await supabase
        .from("emotional_state_events")
        .insert(asAny({
          profile_id: input.profile_id,
          event_source: input.event_source,
          event_type: input.event_type,
          source_id: input.source_id ?? null,
          happiness_change: input.happiness_change ?? 0,
          loneliness_change: input.loneliness_change ?? 0,
          inspiration_change: input.inspiration_change ?? 0,
          jealousy_change: input.jealousy_change ?? 0,
          resentment_change: input.resentment_change ?? 0,
          obsession_change: input.obsession_change ?? 0,
          description: input.description ?? null,
        }));

      return updated as unknown as CharacterEmotionalState;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, variables.profile_id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Fetch Emotional Event History ───────────────────────

export const useEmotionalHistory = (limit = 20) => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: [QUERY_KEY, "history", profileId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("emotional_state_events")
        .select("*")
        .eq("profile_id", profileId!)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as unknown as EmotionalStateEvent[];
    },
    enabled: !!user && !!profileId,
    staleTime: 1000 * 30,
  });
};

// ─── Convenience: Apply Preset Emotion ───────────────────

import { EMOTION_EVENT_PRESETS } from "@/types/emotional-engine";

/**
 * Hook that provides a simple `applyPreset(presetKey, source)` function.
 * Usage: const { applyPreset } = useApplyEmotionPreset();
 *        applyPreset('gig_great_show', 'gig', optionalSourceId);
 */
export const useApplyEmotionPreset = () => {
  const applyEmotion = useApplyEmotion();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  const applyPreset = async (
    presetKey: keyof typeof EMOTION_EVENT_PRESETS,
    eventSource: ApplyEmotionInput['event_source'],
    sourceId?: string,
  ) => {
    if (!profileId) return null;

    const preset = EMOTION_EVENT_PRESETS[presetKey];
    if (!preset) {
      console.warn(`Unknown emotion preset: ${presetKey}`);
      return null;
    }

    return applyEmotion.mutateAsync({
      profile_id: profileId,
      event_source: eventSource,
      event_type: presetKey as string,
      source_id: sourceId,
      ...preset,
    });
  };

  return { applyPreset, isPending: applyEmotion.isPending };
};

// ─── Get Current Modifiers (for other systems) ──────────

/**
 * Returns the current emotional modifiers for the player.
 * Other systems (songwriting, gigs, interactions) can use these values.
 */
export const useEmotionalModifiers = () => {
  const { data: state, isLoading } = useEmotionalState();

  return {
    songwritingModifier: state?.songwriting_modifier ?? 1.0,
    performanceModifier: state?.performance_modifier ?? 1.0,
    interactionModifier: state?.interaction_modifier ?? 1.0,
    isLoading,
  };
};
