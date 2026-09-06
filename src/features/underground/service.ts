import { supabase } from "@/integrations/supabase/client";
import type { UndergroundEvent, UndergroundResolution, UndergroundState } from "./types";

export async function getUndergroundState(profileId: string): Promise<UndergroundState> {
  const { data, error } = await (supabase as any)
    .from("player_underground_state")
    .select("profile_id, underground_cred, heat, notoriety, scene_connections, last_event_at")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as UndergroundState;

  const { data: created, error: createError } = await (supabase as any)
    .from("player_underground_state")
    .insert({ profile_id: profileId })
    .select("profile_id, underground_cred, heat, notoriety, scene_connections, last_event_at")
    .single();

  if (createError) throw createError;
  return created as UndergroundState;
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
