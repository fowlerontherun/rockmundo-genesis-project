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
import type { LifestyleProfile } from "@/lib/wellnessLifestyle";

export interface UseWellnessStateResult {
  catalog: WellnessCatalogEntry[];
  cooldowns: WellnessCooldown[];
  ailments: PlayerAilment[];
  blocks: WellnessBlock[];
  vitals: WellnessVitals | null;
  lifestyle: LifestyleProfile | null;
  loading: boolean;
  error: string | null;
  catalogError: string | null;
  supplementalError: string | null;
  perform: (slug: string) => Promise<{ ok: boolean; ailments: string[] }>;
  refresh: () => Promise<void>;
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as any).message) : fallback;

export function useWellnessState(profileId: string | null | undefined): UseWellnessStateResult {
  const [catalog, setCatalog] = useState<WellnessCatalogEntry[]>([]);
  const [cooldowns, setCooldowns] = useState<WellnessCooldown[]>([]);
  const [ailments, setAilments] = useState<PlayerAilment[]>([]);
  const [blocks, setBlocks] = useState<WellnessBlock[]>([]);
  const [vitals, setVitals] = useState<WellnessVitals | null>(null);
  const [lifestyle, setLifestyle] = useState<LifestyleProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [supplementalError, setSupplementalError] = useState<string | null>(null);

  const loadVitals = useCallback(async () => {
    if (!profileId) {
      setVitals(null);
      return;
    }

    const { data, error: vitalsError } = await (supabase as any)
      .from("profiles")
      .select("health, energy, mood, stress")
      .eq("id", profileId)
      .maybeSingle();

    if (vitalsError) throw vitalsError;
    if (!data) {
      setVitals(null);
      return;
    }

    const missingCoreVital = [data.health, data.energy, data.mood, data.stress].some(
      (value) => value === null || value === undefined || Number.isNaN(Number(value)),
    );
    if (missingCoreVital) {
      setVitals(null);
      return;
    }

    const health = Number(data.health);
    const energy = Number(data.energy);
    const mood = Number(data.mood);
    const stress = Number(data.stress);
    setVitals({
      health,
      energy,
      mood,
      stress,
      physical_health: health,
      happiness: mood,
      fatigue: Math.max(0, 100 - energy),
      burnout_risk: Math.min(100, stress + Math.max(0, 100 - energy) / 2),
    });
  }, [profileId]);

  const loadLifestyle = useCallback(async () => {
    if (!profileId) {
      setLifestyle(null);
      return;
    }

    const { data: lifestyleRow, error: lifestyleError } = await (supabase as any)
      .from("wellness_lifestyle_profiles")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (lifestyleError) throw lifestyleError;

    if (!lifestyleRow) {
      setLifestyle(null);
      return;
    }

    const { data: traitRows, error: traitsError } = await (supabase as any)
      .from("wellness_lifestyle_traits")
      .select("trait_slug, trait_name, progress, active, benefits, tradeoffs")
      .eq("profile_id", profileId)
      .order("active", { ascending: false });
    if (traitsError) throw traitsError;

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
      traits: (traitRows ?? []).map((t: any) => ({
        slug: t.trait_slug,
        name: t.trait_name,
        progress: t.progress,
        active: t.active,
        benefit: t.benefits,
        tradeoff: t.tradeoffs,
      })),
    });
  }, [profileId]);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setCatalog([]);
      setCooldowns([]);
      setAilments([]);
      setBlocks([]);
      setVitals(null);
      setLifestyle(null);
      setError(null);
      setCatalogError(null);
      setSupplementalError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setCatalogError(null);
    setSupplementalError(null);

    try {
      // Core vitals determine whether the wellness screen itself is usable.
      // Optional lifestyle/auxiliary datasets must not blank truthful core stats.
      await loadVitals();

      const [catalogResult, cooldownResult, ailmentResult, blockResult, lifestyleResult] = await Promise.allSettled([
        listWellnessCatalog(),
        listCooldowns(profileId),
        listActiveAilments(profileId),
        listActiveBlocks(profileId),
        loadLifestyle(),
      ]);

      if (catalogResult.status === "fulfilled") {
        setCatalog(catalogResult.value);
      } else {
        setCatalog([]);
        setCatalogError(messageOf(catalogResult.reason, "Wellness actions could not be loaded"));
      }

      const supplementalFailures: string[] = [];

      if (cooldownResult.status === "fulfilled") setCooldowns(cooldownResult.value);
      else {
        setCooldowns([]);
        supplementalFailures.push(messageOf(cooldownResult.reason, "Cooldowns unavailable"));
      }

      if (ailmentResult.status === "fulfilled") setAilments(ailmentResult.value);
      else {
        setAilments([]);
        supplementalFailures.push(messageOf(ailmentResult.reason, "Ailments unavailable"));
      }

      if (blockResult.status === "fulfilled") setBlocks(blockResult.value);
      else {
        setBlocks([]);
        supplementalFailures.push(messageOf(blockResult.reason, "Activity blocks unavailable"));
      }

      if (lifestyleResult.status === "rejected") {
        setLifestyle(null);
        supplementalFailures.push(messageOf(lifestyleResult.reason, "Lifestyle data unavailable"));
      }

      setSupplementalError(supplementalFailures.length ? supplementalFailures.join(" • ") : null);
    } catch (e: any) {
      setVitals(null);
      setError(e?.message ?? "Failed to load wellness data");
    } finally {
      setLoading(false);
    }
  }, [profileId, loadLifestyle, loadVitals]);

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

  return { catalog, cooldowns, ailments, blocks, vitals, lifestyle, loading, error, catalogError, supplementalError, perform, refresh };
}
