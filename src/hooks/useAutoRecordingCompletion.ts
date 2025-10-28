import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useAutoRecordingCompletion = (userId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const checkSessions = async () => {
      try {
        const { data: completingSessions, error } = await supabase
          .from('recording_sessions')
          .select('id, song_id')
          .eq('status', 'in_progress')
          .lte('scheduled_end', new Date().toISOString())
          .or(`user_id.eq.${userId},band_id.in.(${await getBandIds(userId)})`);

        if (error) throw error;

        if (completingSessions && completingSessions.length > 0) {
          await supabase.functions.invoke('complete-recording-sessions');
          
          queryClient.invalidateQueries({ queryKey: ["recording-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["recordings"] });

          toast({
            title: "Recording Complete!",
            description: `${completingSessions.length} recording session(s) have finished.`,
          });
        }
      } catch (error) {
        console.error('Error checking recording sessions:', error);
      }
    };

    async function getBandIds(userId: string) {
      const { data } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      return data?.map(d => d.band_id).join(",") || "null";
    }

    checkSessions();
    const interval = setInterval(checkSessions, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, toast, queryClient]);
};
