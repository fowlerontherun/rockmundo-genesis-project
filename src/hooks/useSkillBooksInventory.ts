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

export const useSkillBooksInventory = (userId?: string) => {
  const queryClient = useQueryClient();

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["skill-books-inventory", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("player_skill_books")
        .select("*")
        .eq("user_id", userId)
        .order("purchased_at", { ascending: false });

      if (error) throw error;
      return data as SkillBookInventory[];
    },
    enabled: !!userId,
  });

  const completeBook = useMutation({
    mutationFn: async (bookId: string) => {
      if (!userId) throw new Error("User not authenticated");

      const book = books.find((b) => b.id === bookId);
      if (!book) throw new Error("Book not found");

      const { error: updateError } = await supabase
        .from("player_skill_books")
        .update({
          completed_at: new Date().toISOString(),
          progress_percentage: 100,
        })
        .eq("id", bookId);

      if (updateError) throw updateError;

      const response = await supabase.functions.invoke("progression", {
        body: {
          action: "award_action_xp",
          amount: book.xp_reward,
          category: "education",
          action_key: "book_reading",
          metadata: {
            book_id: book.book_id,
            book_title: book.book_title,
            skill_focus: book.skill_focus,
          },
        },
      });

      if (response.error) throw response.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skill-books-inventory", userId] });
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
