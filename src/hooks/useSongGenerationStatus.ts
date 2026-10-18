import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface SongGenerationStatus {
  audio_url: string | null;
  audio_generation_status: string | null;
  audio_generated_at: string | null;
  audio_generation_started_at: string | null;
}

export function useSongGenerationStatus(songId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["song-generation-status", songId],
    queryFn: async (): Promise<SongGenerationStatus | null> => {
      if (!songId) return null;

      const { data, error } = await supabase
        .from('songs')
        .select('audio_url, audio_generation_status, audio_generated_at, audio_generation_started_at')
        .eq('id', songId)
        .single();

      if (error) {
        console.error('Error fetching song generation status:', error);
        throw error;
      }

      return data;
    },
    enabled: !!songId,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: (data) => {
      // Poll every 30 seconds while generating
      if (data?.state?.data?.audio_generation_status === 'generating') {
        return 30 * 1000;
      }
      return false;
    },
  });

  // Queue rows are owner-readable only. Generated DB types are updated
  // separately, so the query is narrowed here without changing runtime RLS.
  const queue = useQuery({
    queryKey: ["ai-song-queue", songId],
    enabled: !!songId,
    queryFn: async () => {
      const {data,error} = await (supabase as any)
        .from("ai_song_generation_queue")
        .select("state,created_at,submitted_at,available_at")
        .eq("song_id",songId!)
        .order("created_at",{ascending:false})
        .limit(1).maybeSingle();
      if (error) throw error;
      return data as {state:string;created_at:string;submitted_at:string|null;available_at:string}|null;
    },
    refetchInterval: query.data?.audio_generation_status === "generating" ? 10000 : false,
  });
  const queueState = queue.data?.state ?? null;

  // Check for timeout on the client side
  useEffect(() => {
    if (query.data?.audio_generation_status === 'generating' && queueState !== 'queued' && queueState !== 'dispatching' && queueState !== 'needs_review' && query.data?.audio_generation_started_at) {
      const startedAt = new Date(queue.data?.submitted_at || query.data.audio_generation_started_at).getTime();
      const now = Date.now();
      const retryTimeout = 15 * 60 * 1000;

      if (now - startedAt > retryTimeout) {
        // Timeout detected on client side - will be handled by cleanup cron too
        queryClient.invalidateQueries({ queryKey: ["song-generation-status", songId] });
      }
    }
  }, [query.data, queue.data?.submitted_at, queueState, songId, queryClient]);

  const isGenerating = query.data?.audio_generation_status === 'generating';
  const isCompleted = query.data?.audio_generation_status === 'completed';
  const isFailed = query.data?.audio_generation_status === 'failed';
  const hasAudio = !!query.data?.audio_url;

  // Check if timed out
  const isTimedOut = isGenerating && queueState !== "queued" && queueState !== "dispatching" && queueState !== "needs_review" &&
    query.data?.audio_generation_started_at &&
    (Date.now() - new Date(queue.data?.submitted_at || query.data.audio_generation_started_at).getTime() > 15 * 60 * 1000);

  return {
    ...query,
    isGenerating,
    queueState,
    queueAvailableAt: queue.data?.available_at ?? null,
    isCompleted,
    isFailed: isFailed || isTimedOut,
    isTimedOut,
    hasAudio,
    // A completed song can be explicitly regenerated while its existing audio
    // stays playable; only an active provider job blocks a new attempt.
    canRegenerate: isFailed || isTimedOut || (hasAudio && isCompleted),
    cannotRegenerate: isGenerating && !isTimedOut,
  };
}
