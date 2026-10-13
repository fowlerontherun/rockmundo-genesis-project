import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Credit only recent foreground input. Database RPC serializes overlapping tabs. */
export const usePlaytimeTracker = (profileId: string | null) => {
  useEffect(() => {
    if (!profileId) return;
    const MAX_IDLE_MS = 2 * 60 * 1000;
    let lastInputAt = 0;
    let inFlight = false;
    let resetClock = true;
    const onInput = () => {
      if (document.visibilityState !== "visible") return;
      if (!lastInputAt || Date.now() - lastInputAt >= MAX_IDLE_MS) resetClock = true;
      lastInputAt = Date.now();
    };
    const canCredit = () => document.visibilityState === "visible"
      && lastInputAt > 0 && Date.now() - lastInputAt < MAX_IDLE_MS;
    const tick = async () => {
      if (inFlight || !canCredit()) return;
      inFlight = true;
      try {
        const { error } = await supabase.rpc("record_active_character_playtime" as any, {
          p_profile_id: profileId,
          p_reset: resetClock,
        });
        if (error) console.warn("Could not persist active playtime:", error.message);
        else resetClock = false;
      } finally {
        inFlight = false;
      }
    };
    for (const name of ["pointerdown", "keydown", "touchstart"] as const) {
      document.addEventListener(name, onInput, { passive: true });
    }
    const interval = window.setInterval(() => void tick(), 60_000);
    return () => {
      window.clearInterval(interval);
      for (const name of ["pointerdown", "keydown", "touchstart"] as const) {
        document.removeEventListener(name, onInput);
      }
    };
  }, [profileId]);
};
