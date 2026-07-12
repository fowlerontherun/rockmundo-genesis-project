import { useQuery } from "@tanstack/react-query";
import {
  fetchCanonicalSkillCatalogue,
  getAvailableSkillsForProfile,
  CANONICAL_ATTRIBUTE_LINKS,
  CANONICAL_PREREQUISITES,
  CANONICAL_ROLE_LINKS,
  CANONICAL_SYSTEM_LINKS,
  CANONICAL_UNLOCK_ROUTES,
} from "@/utils/skillCatalogue";

export function useSkillCatalogue() {
  return useQuery({
    queryKey: ["skill-catalogue", "canonical"],
    queryFn: fetchCanonicalSkillCatalogue,
    staleTime: 1000 * 60 * 30,
  });
}

export function useProfileSkillAvailability(profileId?: string | null) {
  return useQuery({
    queryKey: ["skill-catalogue", "availability", profileId],
    enabled: !!profileId,
    queryFn: () => getAvailableSkillsForProfile(profileId!),
    staleTime: 1000 * 60,
  });
}

export function useSkillCatalogueRelationships() {
  return {
    attributeLinks: CANONICAL_ATTRIBUTE_LINKS,
    prerequisites: CANONICAL_PREREQUISITES,
    roleLinks: CANONICAL_ROLE_LINKS,
    systemLinks: CANONICAL_SYSTEM_LINKS,
    unlockRoutes: CANONICAL_UNLOCK_ROUTES,
  };
}
