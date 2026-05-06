import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

/**
 * Detects when the active character has missed a tour pickup (a tour leg
 * that has already departed but for which the player has no in-progress /
 * completed travel record) and automatically invokes the
 * `rejoin-tour-transport` edge function to attach them to the nearest
 * upcoming leg.
 *
 * Players can disable this via the Travel Notifications preference
 * `auto_rejoin_enabled`.
 *
 * Polls every 60s and only fires once per leg per session (cooldown 5min).
 */
export const useAutoRejoinTour = () => {
  const { profileId, userId } = useActiveProfile();
  const queryClient = useQueryClient();
  const lastAttemptRef = useRef<Map<string, number>>(new Map());
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!profileId || !userId) return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;
      try {
        // 1) Respect user preference
        const { data: prefs } = await (supabase as any)
          .from("travel_notification_preferences")
          .select("auto_rejoin_enabled")
          .eq("profile_id", profileId)
          .maybeSingle();
        if (prefs && prefs.auto_rejoin_enabled === false) return;

        // 2) Find active band memberships
        const { data: memberships } = await supabase
          .from("band_members")
          .select("band_id")
          .eq("profile_id", profileId)
          .eq("member_status", "active");
        const bandIds = (memberships || []).map((m: any) => m.band_id);
        if (bandIds.length === 0) return;

        // 3) Find active tours
        const { data: tours } = await supabase
          .from("tours")
          .select("id")
          .in("band_id", bandIds)
          .in("status", ["active", "scheduled", "booked"]);
        const tourIds = (tours || []).map((t: any) => t.id);
        if (tourIds.length === 0) return;

        const nowISO = new Date().toISOString();

        // 4) Find a desynced leg: departed (or in transit) but no matching
        //    player_travel_history row in in_progress/completed for THIS profile.
        const { data: legs } = await (supabase as any)
          .from("tour_travel_legs")
          .select("id, departure_date, arrival_date, status")
          .in("tour_id", tourIds)
          .neq("status", "cancelled")
          .lte("departure_date", nowISO)
          .gte("arrival_date", nowISO)
          .order("departure_date", { ascending: false })
          .limit(5);

        if (!legs || legs.length === 0) return;

        const legIds = legs.map((l: any) => l.id);
        const { data: existingHistory } = await supabase
          .from("player_travel_history")
          .select("tour_leg_id, status")
          .eq("profile_id", profileId)
          .in("tour_leg_id", legIds);

        const handledLegIds = new Set(
          (existingHistory || [])
            .filter((h: any) => h.status === "in_progress" || h.status === "completed")
            .map((h: any) => h.tour_leg_id),
        );

        const desyncedLeg = legs.find((l: any) => !handledLegIds.has(l.id));
        if (!desyncedLeg) return;

        // 5) Cooldown per-leg
        const lastAt = lastAttemptRef.current.get(desyncedLeg.id) ?? 0;
        if (Date.now() - lastAt < 5 * 60 * 1000) return;
        lastAttemptRef.current.set(desyncedLeg.id, Date.now());

        inFlightRef.current = true;
        const { data, error } = await supabase.functions.invoke("rejoin-tour-transport", {
          body: { tour_leg_id: desyncedLeg.id },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        toast.success(
          (data as any)?.message ||
            "Auto-rejoined the nearest upcoming tour leg.",
          { description: "You missed a pickup — we caught you up with the band." },
        );

        queryClient.invalidateQueries({ queryKey: ["upcoming-travel"] });
        queryClient.invalidateQueries({ queryKey: ["travel-status"] });
        queryClient.invalidateQueries({ queryKey: ["active-profile"] });
        queryClient.invalidateQueries({ queryKey: ["current-location"] });
        queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
      } catch (err) {
        console.warn("[useAutoRejoinTour] tick failed", err);
      } finally {
        inFlightRef.current = false;
      }
    };

    // Run shortly after mount, then every 60s
    const initial = setTimeout(tick, 4000);
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [profileId, userId, queryClient]);
};
