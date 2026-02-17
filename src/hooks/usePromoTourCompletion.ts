import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Hook that checks for completed promo tour day activities
 * and applies rewards (hype, fame, followers) + stat drains (health, energy)
 */
export function usePromoTourCompletion(userId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: completableActivities } = useQuery({
    queryKey: ["promo-tour-completable", userId],
    queryFn: async () => {
      if (!userId) return [];
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("player_scheduled_activities")
        .select("*")
        .eq("user_id", userId)
        .eq("activity_type", "release_promo")
        .eq("status", "scheduled")
        .lte("scheduled_end", now);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!userId,
    refetchInterval: 60000, // check every minute
  });

  useEffect(() => {
    if (!completableActivities || completableActivities.length === 0 || !userId) return;

    const processCompletions = async () => {
      for (const activity of completableActivities) {
        const meta = activity.metadata || {};
        const releaseId = meta.release_id;
        const hypeValue = meta.hype_value || 30;
        const healthDrain = meta.health_drain || 15;
        const energyCost = meta.energy_cost || 20;

        // Mark activity as completed
        await (supabase as any)
          .from("player_scheduled_activities")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", activity.id);

        // Apply health and energy drain
        const { data: profile } = await supabase
          .from("profiles")
          .select("health, energy")
          .eq("user_id", userId)
          .single();

        if (profile) {
          const newHealth = Math.max(0, (profile.health ?? 100) - healthDrain);
          const newEnergy = Math.max(0, (profile.energy ?? 100) - energyCost);
          await supabase
            .from("profiles")
            .update({
              health: newHealth,
              energy: newEnergy,
              last_health_update: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }

        // Add hype to release
        if (releaseId) {
          const { data: rel } = await supabase
            .from("releases")
            .select("hype_score")
            .eq("id", releaseId)
            .single();
          const currentHype = (rel as any)?.hype_score || 0;
          const newHype = Math.min(1000, currentHype + hypeValue);
          await supabase
            .from("releases")
            .update({ hype_score: newHype } as any)
            .eq("id", releaseId);
        }

        // Small fame bonus (5-15)
        const fameGain = 5 + Math.floor(Math.random() * 11);
        const { data: bandMember } = await supabase
          .from("band_members")
          .select("band_id")
          .eq("user_id", userId)
          .eq("role", "leader")
          .maybeSingle();

        if (bandMember?.band_id) {
          const { data: band } = await supabase
            .from("bands")
            .select("fame")
            .eq("id", bandMember.band_id)
            .single();
          if (band) {
            await supabase
              .from("bands")
              .update({ fame: (band.fame || 0) + fameGain })
              .eq("id", bandMember.band_id);
          }
        }

        // Random viral event (10% chance — double hype)
        if (Math.random() < 0.1 && releaseId) {
          const bonusHype = hypeValue;
          const { data: rel2 } = await supabase
            .from("releases")
            .select("hype_score")
            .eq("id", releaseId)
            .single();
          const currentHype2 = (rel2 as any)?.hype_score || 0;
          await supabase
            .from("releases")
            .update({ hype_score: Math.min(1000, currentHype2 + bonusHype) } as any)
            .eq("id", releaseId);

          toast.success("🔥 Viral Moment!", {
            description: `Your promo went viral! Double hype gained today (+${bonusHype} bonus)`,
          });
        }

        toast.info(`Promo day completed: ${activity.title}`, {
          description: `+${hypeValue} hype | -${healthDrain} health | -${energyCost} energy`,
        });
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["promo-tour-completable", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["promo-tour"] });
      queryClient.invalidateQueries({ queryKey: ["promo-tour-days"] });
    };

    processCompletions();
  }, [completableActivities, userId, queryClient]);
}
