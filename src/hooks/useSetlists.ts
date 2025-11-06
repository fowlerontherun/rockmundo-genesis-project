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
  special_item_count?: number;
}

export interface SetlistSpecialItem {
  id: string;
  name: string;
  description: string | null;
  item_type: 'skill' | 'genre';
  skill_slug: string | null;
  genre: string | null;
  required_level: number;
  base_rating: number;
  scaling: number;
}

export interface SetlistSong {
  id: string;
  setlist_id: string;
  song_id: string | null;
  special_item_id: string | null;
  item_type: 'song' | 'special';
  position: number;
  notes: string | null;
  is_encore?: boolean;
  created_at: string;
  songs?: any;
  special_item?: SetlistSpecialItem | null;
}

export const useSetlists = (bandId: string | null) => {
  return useQuery({
    queryKey: ["setlists", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("setlists")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      const setlistIds = data.map((setlist) => setlist.id);
      const { data: itemRows, error: itemsError } = await supabase
        .from("setlist_songs")
        .select("setlist_id, item_type")
        .in("setlist_id", setlistIds);

      if (itemsError) throw itemsError;

      const songCountMap = new Map<string, number>();
      const specialCountMap = new Map<string, number>();

      (itemRows || []).forEach((row) => {
        if (!row?.setlist_id) return;
        if (row.item_type === 'song') {
          songCountMap.set(
            row.setlist_id,
            (songCountMap.get(row.setlist_id) || 0) + 1
          );
        } else if (row.item_type === 'special') {
          specialCountMap.set(
            row.setlist_id,
            (specialCountMap.get(row.setlist_id) || 0) + 1
          );
        }
      });

      return data.map((setlist) => ({
        ...setlist,
        song_count: songCountMap.get(setlist.id) || 0,
        special_item_count: specialCountMap.get(setlist.id) || 0,
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
          special_item:setlist_special_items (
            id,
            name,
            description,
            item_type,
            skill_slug,
            genre,
            required_level,
            base_rating,
            scaling
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

export const useAddSetlistItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      setlistId,
      itemType,
      songId,
      specialItemId,
      position,
      notes,
    }: {
      setlistId: string;
      itemType: 'song' | 'special';
      songId?: string;
      specialItemId?: string;
      position: number;
      notes?: string;
    }) => {
      const payload: Record<string, any> = {
        setlist_id: setlistId,
        position,
        notes,
        item_type: itemType,
        song_id: songId ?? null,
        special_item_id: specialItemId ?? null,
      };

      const { data, error } = await supabase
        .from("setlist_songs")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", variables.setlistId] });
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast({
        title: "Setlist Updated",
        description: "Item added to setlist successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add item: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export const useRemoveSetlistItem = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ setlistId, entryId }: { setlistId: string; entryId: string }) => {
      const { error } = await supabase
        .from("setlist_songs")
        .delete()
        .eq("setlist_id", setlistId)
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["setlist-songs", variables.setlistId] });
      queryClient.invalidateQueries({ queryKey: ["setlists"] });
      toast({
        title: "Item Removed",
        description: "Item removed from setlist successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove item: " + error.message,
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
