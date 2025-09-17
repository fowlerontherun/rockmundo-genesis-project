import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type {
  PostgrestError,
  PostgrestMaybeSingleResponse,
  PostgrestSingleResponse
} from "@supabase/supabase-js";

export type PlayerProfile = Tables<"profiles">;
export type PlayerSkills = Tables<"player_skills">;
export type PlayerAttributes = Tables<"player_attributes">;
export type ActivityItem = Tables<"activity_feed">;

const CHARACTER_STORAGE_KEY = "rockmundo:selectedCharacterId";

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

export interface CreateCharacterInput {
  username: string;
  displayName?: string;
  slotNumber: number;
  unlockCost: number;
  makeActive?: boolean;
}

interface GameDataContextValue {
  characters: PlayerProfile[];
  selectedCharacterId: string | null;
  profile: PlayerProfile | null;
  skills: PlayerSkills | null;
  attributes: PlayerAttributes | null;
  activities: ActivityItem[];
  currentCity: Tables<"cities"> | null;
  loading: boolean;
  error: string | null;
  currentCity: Tables<'cities'> | null;
  hasCharacters: boolean;
  setActiveCharacter: (characterId: string) => Promise<void>;
  clearSelectedCharacter: () => void;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | undefined>;
  updateSkills: (updates: Partial<PlayerSkills>) => Promise<PlayerSkills | undefined>;
  updateAttributes: (updates: Partial<PlayerAttributes>) => Promise<PlayerAttributes | undefined>;
  addActivity: (
    activityType: string,
    message: string,
    earnings?: number,
    metadata?: ActivityItem["metadata"]
  ) => Promise<ActivityItem | undefined>;
  createCharacter: (input: CreateCharacterInput) => Promise<PlayerProfile>;
  refreshCharacters: () => Promise<PlayerProfile[]>;
  resetCharacter: () => Promise<void>;
  refetch: () => Promise<void>;
  resetCharacter: () => Promise<void>;
}

const GameDataContext = createContext<GameDataContextValue | undefined>(undefined);
const getStoredCharacterId = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CHARACTER_STORAGE_KEY);
};

const persistSelectedCharacterId = (characterId: string | null) => {
  if (typeof window === "undefined") return;
  if (!characterId) {
    window.localStorage.removeItem(CHARACTER_STORAGE_KEY);
  } else {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, characterId);
  }
};

const sortCharacters = (characters: PlayerProfile[]) =>
  [...characters].sort((a, b) => a.slot_number - b.slot_number);

const loadStoredCharacterId = () => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CHARACTER_STORAGE_KEY);
};

const useProvideGameData = (): GameDataContextValue => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    () => loadStoredCharacterId()
  );
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentCity, setCurrentCity] = useState<Tables<"cities"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const persistSelectedCharacterId = useCallback((characterId: string | null) => {
    if (typeof window === "undefined") return;
    if (characterId) {
      localStorage.setItem(CHARACTER_STORAGE_KEY, characterId);
    } else {
      localStorage.removeItem(CHARACTER_STORAGE_KEY);
    }
  }, []);

  const clearSelectedCharacter = useCallback(() => {
    setSelectedCharacterId(null);
    persistSelectedCharacterId(null);
    setProfile(null);
    setSkills(null);
    setAttributes(null);
    setActivities([]);
    setCurrentCity(null);
  }, [persistSelectedCharacterId]);

  const updateSelectedCharacterId = useCallback(
    (characterId: string | null) => {
      setSelectedCharacterId(characterId);
      persistSelectedCharacterId(characterId);
    },
    [persistSelectedCharacterId]
  );

  const resolveCurrentCity = useCallback(
    async (cityId: string | null) => {
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

      const hasStoredCharacter = selectedCharacterId
        ? list.some(character => character.id === selectedCharacterId)
        : false;
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStoredSelection
        ? selectedCharacterId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (fallbackId !== selectedCharacterId) {
        updateSelectedCharacterId(fallbackId ?? null);
      }

      if (!fallbackId) {
        setProfile(null);
        setSkills(null);
        setAttributes(null);
        setActivities([]);
        setCurrentCity(null);
      }

      return list;
    } catch (err) {
      console.error("Error fetching characters:", err);
      setError(extractErrorMessage(err));
      return [] as PlayerProfile[];
    } finally {
      setCharactersLoading(false);
    }
  }, [user, selectedCharacterId, clearSelectedCharacter, setSelectedCharacter]);

  const fetchGameData = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setSkills(null);
      setAttributes(null);
      setActivities([]);
      setCurrentCity(null);
      setError(null);
      setDataLoading(false);
      return;
    }

    const cityData = data ?? null;
    setCurrentCity(cityData);
    return cityData;
  }, []);

  const fetchGameData = useCallback(async () => {
    if (!user || !selectedCharacterId) {
      setProfile(null);
      setSkills(null);
      setAttributes(null);
      setActivities([]);
      setCurrentCity(null);
      setDataLoading(false);
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
      if (!profileRow) throw new Error('The selected character could not be found.');

      setProfile(profileRow);
      void fetchCity(profileRow.current_city_id ?? null);

      const { data: skillsRow, error: skillsError } = await supabase
        .from('player_skills')
        .select('*')
        .eq('profile_id', selectedCharacterId)
        .maybeSingle();

      if (skillsError && !isNotFoundError(skillsError)) throw skillsError;

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
    updateSelectedCharacterId,
    fetchCharacters,
    resolveCurrentCity
  ]);

  useEffect(() => {
    if (!user) {
      clearSelectedCharacter();
      setCharacters([]);
      return;
    }

    void fetchCharacters();
  }, [user, clearSelectedCharacter, fetchCharacters]);

  useEffect(() => {
    if (!selectedCharacterId || !user) {
      setProfile(null);
      setSkills(null);
      setAttributes(null);
      setActivities([]);
      setCurrentCity(null);
      setError(null);
      setCharactersLoading(false);
      setDataLoading(false);
      clearSelectedCharacter();
      return;
    }

    void fetchCharacters();
  }, [user, fetchCharacters, clearSelectedCharacter]);

  // The attribute map synchronization logic lives in a dedicated helper now.
  // Legacy code retained here for reference:
  // const valueByAttributeId = new Map((data ?? []).map(entry => [entry.attribute_id, entry.value]));
  // const nextAttributes: AttributesMap = { ...attributes };
  // payload.forEach(item => {
  //   const latestValue = valueByAttributeId.get(item.definition.id) ?? item.row.value;
  //   nextAttributes[item.definition.slug] = {
  //     definition: item.definition,
  //     value: latestValue
  //   };
  // });
  // setAttributes(nextAttributes);
  // return nextAttributes;

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
    [user, profile, updateProfile, selectedCharacterId, setActiveCharacter]
  );

  const refreshCharacters = useCallback(async () => fetchCharacters(), [fetchCharacters]);
  const refetch = useCallback(async () => {
    await fetchGameData();
  }, [fetchGameData]);

  const resetCharacter = useCallback(async () => {
    await fetchGameData();
  }, [fetchGameData]);

  const hasCharacters = useMemo(() => characters.length > 0, [characters]);
  const loading = useMemo(() => charactersLoading || dataLoading, [charactersLoading, dataLoading]);

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
    refetch,
    resetCharacter,
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
