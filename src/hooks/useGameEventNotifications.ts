import { useEffect } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

export const useGameEventNotifications = () => {
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Listen for new achievements
    const achievementsChannel = supabase
      .channel('achievement-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_achievements',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          const { data: achievement } = await supabase
            .from('achievements')
            .select('name, description, rarity')
            .eq('id', payload.new.achievement_id)
            .single();

          if (achievement) {
            addNotification({
              type: 'achievement',
              title: `Achievement Unlocked!`,
              message: `${achievement.name} - ${achievement.description}`,
            });
          }
        }
      )
      .subscribe();

    // Listen for gig completions
    const gigChannel = supabase
      .channel('gig-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gig_outcomes'
        },
        (payload) => {
          const outcome = payload.new;
          if (outcome.overall_rating >= 80) {
            addNotification({
              type: 'success',
              title: 'Amazing Performance!',
              message: `Your gig scored ${outcome.overall_rating}%! The crowd loved it!`,
            });
          }
        }
      )
      .subscribe();

    // Listen for song releases
    const releaseChannel = supabase
      .channel('release-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'releases',
          filter: `status=eq.released`
        },
        (payload) => {
          addNotification({
            type: 'success',
            title: 'Release Now Available!',
            message: `Your release "${payload.new.title}" is now live!`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(achievementsChannel);
      supabase.removeChannel(gigChannel);
      supabase.removeChannel(releaseChannel);
    };
  }, [user?.id, addNotification]);
};
