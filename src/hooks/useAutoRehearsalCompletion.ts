import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useAutoRehearsalCompletion = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const checkRehearsals = async () => {
      try {
        const { data: bandIds } = await supabase
          .from("band_members")
          .select("band_id")
          .eq("user_id", userId);

        if (!bandIds || bandIds.length === 0) return;

        const { data: completingRehearsals, error } = await supabase
          .from('band_rehearsals')
          .select('id, selected_song_id')
          .eq('status', 'in_progress')
          .lte('scheduled_end', new Date().toISOString())
          .in('band_id', bandIds.map(b => b.band_id));

        if (error) throw error;

        if (completingRehearsals && completingRehearsals.length > 0) {
          await supabase.functions.invoke('complete-rehearsals');
          
          queryClient.invalidateQueries({ queryKey: ["band-rehearsals"] });
          queryClient.invalidateQueries({ queryKey: ["band-song-familiarity"] });

          toast({
            title: "Rehearsal Complete!",
            description: `${completingRehearsals.length} rehearsal(s) have finished. Your band's familiarity improved!`,
          });
        }
      } catch (error) {
        console.error('Error checking rehearsals:', error);
      }
    };

    checkRehearsals();
    const interval = setInterval(checkRehearsals, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, toast, queryClient]);
};
