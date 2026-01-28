import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface JournalEntry {
  id: string;
  profile_id: string;
  band_id: string | null;
  entry_type: "milestone" | "note";
  category: string;
  title: string;
  content: string | null;
  is_auto_generated: boolean;
  is_pinned: boolean;
  metadata: Record<string, unknown> | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

interface JournalFilters {
  type?: "milestone" | "note";
  category?: string;
  search?: string;
}

export const useJournalEntries = (profileId: string | null, filters?: JournalFilters) => {
  return useQuery({
    queryKey: ["journal-entries", profileId, filters],
    queryFn: async () => {
      if (!profileId) return [];
      
      let query = supabase
        .from("player_journal_entries")
        .select("*")
        .eq("profile_id", profileId)
        .order("is_pinned", { ascending: false })
        .order("occurred_at", { ascending: false });

      if (filters?.type) {
        query = query.eq("entry_type", filters.type);
      }
      
      if (filters?.category) {
        query = query.eq("category", filters.category);
      }
      
      if (filters?.search) {
        query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching journal entries:", error);
        throw error;
      }
      
      return data as JournalEntry[];
    },
    enabled: !!profileId,
  });
};

interface CreateJournalEntryData {
  profile_id: string;
  band_id?: string | null;
  entry_type: "milestone" | "note";
  category: string;
  title: string;
  content?: string | null;
  is_auto_generated?: boolean;
  is_pinned?: boolean;
  metadata?: Record<string, unknown>;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  occurred_at?: string;
}

export const useCreateJournalEntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateJournalEntryData) => {
      const insertData = {
        profile_id: data.profile_id,
        band_id: data.band_id || null,
        entry_type: data.entry_type,
        category: data.category,
        title: data.title,
        content: data.content || null,
        is_auto_generated: data.is_auto_generated || false,
        is_pinned: data.is_pinned || false,
        metadata: data.metadata || {},
        related_entity_type: data.related_entity_type || null,
        related_entity_id: data.related_entity_id || null,
        occurred_at: data.occurred_at || new Date().toISOString(),
      };
      
      const { data: entry, error } = await supabase
        .from("player_journal_entries")
        .insert(insertData as any)
        .select()
        .single();

      if (error) {
        console.error("Error creating journal entry:", error);
        throw error;
      }
      
      return entry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries", variables.profile_id] });
    },
  });
};

export const useUpdateJournalEntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ entryId, title, content }: { entryId: string; title: string; content: string }) => {
      const { data, error } = await supabase
        .from("player_journal_entries")
        .update({ title, content, updated_at: new Date().toISOString() })
        .eq("id", entryId)
        .select()
        .single();

      if (error) {
        console.error("Error updating journal entry:", error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
  });
};

export const useDeleteJournalEntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("player_journal_entries")
        .delete()
        .eq("id", entryId);

      if (error) {
        console.error("Error deleting journal entry:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
  });
};

export const usePinJournalEntry = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ entryId, isPinned }: { entryId: string; isPinned: boolean }) => {
      const { data, error } = await supabase
        .from("player_journal_entries")
        .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
        .eq("id", entryId)
        .select()
        .single();

      if (error) {
        console.error("Error pinning journal entry:", error);
        throw error;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
  });
};

// Hook to check if a milestone has been achieved
export const useMilestoneTracking = (profileId: string | null) => {
  return useQuery({
    queryKey: ["milestone-tracking", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      
      const { data, error } = await supabase
        .from("player_milestone_tracking")
        .select("*")
        .eq("profile_id", profileId);
      
      if (error) {
        console.error("Error fetching milestone tracking:", error);
        throw error;
      }
      
      return data;
    },
    enabled: !!profileId,
  });
};
