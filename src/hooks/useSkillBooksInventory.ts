import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SkillBookInventory {
  id: string;
  book_id: string;
  book_title: string;
  skill_focus: string;
  xp_reward: number;
  purchased_at: string;
  completed_at: string | null;
  progress_percentage: number;
}

export const useSkillBooksInventory = (profileId?: string) => {
  const queryClient = useQueryClient();

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["skill-books-inventory", profileId],
    queryFn: async () => {
      if (!profileId) return [];

      const { data, error } = await supabase
        .from("player_skill_books")
        .select("*")
        .eq("profile_id", profileId)
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      return data as SkillBookInventory[];
    },
    enabled: !!profileId,
  });

  const completeBook = useMutation({
    mutationFn: async (bookId: string) => {
      if (!profileId) throw new Error("Profile not found");

      const book = books.find((b) => b.id === bookId);
      if (!book) throw new Error("Book not found");
      if (book.completed_at) throw new Error("Book already completed");

      const { data, error } = await (supabase as any).rpc("complete_legacy_skill_book_atomic", {
        p_profile_id: profileId,
        p_book_id: bookId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Book completion was not confirmed.");

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-books-inventory", profileId] });
      toast.success("Book completed! XP awarded.");
    },
    onError: (error: any) => {
      toast.error("Failed to complete book", { description: error.message });
    },
  });

  return {
    books,
    isLoading,
    completeBook: completeBook.mutate,
    isCompleting: completeBook.isPending,
  };
};
