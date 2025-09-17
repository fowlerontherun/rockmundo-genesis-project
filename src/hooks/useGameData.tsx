import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type {
  PostgrestError,
  PostgrestMaybeSingleResponse,
  PostgrestSingleResponse
} from "@supabase/supabase-js";

type Nullable<T> = T | null;

export type PlayerProfile = Tables<"profiles">;
export type PlayerSkills = Tables<"player_skills">;
export type PlayerAttributes = Tables<"player_attributes">;
export type ActivityItem = Tables<"activity_feed">;

const CHARACTER_STORAGE_KEY = "rockmundo:selectedCharacterId";

const isPostgrestError = (error: unknown): error is PostgrestError => {
  if (typeof error !== "object" || error === null) return false;
  return "message" in error && "code" in error;
};

const extractErrorMessage = (error: unknown) => {
  if (isPostgrestError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "An unknown error occurred.";
};

const readStoredCharacterId = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CHARACTER_STORAGE_KEY);
};

const persistCharacterId = (characterId: string | null) => {
  if (typeof window === "undefined") return;
  if (characterId) {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, characterId);
  } else {
    window.localStorage.removeItem(CHARACTER_STORAGE_KEY);
  }
};

const sortCharacters = (characters: PlayerProfile[]) =>
  [...characters].sort((a, b) => a.slot_number - b.slot_number);

export interface CreateCharacterInput {
  username: string;
  displayName?: string;
  slotNumber: number;
  unlockCost: number;
  makeActive?: boolean;
}

interface GameDataContextValue {
  characters: PlayerProfile[];
  selectedCharacterId: Nullable<string>;
  profile: Nullable<PlayerProfile>;
  skills: Nullable<PlayerSkills>;
  attributes: Nullable<PlayerAttributes>;
  activities: ActivityItem[];
  currentCity: Nullable<Tables<"cities">>;
  loading: boolean;
  error: Nullable<string>;
  hasCharacters: boolean;
  setActiveCharacter: (characterId: string) => Promise<void>;
  clearSelectedCharacter: () => void;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile>;
  updateSkills: (updates: Partial<PlayerSkills>) => Promise<PlayerSkills>;
  updateAttributes: (updates: Partial<PlayerAttributes>) => Promise<PlayerAttributes>;
  addActivity: (
    activityType: string,
    message: string,
    earnings?: number,
    metadata?: ActivityItem["metadata"]
  ) => Promise<ActivityItem>;
  createCharacter: (input: CreateCharacterInput) => Promise<PlayerProfile>;
  refreshCharacters: () => Promise<PlayerProfile[]>;
  resetCharacter: () => Promise<void>;
  refetch: () => Promise<void>;
}

const GameDataContext = createContext<GameDataContextValue | undefined>(undefined);

const useProvideGameData = (): GameDataContextValue => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<Nullable<string>>(
    () => readStoredCharacterId()
  );
  const [profile, setProfile] = useState<Nullable<PlayerProfile>>(null);
  const [skills, setSkills] = useState<Nullable<PlayerSkills>>(null);
  const [attributes, setAttributes] = useState<Nullable<PlayerAttributes>>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentCity, setCurrentCity] = useState<Nullable<Tables<"cities">>>(null);
  const [error, setError] = useState<Nullable<string>>(null);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const clearSelectedCharacter = useCallback(() => {
    setSelectedCharacterId(null);
    persistCharacterId(null);
    setProfile(null);
    setSkills(null);
    setAttributes(null);
    setActivities([]);
    setCurrentCity(null);
  }, []);

  const updateSelectedCharacterId = useCallback((characterId: Nullable<string>) => {
    setSelectedCharacterId(characterId);
    persistCharacterId(characterId);
  }, []);

  const resolveCurrentCity = useCallback(
    async (cityId: Nullable<string>) => {
      if (!cityId) {
        setCurrentCity(null);
        return null;
      }

      const {
        data,
        error: cityError,
        status: cityStatus
      }: PostgrestMaybeSingleResponse<Tables<"cities">> = await supabase
        .from("cities")
        .select("*")
        .eq("id", cityId)
        .maybeSingle();

      if (cityError && cityStatus !== 406) {
        console.error("Error fetching current city:", cityError);
        return null;
      }

      const cityData = data ?? null;
      setCurrentCity(cityData);
      return cityData;
    },
    []
  );

  const fetchCharacters = useCallback(async () => {
    if (!user) {
      clearSelectedCharacter();
      setCharacters([]);
      return [] as PlayerProfile[];
    }

    setCharactersLoading(true);
    setError(null);

    try {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("slot_number", { ascending: true });

      if (profilesError) throw profilesError;

      const list = sortCharacters(data ?? []);
      setCharacters(list);

      const hasStoredSelection = selectedCharacterId
        ? list.some(character => character.id === selectedCharacterId)
        : false;
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStoredSelection
        ? selectedCharacterId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (!fallbackId) {
        clearSelectedCharacter();
      } else if (fallbackId !== selectedCharacterId) {
        updateSelectedCharacterId(fallbackId);
      }

      return list;
    } catch (err) {
      console.error("Error fetching characters:", err);
      setError(extractErrorMessage(err));
      return [] as PlayerProfile[];
    } finally {
      setCharactersLoading(false);
    }
  }, [
    user,
    selectedCharacterId,
    clearSelectedCharacter,
    updateSelectedCharacterId
  ]);

  const fetchGameData = useCallback(async () => {
    if (!user || !selectedCharacterId) {
      setProfile(null);
      setSkills(null);
      setAttributes(null);
      setActivities([]);
      setCurrentCity(null);
      setDataLoading(false);
      setError(null);
      return;
    }

    setDataLoading(true);
    setError(null);

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", selectedCharacterId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        setProfile(null);
        setSkills(null);
        setAttributes(null);
        setActivities([]);
        setCurrentCity(null);
        setError("The selected character could not be found.");
        updateSelectedCharacterId(null);
        await fetchCharacters();
        return;
      }

      setProfile(profileData);
      setCharacters(prev => {
        const others = prev.filter(existing => existing.id !== profileData.id);
        return sortCharacters([...others, profileData]);
      });

      const [
        { data: skillsData, error: skillsError },
        { data: attributesData, error: attributesError },
        { data: activitiesData, error: activityError }
      ] = await Promise.all([
        supabase
          .from("player_skills")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .maybeSingle(),
        supabase
          .from("player_attributes")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .maybeSingle(),
        supabase
          .from("activity_feed")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      if (skillsError) throw skillsError;
      if (attributesError) throw attributesError;
      if (activityError) throw activityError;

      setSkills(skillsData ?? null);
      setAttributes(attributesData ?? null);
      setActivities(activitiesData ?? []);
      await resolveCurrentCity(profileData.current_city_id ?? null);
    } catch (err) {
      console.error("Error fetching game data:", err);
      setError(extractErrorMessage(err));
    } finally {
      setDataLoading(false);
    }
  }, [
    user,
    selectedCharacterId,
    resolveCurrentCity,
    updateSelectedCharacterId,
    fetchCharacters
  ]);

  const setActiveCharacter = useCallback(
    async (characterId: string) => {
      if (!user) {
        throw new Error("You must be signed in to select a character.");
      }

      setCharactersLoading(true);
      setError(null);

      try {
        const { error: deactivateError } = await supabase
          .from("profiles")
          .update({ is_active: false })
          .eq("user_id", user.id);

        if (deactivateError) throw deactivateError;

        const { data, error: activationError } = await supabase
          .from("profiles")
          .update({ is_active: true })
          .eq("id", characterId)
          .select()
          .single();

        if (activationError) throw activationError;
        if (!data) throw new Error("Failed to activate the selected character.");

        updateSelectedCharacterId(characterId);
        setCharacters(prev =>
          sortCharacters(
            prev.map(character => ({
              ...character,
              is_active: character.id === characterId
            }))
          )
        );

        setProfile(data);
        await resolveCurrentCity(data.current_city_id ?? null);
        await fetchGameData();
      } catch (err) {
        console.error("Error activating character:", err);
        setError(extractErrorMessage(err));
        throw err;
      } finally {
        setCharactersLoading(false);
      }
    },
    [user, updateSelectedCharacterId, resolveCurrentCity, fetchGameData]
  );

  const updateProfile = useCallback(
    async (updates: Partial<PlayerProfile>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", selectedCharacterId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw updateError;
      }

      if (!data) {
        throw new Error("No profile data returned from Supabase.");
      }

      setProfile(data);
      setCharacters(prev =>
        sortCharacters(prev.map(character => (character.id === data.id ? data : character)))
      );

      const nextCityId = data.current_city_id ?? null;
      const currentCityId = currentCity?.id ?? null;

      if (nextCityId !== currentCityId) {
        await resolveCurrentCity(nextCityId);
      }

      return data;
    },
    [user, selectedCharacterId, currentCity?.id, resolveCurrentCity]
  );

  const updateSkills = useCallback(
    async (updates: Partial<PlayerSkills>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      if (!skills) {
        throw new Error("Skill data is not available.");
      }

      try {
        const { data, error }: PostgrestSingleResponse<PlayerSkills> = await supabase
          .from("player_skills")
          .update(updates)
          .eq("user_id", user.id)
          .eq("profile_id", skills.profile_id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error("No skill data returned from Supabase.");
        }

        setSkills(data);
        return data;
      } catch (updateError) {
        console.error("Error updating skills:", updateError);
        throw updateError;
      }
    },
    [selectedCharacterId, skills, user]
  );

  const updateAttributes = useCallback(
    async (updates: Partial<PlayerAttributes>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      if (!attributes) {
        throw new Error("Attribute data is not available.");
      }

      try {
        const { data, error }: PostgrestSingleResponse<PlayerAttributes> = await supabase
          .from("player_attributes")
          .update(updates)
          .eq("user_id", user.id)
          .eq("profile_id", attributes.profile_id)
          .select()
          .single();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error("No attribute data returned from Supabase.");
        }

        setAttributes(data);
        return data;
      } catch (updateError) {
        console.error("Error updating attributes:", updateError);
        throw updateError;
      }
    },
    [attributes, selectedCharacterId, user]
  );

  const addActivity = useCallback(
    async (
      activityType: string,
      message: string,
      earnings: number = 0,
      metadata?: ActivityItem["metadata"]
    ) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const { data, error: insertError }: PostgrestSingleResponse<ActivityItem> = await supabase
        .from("activity_feed")
        .insert({
          user_id: user.id,
          profile_id: selectedCharacterId,
          activity_type: activityType,
          message,
          earnings,
          metadata: metadata ?? null
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error adding activity:", insertError);
        throw insertError;
      }

      if (!data) {
        throw new Error("No activity data returned from Supabase.");
      }

      setActivities(prev => [data, ...prev.slice(0, 9)]);
      return data;
    },
    [user, selectedCharacterId]
  );

  const createCharacter = useCallback(
    async ({
      username,
      displayName,
      slotNumber,
      unlockCost,
      makeActive = false
    }: CreateCharacterInput) => {
      if (!user) {
        throw new Error("You must be signed in to create a character.");
      }

      setCharactersLoading(true);

      try {
        if (unlockCost > 0) {
          if (!profile || (profile.cash ?? 0) < unlockCost) {
            throw new Error("You do not have enough cash to unlock this character slot.");
          }

          await updateProfile({ cash: (profile.cash ?? 0) - unlockCost });
        }

        const { data: newProfile, error: profileInsertError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            username,
            display_name: displayName,
            slot_number: slotNumber,
            unlock_cost: unlockCost,
            is_active: makeActive
          })
          .select()
          .single();

        if (profileInsertError) throw profileInsertError;
        if (!newProfile) throw new Error("Failed to create character profile.");

        const { error: skillsInsertError } = await supabase
          .from("player_skills")
          .insert({
            user_id: user.id,
            profile_id: newProfile.id
          });

        if (skillsInsertError) throw skillsInsertError;

        const { error: attributesInsertError } = await supabase
          .from("player_attributes")
          .insert({
            user_id: user.id,
            profile_id: newProfile.id
          });

        if (attributesInsertError) throw attributesInsertError;

        setCharacters(prev => sortCharacters([...prev, newProfile]));

        if (makeActive || !selectedCharacterId) {
          await setActiveCharacter(newProfile.id);
        }

        return newProfile;
      } catch (err) {
        console.error("Error creating character:", err);
        setError(extractErrorMessage(err));
        throw err;
      } finally {
        setCharactersLoading(false);
      }
    },
    [
      user,
      profile,
      updateProfile,
      selectedCharacterId,
      setActiveCharacter
    ]
  );

  const refreshCharacters = useCallback(async () => fetchCharacters(), [fetchCharacters]);

  const refetch = useCallback(async () => {
    await fetchGameData();
  }, [fetchGameData]);

  const resetCharacter = useCallback(async () => {
    await fetchGameData();
  }, [fetchGameData]);

  useEffect(() => {
    void fetchCharacters();
  }, [fetchCharacters]);

  useEffect(() => {
    void fetchGameData();
  }, [fetchGameData]);

  const hasCharacters = useMemo(() => characters.length > 0, [characters]);
  const loading = useMemo(
    () => charactersLoading || dataLoading,
    [charactersLoading, dataLoading]
  );

  return {
    characters,
    selectedCharacterId,
    profile,
    skills,
    attributes,
    activities,
    currentCity,
    loading,
    error,
    hasCharacters,
    setActiveCharacter,
    clearSelectedCharacter,
    updateProfile,
    updateSkills,
    updateAttributes,
    addActivity,
    createCharacter,
    refreshCharacters,
    resetCharacter,
    refetch
  };
};

export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useProvideGameData();
  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useGameData = (): GameDataContextValue => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error("useGameData must be used within a GameDataProvider");
  }
  return context;
};
