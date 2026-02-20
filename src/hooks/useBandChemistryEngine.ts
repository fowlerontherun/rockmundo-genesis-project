// Enhanced Band Chemistry Engine — React Hooks

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { asAny } from "@/lib/type-helpers";
import type {
  BandChemistryState,
  BandDramaEvent,
  DramaTriggerSource,
} from "@/types/band-chemistry-engine";
import {
  calculateBandChemistryModifiers,
  evaluateDramaTriggers,
  rollDramaEvents,
  DRAMA_PRESETS,
} from "@/types/band-chemistry-engine";

const QUERY_KEY = "band-chemistry-engine";
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ─── Fetch Chemistry State ───────────────────────────────

export const useBandChemistryState = (bandId: string | undefined) => {
  return useQuery({
    queryKey: [QUERY_KEY, "state", bandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("chemistry_level, romantic_tension, creative_alignment, conflict_index")
        .eq("id", bandId!)
        .single();

      if (error) throw error;
      return data as unknown as BandChemistryState;
    },
    enabled: !!bandId,
    staleTime: 1000 * 60 * 2,
  });
};

// ─── Get Computed Modifiers ──────────────────────────────

export const useBandChemistryModifiers = (bandId: string | undefined) => {
  const { data: state } = useBandChemistryState(bandId);

  if (!state) {
    return {
      songQualityModifier: 1,
      performanceRatingModifier: 1,
      memberLeaveRisk: 0,
      dramaEventChance: 5,
      rehearsalEfficiency: 1,
      fanPerception: 0,
    };
  }

  return calculateBandChemistryModifiers(state);
};

// ─── Fetch Drama Events ──────────────────────────────────

export const useBandDramaEvents = (bandId: string | undefined, unresolvedOnly = false) => {
  return useQuery({
    queryKey: [QUERY_KEY, "drama", bandId, unresolvedOnly],
    queryFn: async () => {
      let query = supabase
        .from("band_drama_events")
        .select("*")
        .eq("band_id", bandId!)
        .order("created_at", { ascending: false })
        .limit(50);

      if (unresolvedOnly) query = query.eq("resolved", false);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as BandDramaEvent[];
    },
    enabled: !!bandId,
  });
};

// ─── Trigger Drama Event ─────────────────────────────────

export const useTriggerDrama = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bandId: string;
      source: DramaTriggerSource;
      instigatorMemberId?: string;
      targetMemberId?: string;
      forcedPresetKey?: string; // Force a specific drama type
    }) => {
      // Fetch current state
      const { data: band, error: fetchErr } = await supabase
        .from("bands")
        .select("chemistry_level, romantic_tension, creative_alignment, conflict_index")
        .eq("id", input.bandId)
        .single();

      if (fetchErr || !band) throw fetchErr ?? new Error("Band not found");

      const state = band as unknown as BandChemistryState;
      let firedKeys: string[];

      if (input.forcedPresetKey) {
        firedKeys = [input.forcedPresetKey];
      } else {
        const candidates = evaluateDramaTriggers(state, input.source);
        firedKeys = rollDramaEvents(candidates, 2);
      }

      if (firedKeys.length === 0) return { fired: [], newState: state };

      const events: BandDramaEvent[] = [];
      let newState = { ...state };

      for (const key of firedKeys) {
        const preset = DRAMA_PRESETS[key];
        if (!preset) continue;

        // Apply changes
        newState = {
          chemistry_level: clamp(newState.chemistry_level + preset.chemistry_change, 0, 100),
          romantic_tension: clamp(newState.romantic_tension + preset.romantic_tension_change, 0, 100),
          creative_alignment: clamp(newState.creative_alignment + preset.creative_alignment_change, 0, 100),
          conflict_index: clamp(newState.conflict_index + preset.conflict_index_change, 0, 100),
        };

        // Insert drama event
        const { data: ev, error: evErr } = await supabase
          .from("band_drama_events")
          .insert(asAny({
            band_id: input.bandId,
            drama_type: preset.type,
            severity: preset.severity,
            chemistry_change: preset.chemistry_change,
            romantic_tension_change: preset.romantic_tension_change,
            creative_alignment_change: preset.creative_alignment_change,
            conflict_index_change: preset.conflict_index_change,
            instigator_member_id: input.instigatorMemberId ?? null,
            target_member_id: input.targetMemberId ?? null,
            member_leave_risk: preset.member_leave_risk,
            public_knowledge: preset.isPublic,
            description: preset.description,
          }))
          .select()
          .single();

        if (!evErr && ev) events.push(ev as unknown as BandDramaEvent);
      }

      // Update band state
      await supabase
        .from("bands")
        .update(asAny({
          ...newState,
          last_drama_event_at: new Date().toISOString(),
        }))
        .eq("id", input.bandId);

      return { fired: firedKeys, events, newState };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Resolve Drama Event ─────────────────────────────────

export const useResolveDrama = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      dramaId: string;
      bandId: string;
      resolutionType: 'apologized' | 'ignored' | 'escalated' | 'band_vote' | 'leader_decision';
    }) => {
      // Resolution effects
      const resolutionEffects: Record<string, Partial<BandChemistryState>> = {
        apologized: { conflict_index: -10, romantic_tension: -5, chemistry_level: 5 },
        band_vote: { conflict_index: -8, chemistry_level: 3, creative_alignment: 3 },
        leader_decision: { conflict_index: -5, chemistry_level: 2 },
        ignored: { conflict_index: 3, romantic_tension: 2 }, // Ignoring makes it worse
        escalated: { conflict_index: 10, romantic_tension: 5, chemistry_level: -5 },
      };

      const effects = resolutionEffects[input.resolutionType] ?? {};

      // Mark resolved
      await supabase
        .from("band_drama_events")
        .update(asAny({
          resolved: true,
          resolution_type: input.resolutionType,
          resolved_at: new Date().toISOString(),
        }))
        .eq("id", input.dramaId);

      // Apply resolution effects to band
      if (Object.keys(effects).length > 0) {
        const { data: band } = await supabase
          .from("bands")
          .select("chemistry_level, romantic_tension, creative_alignment, conflict_index")
          .eq("id", input.bandId)
          .single();

        if (band) {
          const state = band as unknown as BandChemistryState;
          await supabase
            .from("bands")
            .update(asAny({
              chemistry_level: clamp(state.chemistry_level + (effects.chemistry_level ?? 0), 0, 100),
              romantic_tension: clamp(state.romantic_tension + (effects.romantic_tension ?? 0), 0, 100),
              creative_alignment: clamp(state.creative_alignment + (effects.creative_alignment ?? 0), 0, 100),
              conflict_index: clamp(state.conflict_index + (effects.conflict_index ?? 0), 0, 100),
            }))
            .eq("id", input.bandId);
        }
      }

      return { resolutionType: input.resolutionType, effects };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

// ─── Update Chemistry Axes Directly ──────────────────────

export const useUpdateChemistryAxes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      bandId: string;
      changes: Partial<BandChemistryState>;
    }) => {
      const { data: band, error } = await supabase
        .from("bands")
        .select("chemistry_level, romantic_tension, creative_alignment, conflict_index")
        .eq("id", input.bandId)
        .single();

      if (error || !band) throw error ?? new Error("Not found");

      const state = band as unknown as BandChemistryState;
      const updated = {
        chemistry_level: clamp(state.chemistry_level + (input.changes.chemistry_level ?? 0), 0, 100),
        romantic_tension: clamp(state.romantic_tension + (input.changes.romantic_tension ?? 0), 0, 100),
        creative_alignment: clamp(state.creative_alignment + (input.changes.creative_alignment ?? 0), 0, 100),
        conflict_index: clamp(state.conflict_index + (input.changes.conflict_index ?? 0), 0, 100),
      };

      await supabase.from("bands").update(asAny(updated)).eq("id", input.bandId);
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};
