import { useCallback, useEffect, useState } from "react";
import {
  listWellnessCatalog,
  listCooldowns,
  listActiveAilments,
  listActiveBlocks,
  performWellnessActivity,
  type WellnessCatalogEntry,
  type WellnessCooldown,
  type PlayerAilment,
  type WellnessBlock,
  type WellnessVitals,
} from "@/lib/api/wellnessActivities";
import { supabase } from "@/integrations/supabase/client";
import { deriveLifestyleProfile, type LifestyleProfile } from "@/lib/wellnessLifestyle";

export interface UseWellnessStateResult {
  catalog: WellnessCatalogEntry[];
  cooldowns: WellnessCooldown[];
  ailments: PlayerAilment[];
  blocks: WellnessBlock[];
  vitals: WellnessVitals | null;
  lifestyle: LifestyleProfile | null;
  loading: boolean;
  error: string | null;
  perform: (slug: string) => Promise<{ ok: boolean; ailments: string[] }>;
  refresh: () => Promise<void>;
}

export function useWellnessState(profileId: string | null | undefined): UseWellnessStateResult {
  const [catalog, setCatalog] = useState<WellnessCatalogEntry[]>([]);
  const [cooldowns, setCooldowns] = useState<WellnessCooldown[]>([]);
  const [ailments, setAilments] = useState<PlayerAilment[]>([]);
  const [blocks, setBlocks] = useState<WellnessBlock[]>([]);
  const [vitals, setVitals] = useState<WellnessVitals | null>(null);
  const [lifestyle, setLifestyle] = useState<LifestyleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVitals = useCallback(async () => {
    if (!profileId) return;
    const { data, error: vitalsError } = await (supabase as any)
      .from("profiles")
      .select("health, energy, mood, stress")
      .eq("id", profileId)
      .maybeSingle();
    if (vitalsError) {
      console.error("[useWellnessState] Failed to load vitals", vitalsError);
    }
    if (data) {
      const nextVitals: WellnessVitals = {
        health: data.health ?? 80,
        energy: data.energy ?? 80,
        mood: data.mood ?? 70,
        stress: data.stress ?? 30,
        physical_health: data.health ?? 80,
        happiness: data.mood ?? 70,
        fatigue: Math.max(0, 100 - (data.energy ?? 80)),
        sleep_quality: 72,
        nutrition: 68,
        fitness: 60,
        motivation: 70,
        burnout_risk: Math.min(100, (data.stress ?? 30) + Math.max(0, 100 - (data.energy ?? 80)) / 2),
      } as WellnessVitals;
      setVitals(nextVitals);
      const { data: lifestyleRow } = await (supabase as any)
        .from("wellness_lifestyle_profiles")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (lifestyleRow) {
        const { data: traitRows } = await (supabase as any)
          .from("wellness_lifestyle_traits")
          .select("trait_slug, trait_name, progress, active, benefits, tradeoffs")
          .eq("profile_id", profileId)
          .order("active", { ascending: false });
        setLifestyle({
          sleep_consistency: lifestyleRow.sleep_consistency,
          sleep_debt: lifestyleRow.sleep_debt,
          activity_balance: lifestyleRow.activity_balance,
          exercise_consistency: lifestyleRow.exercise_consistency,
          nutrition_consistency: lifestyleRow.nutrition_consistency,
          hydration_consistency: lifestyleRow.hydration_consistency,
          social_activity: lifestyleRow.social_activity,
          partying_frequency: lifestyleRow.partying_frequency,
          alcohol_exposure: lifestyleRow.alcohol_exposure,
          recovery_discipline: lifestyleRow.recovery_discipline,
          workload_intensity: lifestyleRow.workload_intensity,
          downtime_quality: lifestyleRow.downtime_quality,
          routine_stability: lifestyleRow.routine_stability,
          burnout_pressure: lifestyleRow.burnout_pressure,
          lifestyle_balance: lifestyleRow.lifestyle_balance,
          state: lifestyleRow.lifestyle_state,
          burnout_stage: lifestyleRow.burnout_stage,
          identity: lifestyleRow.lifestyle_identity,
          recommendation: lifestyleRow.primary_recommendation,
          traits: (traitRows ?? []).map((t: any) => ({ slug: t.trait_slug, name: t.trait_name, progress: t.progress, active: t.active, benefit: t.benefits, tradeoff: t.tradeoffs })),
        });
      } else {
        setLifestyle(deriveLifestyleProfile([{ day: new Date().toISOString().slice(0, 10), sleepMinutes: (nextVitals.sleep_quality ?? 72) * 6, restMinutes: Math.max(0, 100 - (nextVitals.fatigue ?? 35)), nutritionScore: nextVitals.nutrition ?? 68, hydrationScore: 65, workloadMinutes: Math.max(0, 100 - (nextVitals.energy ?? 80)) * 5, socialMinutes: nextVitals.happiness ?? nextVitals.mood ?? 70 }]));
      }
    }
  }, [profileId]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const [c, cd, am, bl] = await Promise.all([
        listWellnessCatalog(),
        listCooldowns(profileId),
        listActiveAilments(profileId),
        listActiveBlocks(profileId),
      ]);
      setCatalog(c);
      setCooldowns(cd);
      setAilments(am);
      setBlocks(bl);
      await loadVitals();
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load wellness data");
    } finally {
      setLoading(false);
    }
  }, [profileId, loadVitals]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const perform = useCallback(
    async (slug: string) => {
      if (!profileId) throw new Error("No active character");
      const res = await performWellnessActivity(profileId, slug);
      await refresh();
      return { ok: res.ok, ailments: res.ailments_contracted ?? [] };
    },
    [profileId, refresh],
  );

  return { catalog, cooldowns, ailments, blocks, vitals, lifestyle, loading, error, perform, refresh };
}
