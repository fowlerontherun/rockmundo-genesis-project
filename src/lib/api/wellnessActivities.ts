import { supabase } from "@/integrations/supabase/client";
import { createDefaultWellnessCore, getPerformanceModifier as getCorePerformanceModifier, WELLNESS_ACTIVITIES, type WellnessCoreValues, type WellnessTierKey } from "@/lib/wellnessSystem";

export type WellnessCategory = "recovery" | "fitness" | "medical" | "indulgence";

export interface WellnessCatalogEntry {
  id: string;
  slug: string;
  name: string;
  category: WellnessCategory;
  description: string | null;
  duration_minutes: number;
  cooldown_hours: number;
  stamina_cost: number;
  cost_cents: number;
  stat_effects: Record<string, number>;
  ailment_risk: Record<string, number>;
  treats_ailment_slug: string | null;
  unlock_min_fame: number;
  unlock_tier?: WellnessTierKey;
  can_overlap?: boolean;
  location_tags?: string[];
  gameplay_impact?: string;
  sort_order: number;
}

export interface WellnessCooldown {
  catalog_slug: string;
  cooldown_until: string;
}

export interface PlayerAilment {
  id: string;
  slug: string;
  name: string;
  severity: number;
  contracted_at: string;
  resolved_at: string | null;
  treatment_required_slug: string | null;
  blocks_activity_types: string[];
  description: string | null;
}

export interface WellnessBlock {
  id: string;
  reason: string;
  blocks_activity_types: string[];
  suggestion_slug: string | null;
  expires_at: string;
}

export interface WellnessVitals {
  health: number;
  energy: number;
  mood: number;
  stress: number;
  physical_health?: number;
  happiness?: number;
  fatigue?: number;
  sleep_quality?: number;
  nutrition?: number;
  fitness?: number;
  motivation?: number;
  burnout_risk?: number;
  overall_wellness?: number;
}

export async function listWellnessCatalog(): Promise<WellnessCatalogEntry[]> {
  const { data, error } = await supabase
    .from("wellness_activity_catalog" as any)
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  const rows = (data ?? []) as unknown as WellnessCatalogEntry[];
  return rows.map((row) => {
    const balance = WELLNESS_ACTIVITIES.find((activity) => activity.slug === row.slug);
    return balance ? { ...row, ...balance, unlock_min_fame: row.unlock_min_fame } : row;
  }) as any;
}

export async function listCooldowns(profileId: string): Promise<WellnessCooldown[]> {
  const { data, error } = await supabase
    .from("wellness_cooldowns_view" as any)
    .select("catalog_slug, cooldown_until")
    .eq("profile_id", profileId);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function listActiveAilments(profileId: string): Promise<PlayerAilment[]> {
  const { data, error } = await supabase
    .from("player_ailments" as any)
    .select("*")
    .eq("profile_id", profileId)
    .is("resolved_at", null)
    .order("severity", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function listActiveBlocks(profileId: string): Promise<WellnessBlock[]> {
  const { data, error } = await supabase
    .from("wellness_blocks" as any)
    .select("*")
    .eq("profile_id", profileId)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  return (data ?? []) as any;
}

export async function performWellnessActivity(profileId: string, catalogSlug: string) {
  const { data, error } = await supabase.rpc("perform_wellness_activity" as any, {
    _profile_id: profileId,
    _catalog_slug: catalogSlug,
  });
  if (error) throw new Error(error.message);
  return data as unknown as { ok: boolean; cooldown_until: string; new_stats: WellnessVitals; ailments_contracted: string[] };
}

export async function evaluateGate(profileId: string, activityType: string) {
  const { data, error } = await supabase.rpc("evaluate_wellness_gate" as any, {
    _profile_id: profileId,
    _activity_type: activityType,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? { allowed: true, reason: null, suggestion_slug: null }) as {
    allowed: boolean; reason: string | null; suggestion_slug: string | null;
  };
}

export function wellnessVitalsToCore(v: WellnessVitals): WellnessCoreValues {
  return {
    ...createDefaultWellnessCore({ health: v.health, energy: v.energy, mood: v.mood, stress: v.stress }),
    physical_health: v.physical_health ?? v.health,
    happiness: v.happiness ?? v.mood,
    fatigue: v.fatigue ?? createDefaultWellnessCore({ energy: v.energy }).fatigue,
    sleep_quality: v.sleep_quality ?? 72,
    nutrition: v.nutrition ?? 68,
    fitness: v.fitness ?? 55,
    motivation: v.motivation ?? v.mood,
    burnout_risk: v.burnout_risk ?? Math.min(100, Math.round((v.stress ?? 30) * 0.45)),
  };
}

export function getWellnessMultiplier(v: WellnessVitals): number {
  return getCorePerformanceModifier(wellnessVitalsToCore(v));
}
