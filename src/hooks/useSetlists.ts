import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Setlist {
  id: string;
  band_id: string;
  name: string;
  description: string | null;
  setlist_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  song_count?: number;
}

export interface SetlistSong {
  id: string;
  setlist_id: string;
  song_id: string | null;
  performance_item_id?: string | null;
  item_type?: string | null;
  section?: string | null;
  is_encore?: boolean | null;
  position: number;
  notes: string | null;
  created_at: string;
  songs?: any;
  performance_items?: {
    id: string;
    name: string;
    item_category: string;
    spotlight_level?: string | null;
  } | null;
}

export const useSetlists = (bandId: string | null) => {
  return useQuery({
    queryKey: ["setlists", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("setlists")
        .select(`
          *,
          setlist_songs (count)
        `)
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((setlist: any) => ({
        ...setlist,
        song_count: setlist.setlist_songs?.[0]?.count || 0,
      }));
    },
    enabled: !!bandId,
  });
};

export const useSetlistSongs = (setlistId: string | null) => {
  return useQuery({
    queryKey: ["setlist-songs", setlistId],
    queryFn: async () => {
      if (!setlistId) return [];

      const { data, error } = await supabase
        .from("setlist_songs")
        .select(`
          *,
          songs (
            id,
            title,
            genre,
            quality_score,
            duration_seconds,
            duration_display
          ),
          performance_items (
            id,
            name,
            item_category,
            spotlight_level
          )
        `)
        .eq("setlist_id", setlistId)
        .order("position");

      if (error) throw error;
      return data;
    },
    enabled: !!setlistId,
  });
};

export const useCreateSetlist = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      bandId,
      name,
      setlistType,
      description,
    }: {
      bandId: string;
      name: string;
      setlistType: string;
      description?: string;
    }) => {
      const { data, error } = await supabase
        .from("setlists")
        .insert({
          band_id: bandId,
          name,
          setlist_type: setlistType,
          description,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["setlists", variables.bandId] });
      toast({
        title: "Setlist Created",
        description: "Your setlist has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create setlist: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export const useUpdateSetlist = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      setlistId,
      updates,
    }: {
      setlistId: string;
      updates: Partial<Setlist>;
    }) => {
      const { data, error } = await supabase
        .from("setlists")
        .update(updates)
        .eq("id", setlistId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast({
        title: "Setlist Updated",
        description: "Your setlist has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update setlist: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export const useDeleteSetlist = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (setlistId: string) => {
      const { error } = await supabase
        .from("setlists")
        .delete()
        .eq("id", setlistId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast({
        title: "Setlist Deleted",
        description: "Your setlist has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete setlist: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export const useAddSongToSetlist = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      setlistId,
      songId,
      position,
      notes,
    }: {
      setlistId: string;
      songId: string;
      position: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("setlist_songs")
        .insert({
          setlist_id: setlistId,
          song_id: songId,
          position,
          notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", variables.setlistId] });
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast({
        title: "Song Added",
        description: "Song added to setlist successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add song: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export const useRemoveSongFromSetlist = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      setlistId,
      setlistSongId,
    }: {
      setlistId: string;
      setlistSongId: string;
    }) => {
      const { error } = await supabase
        .from("setlist_songs")
        .delete()
        .eq("id", setlistSongId)
        .eq("setlist_id", setlistId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", variables.setlistId] });
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast({
        title: "Song Removed",
        description: "Song removed from setlist successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove song: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export const useReorderSetlistSongs = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      setlistId,
      songUpdates,
    }: {
      setlistId: string;
      songUpdates: { id: string; position: number }[];
    }) => {
      const promises = songUpdates.map(({ id, position }) =>
        supabase.from("setlist_songs").update({ position }).eq("id", id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);

      if (errors.length > 0) throw new Error("Failed to reorder songs");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", variables.setlistId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to reorder songs: " + error.message,
        variant: "destructive",
      });
    },
  });
};
