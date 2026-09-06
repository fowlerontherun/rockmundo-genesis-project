import { supabase } from "@/integrations/supabase/client";
import type {
  PlayerScandal,
  PlayerSubstanceState,
  ScandalProcessResolution,
  ScandalResponse,
  ScandalResponseResolution,
  SceneContact,
  SceneContactDiscoveryResolution,
  SceneContactResolution,
  SceneInteraction,
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
  return { profile_id: profileId, underground_cred: 0, heat: 0, notoriety: 0, scene_connections: 0, last_event_at: null };
}

export async function listUndergroundEvents(): Promise<UndergroundEvent[]> {
  const { data, error } = await (supabase as any).from("underground_event_catalog").select("id, slug, name, description, event_type, risk_tier, minimum_age, min_cred, base_success_chance, success_effects, failure_effects, location_tags").eq("is_active", true).order("risk_tier", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UndergroundEvent[];
}

export async function resolveUndergroundEvent(profileId: string, eventSlug: string): Promise<UndergroundResolution> {
  const { data, error } = await (supabase as any).rpc("resolve_underground_event", { p_profile_id: profileId, p_event_slug: eventSlug });
  if (error) throw error;
  return data as UndergroundResolution;
}

export async function listSubstances(): Promise<SubstanceCatalogItem[]> {
  const { data, error } = await (supabase as any).from("substance_catalog").select("id, slug, name, category, description, minimum_age, risk_tier, cash_cost, intoxication_gain, tolerance_gain, dependency_gain, immediate_effects, crash_effects").eq("is_active", true).order("risk_tier", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubstanceCatalogItem[];
}

export async function getSubstanceState(profileId: string): Promise<PlayerSubstanceState[]> {
  const { error: processError } = await (supabase as any).rpc("process_substance_aftereffects", { p_profile_id: profileId });
  if (processError) throw processError;
  const { data, error } = await (supabase as any).from("player_substance_state").select("profile_id, substance_slug, intoxication, tolerance, dependency, total_uses, last_used_at, hangover_until, crash_until").eq("profile_id", profileId);
  if (error) throw error;
  return (data ?? []) as PlayerSubstanceState[];
}

export async function useSubstance(profileId: string, substanceSlug: string): Promise<SubstanceUseResolution> {
  const { data, error } = await (supabase as any).rpc("use_substance", { p_profile_id: profileId, p_substance_slug: substanceSlug });
  if (error) throw error;
  return data as SubstanceUseResolution;
}

export async function getSceneContacts(profileId: string): Promise<SceneContact[]> {
  const { data, error } = await (supabase as any).from("player_scene_contacts").select("id, profile_id, npc_name, npc_age, archetype_slug, chemistry, trust, attachment, tension, gossip_exposure, encounter_count, relationship_status, last_interaction_at, cooldown_until, discovered_at, archetype:scene_contact_archetypes(slug, name, description, romance_openness, discretion, social_energy, gossip_bias)").eq("profile_id", profileId).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SceneContact[];
}

export async function discoverSceneContacts(profileId: string): Promise<SceneContactDiscoveryResolution> {
  const { data, error } = await (supabase as any).rpc("discover_scene_contacts", { p_profile_id: profileId, p_limit: 3 });
  if (error) throw error;
  return data as SceneContactDiscoveryResolution;
}

export async function interactSceneContact(profileId: string, contactId: string, interaction: SceneInteraction): Promise<SceneContactResolution> {
  const { data, error } = await (supabase as any).rpc("interact_scene_contact", { p_profile_id: profileId, p_contact_id: contactId, p_interaction: interaction });
  if (error) throw error;
  return data as SceneContactResolution;
}

export async function getPlayerScandals(profileId: string): Promise<PlayerScandal[]> {
  const { error: processError } = await (supabase as any).rpc("process_player_scandals", { p_profile_id: profileId });
  if (processError) throw processError;
  const { data, error } = await (supabase as any)
    .from("player_scandals")
    .select("id, profile_id, source_type, source_id, category, headline, summary, stage, severity, credibility, exposure, response_choice, response_outcome, fine_amount, fine_paid, venue_restriction_until, travel_scrutiny_until, media_blackout_until, next_escalation_at, resolved_at, metadata, created_at, updated_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as PlayerScandal[];
}

export async function processPlayerScandals(profileId: string): Promise<ScandalProcessResolution> {
  const { data, error } = await (supabase as any).rpc("process_player_scandals", { p_profile_id: profileId });
  if (error) throw error;
  return data as ScandalProcessResolution;
}

export async function respondToScandal(profileId: string, scandalId: string, response: ScandalResponse): Promise<ScandalResponseResolution> {
  const { data, error } = await (supabase as any).rpc("respond_to_scandal", { p_profile_id: profileId, p_scandal_id: scandalId, p_response: response });
  if (error) throw error;
  return data as ScandalResponseResolution;
}
