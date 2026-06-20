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

export interface UseWellnessStateResult {
  catalog: WellnessCatalogEntry[];
  cooldowns: WellnessCooldown[];
  ailments: PlayerAilment[];
  blocks: WellnessBlock[];
  vitals: WellnessVitals | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVitals = useCallback(async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from("profiles")
      .select("health, energy, mood, stress")
      .eq("id", profileId)
      .maybeSingle();
    if (data) setVitals(data as WellnessVitals);
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

  return { catalog, cooldowns, ailments, blocks, vitals, loading, error, perform, refresh };
}
