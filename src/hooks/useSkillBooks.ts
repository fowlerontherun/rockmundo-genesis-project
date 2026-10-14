import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/lib/supabase-types";
import { mergeSkillDefinitions } from "@/utils/skillDefinitions";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export type SkillBook = Tables<"skill_books">;
export type BookPurchase = Tables<"player_book_purchases">;
export type ReadingSession = Tables<"player_book_reading_sessions">;

export const useSkillBooks = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  const { data: books, isLoading } = useQuery({
    queryKey: ["skill_books"],
    queryFn: async () => {
      const booksData: SkillBook[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("skill_books").select("*")
          .eq("is_active", true).order("category", { ascending: true })
          .order("title", { ascending: true }).order("id", { ascending: true })
          .range(offset, offset + 499);
        if (error) throw error;
        booksData.push(...(data ?? []));
        if (!data || data.length < 500) break;
      }

      // Fetch skill definitions separately
      const { data: skillsData, error: skillsError } = await supabase
        .from("skill_definitions")
        .select("slug, display_name");

      if (skillsError) throw skillsError;
      const { map: mergedSkillMap } = mergeSkillDefinitions(skillsData ?? []);

      // Map books with skill info
      return (
        booksData?.map((book) => {
          const fallback = book.skill_slug ? mergedSkillMap.get(book.skill_slug) : null;

          return {
            ...book,
            skill_definitions:
              skillsData?.find((s) => s.slug === book.skill_slug) ??
              (fallback
                ? { slug: fallback.slug, display_name: fallback.displayName }
                : null),
            skill_display_name: fallback?.displayName ?? book.skill_slug,
          };
        }) || []
      );
    },
  });

  const { data: purchases, isLoading: purchasesLoading, isError: purchasesError, error: purchasesQueryError, refetch: retryPurchases } = useQuery({
    queryKey: ["my_book_purchases", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await supabase
        .from("player_book_purchases")
        .select(`
          *,
          skill_books (*),
          player_book_reading_sessions!player_book_reading_sessions_purchase_id_fkey (
            id,
            status,
            days_read,
            actual_completion_date
          )
        `)
        .eq("profile_id", profileId);

      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const { data: activeSession, isLoading: activeSessionLoading, isError: activeSessionError, error: activeSessionQueryError, refetch: retryActiveSession } = useQuery({
    queryKey: ["active_reading_session", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data, error } = await supabase
        .from("player_book_reading_sessions")
        .select(`
          *,
          skill_books (title, author, base_reading_days, skill_slug),
          player_book_reading_attendance (*)
        `)
        .eq("profile_id", profileId)
        .eq("status", "reading")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profileId,
  });

  const purchaseBook = useMutation({
    mutationFn: async ({ bookId, userId, profileId, price }: {
      bookId: string;
      userId: string;
      profileId: string;
      price: number;
    }) => {
      const rpc = supabase.rpc as unknown as (name: string, args: { p_profile_id: string; p_book_id: string }) => Promise<{ data: unknown; error: Error | null }>;
      const { data, error } = await rpc("purchase_skill_book", { p_profile_id: profileId, p_book_id: bookId });
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

  const stopReading = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!profileId) throw new Error("No active character selected.");
      const { data, error } = await supabase.from("player_book_reading_sessions")
        .update({ status: "abandoned", auto_read: false })
        .eq("id", sessionId).eq("profile_id", profileId).eq("status", "reading")
        .select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active_reading_session", profileId] });
      queryClient.invalidateQueries({ queryKey: ["my_book_purchases", profileId] });
      toast({ title: "Reading stopped", description: "Your recorded progress has been preserved. You can choose another book." });
    },
    onError: (error: Error) => toast({ title: "Unable to stop reading", description: error.message, variant: "destructive" }),
  });

  const startReading = useMutation({
    mutationFn: async ({ purchaseId, bookId, profileId, autoRead }: {
      purchaseId: string;
      bookId: string;
      userId: string;
      profileId: string;
      readingDays: number;
      autoRead?: boolean;
    }) => {
      const { data, error } = await (supabase as any).rpc("start_book_reading_atomic", {
        p_profile_id: profileId,
        p_purchase_id: purchaseId,
        p_book_id: bookId,
        p_auto_read: autoRead ?? false,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["active_reading_session"] });
      toast({
        title: "Reading Started",
        description: variables.autoRead ? "Automatic nightly reading is enabled." : "Reading started. Record your daily reading manually in Education > Books.",
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
    isLoading: isLoading || purchasesLoading || activeSessionLoading,
    purchasesError,
    purchasesQueryError,
    retryPurchases,
    activeSessionError,
    activeSessionQueryError,
    retryActiveSession,
    purchaseBook: purchaseBook.mutate,
    purchaseBookAsync: purchaseBook.mutateAsync,
    startReading: startReading.mutate,
    startReadingAsync: startReading.mutateAsync,
    stopReading: stopReading.mutate,
    isStoppingReading: stopReading.isPending,
  };
};
