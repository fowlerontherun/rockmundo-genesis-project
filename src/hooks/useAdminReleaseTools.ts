import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StuckRelease {
  id: string;
  title: string;
  artist_name: string;
  release_status: string;
  manufacturing_complete_at: string | null;
  created_at: string;
  user_id: string;
  band_id: string | null;
}

export const useStuckReleases = () => {
  return useQuery({
    queryKey: ['stuck-releases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('releases')
        .select('id, title, artist_name, release_status, manufacturing_complete_at, created_at, user_id, band_id')
        .eq('release_status', 'manufacturing')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StuckRelease[];
    },
  });
};

export const useForceCompleteRelease = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (releaseId: string) => {
      console.log('[Admin] Force completing release:', releaseId);
      
      const { data, error } = await supabase.rpc('admin_force_complete_release', {
        p_release_id: releaseId,
      });

      if (error) {
        console.error('[Admin] Force complete failed:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Release not found');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['stuck-releases'] });
      toast.success('Release completed successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete release: ${error.message}`);
    },
  });
};

export const useFixNullManufacturingDates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      console.log('[Admin] Fixing NULL manufacturing dates');
      
      const { data, error } = await supabase.rpc('fix_null_manufacturing_dates');

      if (error) {
        console.error('[Admin] Fix NULL dates failed:', error);
        throw error;
      }

      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['stuck-releases'] });
      toast.success(`Fixed ${count} release(s) with missing manufacturing dates`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to fix dates: ${error.message}`);
    },
  });
};

export const useCompleteAllReadyReleases = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      console.log('[Admin] Completing all ready releases');
      
      const { data, error } = await supabase.rpc('auto_complete_manufacturing');

      if (error) {
        console.error('[Admin] Auto complete failed:', error);
        throw error;
      }

      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['releases'] });
      queryClient.invalidateQueries({ queryKey: ['stuck-releases'] });
      if (count > 0) {
        toast.success(`Completed ${count} release(s)`);
      } else {
        toast.info('No releases ready for completion');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete releases: ${error.message}`);
    },
  });
};
