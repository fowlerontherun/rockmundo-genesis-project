import { supabase } from "@/integrations/supabase/client";
import type {
  PlayerSubstanceState,
  SubstanceCatalogItem,
  SubstanceUseResolution,
  UndergroundEvent,
  UndergroundResolution,
  UndergroundState,
} from "./types";

export async function getUndergroundState(profileId: string): Promise<UndergroundState> {
  const { data, error } = await (supabase as any)
    .from("player_underground_state")
    .select("profile_id, underground_cred, heat, notoriety, scene_connections, last_event_at")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as UndergroundState;

  return {
    profile_id: profileId,
    underground_cred: 0,
    heat: 0,
    notoriety: 0,
    scene_connections: 0,
    last_event_at: null,
  };
}

export async function listUndergroundEvents(): Promise<UndergroundEvent[]> {
  const { data, error } = await (supabase as any)
    .from("underground_event_catalog")
    .select("id, slug, name, description, event_type, risk_tier, minimum_age, min_cred, base_success_chance, success_effects, failure_effects, location_tags")
    .eq("is_active", true)
    .order("risk_tier", { ascending: true });

  if (error) throw error;
  return (data ?? []) as UndergroundEvent[];
}

export async function resolveUndergroundEvent(profileId: string, eventSlug: string): Promise<UndergroundResolution> {
  const { data, error } = await (supabase as any).rpc("resolve_underground_event", {
    p_profile_id: profileId,
    p_event_slug: eventSlug,
  });

  if (error) throw error;
  return data as UndergroundResolution;
}

export async function listSubstances(): Promise<SubstanceCatalogItem[]> {
  const { data, error } = await (supabase as any)
    .from("substance_catalog")
    .select("id, slug, name, category, description, minimum_age, risk_tier, cash_cost, intoxication_gain, tolerance_gain, dependency_gain, immediate_effects, crash_effects")
    .eq("is_active", true)
    .order("risk_tier", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubstanceCatalogItem[];
}

export async function getSubstanceState(profileId: string): Promise<PlayerSubstanceState[]> {
  const { error: processError } = await (supabase as any).rpc("process_substance_aftereffects", { p_profile_id: profileId });
  if (processError) throw processError;

  const { data, error } = await (supabase as any)
    .from("player_substance_state")
    .select("profile_id, substance_slug, intoxication, tolerance, dependency, total_uses, last_used_at, hangover_until, crash_until")
    .eq("profile_id", profileId);
  if (error) throw error;
  return (data ?? []) as PlayerSubstanceState[];
}

export async function useSubstance(profileId: string, substanceSlug: string): Promise<SubstanceUseResolution> {
  const { data, error } = await (supabase as any).rpc("use_substance", {
    p_profile_id: profileId,
    p_substance_slug: substanceSlug,
  });
  if (error) throw error;
  return data as SubstanceUseResolution;
}
