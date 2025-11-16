import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logger from "@/lib/logger";
import {
  persistSongwritingEvent,
  type SongwritingEventInput,
} from "@/lib/songwriting-event-service";

type LogSongwritingEventInput = Omit<SongwritingEventInput, "userId">;

export const useSongwritingEventLogger = (userId?: string | null) => {
  const { toast } = useToast();

  const logEvent = useMutation({
    mutationFn: async (input: LogSongwritingEventInput) => {
      if (!userId) {
        logger.warn("Attempted to log songwriting event without user ID", { input });
        throw new Error("User ID required to log songwriting events");
      }

      return persistSongwritingEvent({ ...input, userId });
    },
    onError: (error) => {
      logger.error("Failed to log songwriting event", { error });
      toast({
        title: "Unable to save session event",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return { logEvent };
};

export const useSongwritingEvents = (projectId?: string | null) => {
  return useQuery({
    queryKey: ["songwriting-session-events", projectId],
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from("songwriting_session_events")
        .select("*")
        .eq("project_id", projectId)
        .order("event_time", { ascending: false });

      if (error) {
        logger.error("Failed to fetch songwriting events", { error, projectId });
        throw error;
      }

      return data ?? [];
    },
  });
};

