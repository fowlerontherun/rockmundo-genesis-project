import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LearningMethodCounts = Record<"books" | "university" | "videos" | "mentors", number | null>;

/** Counts represent matching catalogue entries, not guaranteed enrolment/booking availability. */
export const useLearningMethodCounts = (skill: string | null, allowed: boolean) =>
  useQuery({
    queryKey: ["education", "method-counts", skill],
    enabled: Boolean(skill && allowed),
    queryFn: async (): Promise<LearningMethodCounts> => {
      if (!skill) return { books: null, university: null, videos: null, mentors: null };
      const [books, university, videos, mentors] = await Promise.all([
        supabase.from("skill_books").select("id", { count: "exact", head: true })
          .eq("is_active", true).eq("skill_slug", skill),
        supabase.from("university_courses").select("id", { count: "exact", head: true })
          .eq("is_active", true).eq("skill_slug", skill),
        (supabase as any).from("education_youtube_resources").select("id", { count: "exact", head: true })
          .eq("skill_slug", skill),
        supabase.from("education_mentors").select("id", { count: "exact", head: true })
          .eq("is_active", true).eq("focus_skill", skill),
      ]);
      return {
        books: books.error ? null : books.count ?? 0,
        university: university.error ? null : university.count ?? 0,
        videos: videos.error ? null : videos.count ?? 0,
        mentors: mentors.error ? null : mentors.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
