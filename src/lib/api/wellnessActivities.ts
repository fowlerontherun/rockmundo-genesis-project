import { supabase } from "@/integrations/supabase/client";

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
}

export async function listWellnessCatalog(): Promise<WellnessCatalogEntry[]> {
  const { data, error } = await supabase
    .from("wellness_activity_catalog" as any)
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as any;
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
  const { data, error } = await supabase.functions.invoke("wellness-perform-activity", {
    body: { profile_id: profileId, catalog_slug: catalogSlug },
  });
  if (error) {
    // surface server-provided error body when available
    const ctx = (error as any).context;
    let serverMsg: string | undefined;
    try { serverMsg = ctx && (await ctx.json?.())?.error; } catch { /* ignore */ }
    throw new Error(serverMsg ?? error.message);
  }
  return data as { ok: boolean; cooldown_until: string; new_stats: WellnessVitals; ailments_contracted: string[] };
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

export function getWellnessMultiplier(v: WellnessVitals): number {
  const score = (v.health + v.energy + v.mood) / 300; // 0..1
  // map 0 -> 0.5, 0.5 -> 0.85, 1 -> 1.15
  return Math.max(0.5, Math.min(1.15, 0.5 + score * 0.65));
}
