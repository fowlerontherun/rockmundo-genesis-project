import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useAutoRecordingCompletion = (userId: string | null, profileId?: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const checkSessions = async () => {
      try {
        const bandIds = await getBandIds(userId, profileId ?? null);
        const now = new Date().toISOString();

        const [byProfile, byLegacyUser, byBand] = await Promise.all([
          profileId
            ? supabase
                .from('recording_sessions')
                .select('id, song_id')
                .in('status', ['in_progress', 'scheduled'])
                .lte('scheduled_end', now)
                .eq('profile_id', profileId)
            : Promise.resolve({ data: [], error: null } as any),
          profileId
            ? supabase
                .from('recording_sessions')
                .select('id, song_id')
                .in('status', ['in_progress', 'scheduled'])
                .lte('scheduled_end', now)
                .eq('user_id', userId)
                .is('profile_id', null)
            : supabase
                .from('recording_sessions')
                .select('id, song_id')
                .in('status', ['in_progress', 'scheduled'])
                .lte('scheduled_end', now)
                .eq('user_id', userId),
          bandIds.length > 0
            ? supabase
                .from('recording_sessions')
                .select('id, song_id')
                .in('status', ['in_progress', 'scheduled'])
                .lte('scheduled_end', now)
                .in('band_id', bandIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (byProfile.error) throw byProfile.error;
        if (byLegacyUser.error) throw byLegacyUser.error;
        if (byBand.error) throw byBand.error;

        const completingSessions = Array.from(new Map([
          ...((byProfile.data || []) as any[]),
          ...((byLegacyUser.data || []) as any[]),
          ...((byBand.data || []) as any[]),
        ].map(row => [row.id, row])).values());

        if (completingSessions.length > 0) {
          const { data: completionResult, error: completionError } = await supabase.functions.invoke('complete-recording-sessions', {
            body: { triggeredBy: 'client-auto-recording-completion' },
          });

          if (completionError) throw completionError;
          
          queryClient.invalidateQueries({ queryKey: ["recording-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["recordings"] });
          queryClient.invalidateQueries({ queryKey: ["recorded-songs-list"] });

          const completedCount = (completionResult as any)?.completedSessions ?? completingSessions.length;
          if (completedCount > 0) {
            toast({
              title: "Recording Complete!",
              description: `${completedCount} recording session(s) have finished.`,
            });
          }
        }
      } catch (error) {
        console.error('Error checking recording sessions:', error);
      }
    };

    async function getBandIds(userId: string, activeProfileId: string | null) {
      let resolvedProfileId = activeProfileId;
      if (!resolvedProfileId) {
        const { data: activeProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .is("died_at", null)
          .maybeSingle();
        resolvedProfileId = activeProfile?.id ?? null;
      }

      const [byProfile, byLegacyUser] = await Promise.all([
        resolvedProfileId
          ? supabase
              .from("band_members")
              .select("band_id")
              .eq("profile_id", resolvedProfileId)
              .eq("member_status", "active")
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("band_members")
          .select("band_id")
          .eq("user_id", userId)
          .eq("member_status", "active"),
      ]);

      if (byProfile.error) throw byProfile.error;
      if (byLegacyUser.error) throw byLegacyUser.error;

      return Array.from(new Set([
        ...((byProfile.data || []) as any[]).map(row => row.band_id),
        ...((byLegacyUser.data || []) as any[]).map(row => row.band_id),
      ].filter(Boolean)));
    }

    checkSessions();
    const interval = setInterval(checkSessions, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userId, profileId, toast, queryClient]);
};
