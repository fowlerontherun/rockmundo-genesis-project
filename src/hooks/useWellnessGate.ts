import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  evaluateGate,
  getWellnessMultiplier,
  type WellnessVitals,
} from "@/lib/api/wellnessActivities";
import { supabase } from "@/integrations/supabase/client";

export type WellnessActivityType =
  | "gig"
  | "recording"
  | "tour"
  | "rehearsal"
  | "songwriting"
  | "jam"
  | "work"
  | "training"
  | "busking"
  | "travel";

export interface UseWellnessGateResult {
  vitals: WellnessVitals | null;
  multiplier: number;
  /**
   * Check whether the active character can perform `activityType` right now.
   * Returns true if allowed; otherwise shows a blocking toast (with a "do this
   * instead" hint when the server suggested one) and returns false.
   */
  check: (activityType: WellnessActivityType) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Lightweight wellness gate for game-activity entry buttons.
 * Pair `check()` with the click handler and `multiplier` with the outcome math.
 */
export function useWellnessGate(): UseWellnessGateResult {
  const { profileId } = useActiveProfile();
  const [vitals, setVitals] = useState<WellnessVitals | null>(null);

  const refresh = useCallback(async () => {
    if (!profileId) {
      setVitals(null);
      return;
    }
    const { data } = await (supabase as any)
      .from("profiles")
      .select("health, energy, mood, stress")
      .eq("id", profileId)
      .maybeSingle();
    if (data) setVitals(data as WellnessVitals);
  }, [profileId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const check = useCallback(
    async (activityType: WellnessActivityType) => {
      if (!profileId) return true;
      try {
        const res = await evaluateGate(profileId, activityType);
        if (res.allowed) return true;
        toast.error(res.reason ?? "Your wellness blocks this activity", {
          description: res.suggestion_slug
            ? `Try: ${res.suggestion_slug.replace(/_/g, " ")}`
            : "Visit the Wellness page to recover.",
          action: {
            label: "Wellness",
            onClick: () => {
              window.location.href = "/wellness";
            },
          },
        });
        return false;
      } catch (e: any) {
        // Fail-open: if the gate check itself errors, don't block gameplay.
        console.warn("[useWellnessGate] evaluateGate failed", e);
        return true;
      }
    },
    [profileId],
  );

  const multiplier = vitals ? getWellnessMultiplier(vitals) : 1;

  return { vitals, multiplier, check, refresh };
}

export default useWellnessGate;
