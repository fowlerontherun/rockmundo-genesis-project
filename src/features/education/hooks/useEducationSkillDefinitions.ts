import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MAX_SKILL_LEVEL } from "@/data/skillConstants";
import { resolveSkillTier } from "@/utils/skillFamilies";
import type { EducationLearningSkill } from "../utils/educationRecommendations";

type LiveSkillDefinition = {
  slug: string;
  display_name: string | null;
  tier_caps: Record<string, unknown> | null;
};

/** Uses the actual production skill_definitions schema; does not require the future skill_catalogue_view. */
export const useEducationSkillDefinitions = () =>
  useQuery({
    queryKey: ["education", "skill-definitions"],
    queryFn: async (): Promise<EducationLearningSkill[]> => {
      const definitions: LiveSkillDefinition[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("skill_definitions")
          .select("slug, display_name, tier_caps")
          .order("slug").range(offset, offset + 499);
        if (error) throw error;
        definitions.push(...((data ?? []) as LiveSkillDefinition[]));
        if (!data || data.length < 500) break;
      }
      return definitions.map((definition) => {
        const caps = definition.tier_caps ?? {};
        const capValue = Number(caps.max_level);
        const maxLevel = Number.isFinite(capValue) && capValue > 0 ? Math.floor(capValue) : MAX_SKILL_LEVEL;
        const declaredTier = typeof caps.tier === "string" ? caps.tier : null;
        const tier = resolveSkillTier(definition.slug, declaredTier);
        return {
          slug: definition.slug,
          name: definition.display_name || definition.slug.replace(/_/g, " "),
          tier,
          max_level: maxLevel,
          is_active: caps.is_active !== false,
          is_hidden: caps.is_hidden === true || caps.hidden === true,
          is_foundational: tier === "basic",
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
