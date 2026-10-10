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

  const { data: purchases } = useQuery({
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

  const { data: activeSession } = useQuery({
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
      const { data, error } = await supabase.rpc("purchase_skill_book", { p_profile_id: profileId, p_book_id: bookId });
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
    mutationFn: async ({ purchaseId, bookId, userId, profileId, readingDays, autoRead }: {
      purchaseId: string;
      bookId: string;
      userId: string;
      profileId: string;
      readingDays: number;
      autoRead?: boolean;
    }) => {
      if (profileId !== (await supabase.from("profiles").select("id").eq("id", profileId).eq("user_id", userId).single()).data?.id) {
        throw new Error("The selected character does not belong to this account.");
      }
      const { data: active, error: activeError } = await supabase.from("player_book_reading_sessions")
        .select("id").eq("profile_id", profileId).eq("status", "reading").limit(1);
      if (activeError) throw activeError;
      if (active?.length) throw new Error("Stop your current book before starting another.");
      const { data: owned, error: ownedError } = await supabase.from("player_book_purchases")
        .select("id").eq("id", purchaseId).eq("profile_id", profileId).eq("book_id", bookId).maybeSingle();
      if (ownedError) throw ownedError;
      if (!owned) throw new Error("You must own this book before reading it.");
      const { data: book, error: bookError } = await supabase.from("skill_books")
        .select("skill_slug, base_reading_days").eq("id", bookId).eq("is_active", true).single();
      if (bookError) throw bookError;
      const { data: unlocked, error: unlockError } = await supabase.rpc("skill_tier_unlocked", {
        p_profile_id: profileId, p_slug: book.skill_slug,
      });
      if (unlockError) throw unlockError;
      if (unlocked !== true) throw new Error("This book's skill prerequisites are not unlocked yet. Choose another book.");
      const scheduledEndDate = new Date();
      scheduledEndDate.setDate(scheduledEndDate.getDate() + book.base_reading_days);

      // Reuse the most recent stopped session to preserve attendance and earned XP.
      const { data: previous, error: previousError } = await supabase
        .from("player_book_reading_sessions")
        .select("id")
        .eq("profile_id", profileId).eq("book_id", bookId).eq("purchase_id", purchaseId)
        .eq("status", "abandoned").order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (previousError) throw previousError;
      if (previous) {
        const { data, error } = await supabase.from("player_book_reading_sessions")
          .update({ status: "reading", auto_read: autoRead ?? false, scheduled_end_date: scheduledEndDate.toISOString() })
          .eq("id", previous.id).eq("profile_id", profileId).eq("status", "abandoned")
          .select().single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("player_book_reading_sessions")
        .insert({
          user_id: userId,
          profile_id: profileId,
          book_id: bookId,
          purchase_id: purchaseId,
          scheduled_end_date: scheduledEndDate.toISOString(),
          auto_read: autoRead ?? false,
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
    stopReading: stopReading.mutate,
    isStoppingReading: stopReading.isPending,
  };
};
