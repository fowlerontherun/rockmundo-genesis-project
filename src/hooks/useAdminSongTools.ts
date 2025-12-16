import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SongStatusIssue {
  id: string;
  title: string;
  status: string;
  user_id: string;
  band_id: string | null;
  created_at: string;
  has_recording: boolean;
  recording_count: number;
  issue_type: 'draft_with_recording' | 'recorded_without_recording' | 'released_not_on_release';
}

export const useSongStatusAudit = () => {
  return useQuery({
    queryKey: ['admin-song-audit'],
    queryFn: async () => {
      // Get all songs with their recording counts
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          status,
          user_id,
          band_id,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (songsError) throw songsError;

      // Get recording counts per song
      const { data: recordings, error: recError } = await supabase
        .from('recording_sessions')
        .select('song_id, status')
        .eq('status', 'completed');

      if (recError) throw recError;

      // Count recordings per song
      const recordingCounts = recordings?.reduce((acc, rec) => {
        acc[rec.song_id] = (acc[rec.song_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Find issues
      const issues: SongStatusIssue[] = [];
      
      songs?.forEach(song => {
        const recordingCount = recordingCounts[song.id] || 0;
        const hasRecording = recordingCount > 0;

        // Draft songs with completed recordings should be 'recorded'
        if (song.status === 'draft' && hasRecording) {
          issues.push({
            ...song,
            has_recording: hasRecording,
            recording_count: recordingCount,
            issue_type: 'draft_with_recording',
          });
        }

        // 'Recorded' status but no actual recording
        if (song.status === 'recorded' && !hasRecording) {
          issues.push({
            ...song,
            has_recording: hasRecording,
            recording_count: recordingCount,
            issue_type: 'recorded_without_recording',
          });
        }
      });

      return {
        issues,
        totalSongs: songs?.length || 0,
        draftCount: songs?.filter(s => s.status === 'draft').length || 0,
        recordedCount: songs?.filter(s => s.status === 'recorded').length || 0,
        releasedCount: songs?.filter(s => s.status === 'released').length || 0,
      };
    },
  });
};

export const useFixSongStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ songId, newStatus }: { songId: string; newStatus: string }) => {
      console.log('[Admin] Fixing song status:', songId, 'to', newStatus);
      
      const { error } = await supabase
        .from('songs')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', songId);

      if (error) throw error;
      return { songId, newStatus };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-song-audit'] });
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      toast.success(`Song status updated to ${data.newStatus}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to fix song: ${error.message}`);
    },
  });
};

export const useFixAllDraftWithRecordings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      console.log('[Admin] Fixing all draft songs with recordings');
      
      // Get all completed recording song IDs
      const { data: recordings, error: recError } = await supabase
        .from('recording_sessions')
        .select('song_id')
        .eq('status', 'completed');

      if (recError) throw recError;

      const songIds = [...new Set(recordings?.map(r => r.song_id) || [])];

      if (songIds.length === 0) return 0;

      // Update all draft songs that have recordings to 'recorded'
      const { data, error } = await supabase
        .from('songs')
        .update({ status: 'recorded', updated_at: new Date().toISOString() })
        .eq('status', 'draft')
        .in('id', songIds)
        .select('id');

      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-song-audit'] });
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      if (count > 0) {
        toast.success(`Fixed ${count} song(s) - updated to 'recorded' status`);
      } else {
        toast.info('No songs needed fixing');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to fix songs: ${error.message}`);
    },
  });
};
