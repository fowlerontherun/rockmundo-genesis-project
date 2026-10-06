import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks playtime and keeps the active character's last_login_at fresh while
 * the player is actually using the game. The inactivity-coma job uses this
 * heartbeat (along with auth sign-ins) as account activity.
 */
export const usePlaytimeTracker = (profileId: string | null) => {
  const lastUpdateRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!profileId) return;

    const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    lastUpdateRef.current = Date.now();

    const touchActivity = async () => {
      if (document.visibilityState === "hidden") return;

      const { error } = await supabase
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", profileId)
        .is("died_at", null);

      if (error) {
        console.warn("Failed to update character activity heartbeat:", error.message);
      }
    };

    const updatePlaytime = async () => {
      if (document.visibilityState === "hidden") return;

      const now = Date.now();
      const elapsedMinutes = Math.floor((now - lastUpdateRef.current) / (60 * 1000));

      if (elapsedMinutes < 5) {
        await touchActivity();
        return;
      }

      try {
        const { data: profile, error: fetchError } = await supabase
          .from("profiles")
          .select("total_hours_played")
          .eq("id", profileId)
          .single();

        if (fetchError) {
          console.warn("Failed to fetch profile for playtime update:", fetchError.message);
          await touchActivity();
          return;
        }

        const currentHours = profile?.total_hours_played || 0;
        const hoursToAdd = elapsedMinutes / 60;
        const newTotalHours = currentHours + hoursToAdd;
        const activityAt = new Date(now).toISOString();

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            total_hours_played: Math.round(newTotalHours),
            last_login_at: activityAt,
            updated_at: activityAt,
          })
          .eq("id", profileId)
          .is("died_at", null);

        if (updateError) {
          console.warn("Failed to update playtime:", updateError.message);
        } else {
          lastUpdateRef.current = now;
        }
      } catch (err) {
        console.warn("Playtime tracker error:", err);
        await touchActivity();
      }
    };

    // Record activity immediately even if the player enters through a deep
    // link rather than the landing page.
    void touchActivity();

    intervalRef.current = setInterval(() => {
      void updatePlaytime();
    }, UPDATE_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void updatePlaytime();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (document.visibilityState === "visible") {
        void updatePlaytime();
      }
    };
  }, [profileId]);
};
