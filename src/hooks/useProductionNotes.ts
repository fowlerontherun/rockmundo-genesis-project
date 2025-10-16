import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ProductionNote {
  id: string;
  name: string;
  description: string;
  category: string;
  impact_type: string;
  impact_value: number;
  required_skill_slug: string | null;
  required_skill_value: number | null;
  required_fame: number | null;
  required_venue_prestige: number | null;
  cost_per_use: number;
  cooldown_shows: number;
  rarity: string;
  created_at: string;
}

export interface ProductionNoteAssignment {
  id: string;
  setlist_id: string;
  production_note_id: string;
  added_at: string;
  setlist_production_notes?: ProductionNote;
}

export const useProductionNotes = () => {
  return useQuery({
    queryKey: ["production-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setlist_production_notes")
        .select("*")
        .order("rarity", { ascending: false })
        .order("required_fame", { ascending: true });

      if (error) throw error;
      return data as ProductionNote[];
    },
  });
};

export const useSetlistProductionNotes = (setlistId: string | null) => {
  return useQuery({
    queryKey: ["setlist-production-notes", setlistId],
    queryFn: async () => {
      if (!setlistId) return [];

      const { data, error } = await supabase
        .from("setlist_production_note_assignments")
        .select(`
          *,
          setlist_production_notes (*)
        `)
        .eq("setlist_id", setlistId);

      if (error) throw error;
      return data as ProductionNoteAssignment[];
    },
    enabled: !!setlistId,
  });
};

export const useAddProductionNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      setlistId,
      productionNoteId,
    }: {
      setlistId: string;
      productionNoteId: string;
    }) => {
      const { data, error } = await supabase
        .from("setlist_production_note_assignments")
        .insert({
          setlist_id: setlistId,
          production_note_id: productionNoteId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["setlist-production-notes", variables.setlistId] });
      toast({
        title: "Production Note Added",
        description: "Production note added to setlist successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message.includes("duplicate") 
          ? "This production note is already in your setlist" 
          : "Failed to add production note: " + error.message,
        variant: "destructive",
      });
    },
  });
};

export const useRemoveProductionNote = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      setlistId, 
      productionNoteId 
    }: { 
      setlistId: string; 
      productionNoteId: string;
    }) => {
      const { error } = await supabase
        .from("setlist_production_note_assignments")
        .delete()
        .eq("setlist_id", setlistId)
        .eq("production_note_id", productionNoteId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["setlist-production-notes", variables.setlistId] });
      toast({
        title: "Production Note Removed",
        description: "Production note removed from setlist successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to remove production note: " + error.message,
        variant: "destructive",
      });
    },
  });
};
