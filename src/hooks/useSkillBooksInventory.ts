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

      const { data: completedRows, error: updateError } = await supabase
        .from("player_skill_books")
        .update({
          completed_at: new Date().toISOString(),
          progress_percentage: 100,
        })
        .eq("id", bookId)
        .eq("profile_id", profileId)
        .is("completed_at", null)
        .select("id");

      if (updateError) throw updateError;
      if (!completedRows?.length) throw new Error("Book was already completed or is no longer available");

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
