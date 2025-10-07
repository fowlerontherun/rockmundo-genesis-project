import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/lib/supabase-types";

export type SkillBook = Tables<"skill_books">;
export type BookPurchase = Tables<"player_book_purchases">;
export type ReadingSession = Tables<"player_book_reading_sessions">;

export const useSkillBooks = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: books, isLoading } = useQuery({
    queryKey: ["skill_books"],
    queryFn: async () => {
      const { data: booksData, error } = await supabase
        .from("skill_books")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("title", { ascending: true });

      if (error) throw error;

      // Fetch skill definitions separately
      const { data: skillsData } = await supabase
        .from("skill_definitions")
        .select("slug, display_name");

      // Map books with skill info
      return booksData?.map(book => ({
        ...book,
        skill_definitions: skillsData?.find(s => s.slug === book.skill_slug) || null
      })) || [];
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["my_book_purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_book_purchases")
        .select(`
          *,
          skill_books (*)
        `);

      if (error) throw error;
      return data;
    },
  });

  const { data: activeSession } = useQuery({
    queryKey: ["active_reading_session"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_book_reading_sessions")
        .select(`
          *,
          skill_books (title, author),
          player_book_reading_attendance (*)
        `)
        .eq("status", "reading")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const purchaseBook = useMutation({
    mutationFn: async ({ bookId, userId, profileId, price }: {
      bookId: string;
      userId: string;
      profileId: string;
      price: number;
    }) => {
      // Deduct cash
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();

      if (!profile) throw new Error("Profile not found");
      
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - price })
        .eq("id", profileId);

      if (cashError) throw cashError;

      // Create purchase
      const { data, error } = await supabase
        .from("player_book_purchases")
        .insert({
          user_id: userId,
          profile_id: profileId,
          book_id: bookId,
          purchase_price: price,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_book_purchases"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({
        title: "Book Purchased",
        description: "The book has been added to your library.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startReading = useMutation({
    mutationFn: async ({ purchaseId, bookId, userId, profileId, readingDays }: {
      purchaseId: string;
      bookId: string;
      userId: string;
      profileId: string;
      readingDays: number;
    }) => {
      const scheduledEndDate = new Date();
      scheduledEndDate.setDate(scheduledEndDate.getDate() + readingDays);

      const { data, error } = await supabase
        .from("player_book_reading_sessions")
        .insert({
          user_id: userId,
          profile_id: profileId,
          book_id: bookId,
          purchase_id: purchaseId,
          scheduled_end_date: scheduledEndDate.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_reading_session"] });
      toast({
        title: "Reading Started",
        description: "You'll read for 1 hour at 11 PM each night.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Start Reading",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    books,
    purchases,
    activeSession,
    isLoading,
    purchaseBook: purchaseBook.mutate,
    startReading: startReading.mutate,
  };
};
