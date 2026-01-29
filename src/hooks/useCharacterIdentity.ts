// Character Identity Hook - Manages player's RP identity (origin, traits, backstory)

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth-context";
import { useOptionalGameData } from "@/hooks/useGameData";
import {
  fetchCharacterOrigins,
  fetchPersonalityTraits,
  fetchPlayerCharacterIdentity,
  createPlayerCharacterIdentity,
  updatePlayerCharacterIdentity,
  completeOnboarding,
  type UpdateCharacterIdentityInput,
} from "@/lib/api/roleplaying";
import type {
  CharacterOrigin,
  PersonalityTrait,
  PlayerCharacterIdentity,
  TraitCategory,
} from "@/types/roleplaying";

export const useCharacterOrigins = () => {
  return useQuery({
    queryKey: ["character-origins"],
    queryFn: fetchCharacterOrigins,
    staleTime: 1000 * 60 * 30, // 30 minutes - rarely changes
  });
};

export const usePersonalityTraits = () => {
  return useQuery({
    queryKey: ["personality-traits"],
    queryFn: fetchPersonalityTraits,
    staleTime: 1000 * 60 * 30,
  });
};

export const useTraitsByCategory = () => {
  const { data: allTraits = [], ...rest } = usePersonalityTraits();
  
  const traitsByCategory = allTraits.reduce<Record<TraitCategory, PersonalityTrait[]>>(
    (acc, trait) => {
      if (!acc[trait.category]) {
        acc[trait.category] = [];
      }
      acc[trait.category].push(trait);
      return acc;
    },
    { creative: [], social: [], work_ethic: [], emotional: [] }
  );

  return { traitsByCategory, allTraits, ...rest };
};

export const usePlayerCharacterIdentity = () => {
  const { user } = useAuth();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useQuery({
    queryKey: ["player-character-identity", profileId],
    queryFn: () => fetchPlayerCharacterIdentity(profileId!),
    enabled: !!user && !!profileId,
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateCharacterIdentity = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: () => {
      if (!profileId) throw new Error("No profile ID");
      return createPlayerCharacterIdentity(profileId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["player-character-identity", profileId], data);
    },
  });
};

export const useUpdateCharacterIdentity = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: (updates: UpdateCharacterIdentityInput) => {
      if (!profileId) throw new Error("No profile ID");
      return updatePlayerCharacterIdentity(profileId, updates);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["player-character-identity", profileId], data);
    },
  });
};

export const useCompleteOnboarding = () => {
  const queryClient = useQueryClient();
  const gameData = useOptionalGameData();
  const profileId = gameData?.profile?.id;

  return useMutation({
    mutationFn: () => {
      if (!profileId) throw new Error("No profile ID");
      return completeOnboarding(profileId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["player-character-identity", profileId], data);
      // Invalidate other queries that might depend on onboarding status
      queryClient.invalidateQueries({ queryKey: ["player-reputation"] });
    },
  });
};

/**
 * Combined hook for full character identity with origin and traits resolved
 */
export const useFullCharacterIdentity = () => {
  const { data: identity, isLoading: identityLoading } = usePlayerCharacterIdentity();
  const { data: origins = [], isLoading: originsLoading } = useCharacterOrigins();
  const { data: traits = [], isLoading: traitsLoading } = usePersonalityTraits();

  const isLoading = identityLoading || originsLoading || traitsLoading;

  const selectedOrigin = identity?.origin_id
    ? origins.find((o) => o.id === identity.origin_id) ?? null
    : null;

  const selectedTraits = identity?.trait_ids
    ? traits.filter((t) => identity.trait_ids.includes(t.id))
    : [];

  const hasCompletedOnboarding = identity?.onboarding_completed_at != null;
  const currentStep = identity?.onboarding_step ?? 0;

  return {
    identity,
    selectedOrigin,
    selectedTraits,
    allOrigins: origins,
    allTraits: traits,
    hasCompletedOnboarding,
    currentStep,
    isLoading,
  };
};

/**
 * Check if traits are compatible (not mutually exclusive)
 */
export const useTraitCompatibility = () => {
  const { allTraits } = useTraitsByCategory();

  const areTraitsCompatible = (traitIds: string[]): boolean => {
    const selectedTraits = allTraits.filter((t) => traitIds.includes(t.id));
    
    for (const trait of selectedTraits) {
      for (const incompatibleKey of trait.incompatible_with) {
        if (selectedTraits.some((t) => t.key === incompatibleKey)) {
          return false;
        }
      }
    }
    
    return true;
  };

  const getIncompatibleTraits = (traitId: string): string[] => {
    const trait = allTraits.find((t) => t.id === traitId);
    return trait?.incompatible_with ?? [];
  };

  return { areTraitsCompatible, getIncompatibleTraits };
};
