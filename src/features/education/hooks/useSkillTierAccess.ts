import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useSkillTierAccess = (
  profileId: string | null | undefined,
  slugs: Array<string | null | undefined>,
) => {
  const uniqueSlugs = Array.from(
    new Set(slugs.filter((slug): slug is string => Boolean(slug))),
  ).sort();

  return useQuery({
    queryKey: ["skill-tier-access", profileId, uniqueSlugs],
    queryFn: async () => {
      if (!profileId || uniqueSlugs.length === 0) return new Map<string, boolean>();
      const { data, error } = await (supabase as any).rpc("skill_tier_access_bulk", {
        p_profile_id: profileId,
        p_slugs: uniqueSlugs,
      });
      if (error) throw error;
      return new Map<string, boolean>(
        (data ?? []).map((row: { skill_slug: string; is_unlocked: boolean }) => [
          row.skill_slug,
          row.is_unlocked !== false,
        ]),
      );
    },
    enabled: Boolean(profileId) && uniqueSlugs.length > 0,
    staleTime: 30_000,
  });
};

export const isHigherTierSkill = (slug?: string | null) =>
  Boolean(
    slug &&
      (slug.includes("professional") ||
        slug.includes("mastery")),
  );
