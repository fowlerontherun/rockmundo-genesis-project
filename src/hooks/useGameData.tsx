import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import { ensureDefaultWardrobe, parseClothingLoadout } from "@/utils/wardrobe";
import type {
  PostgrestError,
  PostgrestMaybeSingleResponse,
  PostgrestSingleResponse
} from "@supabase/supabase-js";

export type PlayerProfile = Tables<"profiles">;
export type PlayerSkills = Tables<"player_skills">;
export type PlayerAttributes = Tables<"player_attributes">;
export type ActivityItem = Tables<"activity_feed">;
type City = Tables<"cities">;

const CHARACTER_STORAGE_KEY = "rockmundo:selectedCharacterId";

const isPostgrestError = (error: unknown): error is PostgrestError =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  "code" in error;

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
  currentCity: City | null;
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
  refetch: () => Promise<void>;
  resetCharacter: () => Promise<void>;
}

const GameDataContext = createContext<GameDataContextValue | undefined>(undefined);

const sortCharacters = (characters: PlayerProfile[]) =>
  [...characters].sort((a, b) => a.slot_number - b.slot_number);

const getStoredSelectedCharacterId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
  return storedValue ?? null;
};

const useProvideGameData = (): GameDataContextValue => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => readStoredCharacterId());
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentCity, setCurrentCity] = useState<City | null>(null);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSelectedCharacterId = useCallback((characterId: string | null) => {
    setSelectedCharacterId(characterId);
    persistCharacterId(characterId);
  }, []);

  const clearSelectedCharacter = useCallback(() => {
    updateSelectedCharacterId(null);
  }, [updateSelectedCharacterId]);

  const resolveCurrentCity = useCallback(
    async (cityId: string | null) => {
      if (!cityId) {
        setCurrentCity(null);
        return null;
      }

      const {
        data,
        error: cityError,
        status
      }: PostgrestMaybeSingleResponse<City> = await supabase
        .from("cities")
        .select("*")
        .eq("id", cityId)
        .maybeSingle();

      if (cityError && status !== 406) {
        console.error("Error fetching current city:", cityError);
        return null;
      }

      const cityData = data ?? null;
      setCurrentCity(cityData);
      return cityData;
    },
    []
  );

  const ensureSkillsRecord = useCallback(
    async (profileId: string, userId: string): Promise<PlayerSkills> => {
      const {
        data,
        error,
        status
      }: PostgrestMaybeSingleResponse<PlayerSkills> = await supabase
        .from("player_skills")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        return data;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("player_skills")
        .insert({ profile_id: profileId, user_id: userId })
        .select()
        .single();

      if (insertError || !inserted) {
        throw insertError ?? new Error("Failed to create default skills record.");
      }

      return inserted;
    },
    []
  );

  const ensureAttributesRecord = useCallback(
    async (profileId: string): Promise<PlayerAttributes> => {
      const {
        data,
        error,
        status
      }: PostgrestMaybeSingleResponse<PlayerAttributes> = await supabase
        .from("player_attributes")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();

      if (error && status !== 406) {
        throw error;
      }

      if (data) {
        return data;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("player_attributes")
        .insert({ profile_id: profileId })
        .select()
        .single();

      if (insertError || !inserted) {
        throw insertError ?? new Error("Failed to create default attributes record.");
      }

      return inserted;
    },
    []
  );

  const fetchCharacters = useCallback(async () => {
    if (!user) {
      setCharacters([]);
      setCharactersLoading(false);
      clearSelectedCharacter();
      return [] as PlayerProfile[];
    }

    setCharactersLoading(true);

    try {
      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("slot_number", { ascending: true });

      if (profilesError) throw profilesError;

      const list = sortCharacters(data ?? []);
      setCharacters(list);

      const hasStoredCharacter = list.some(character => character.id === selectedCharacterId);
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStoredCharacter
        ? selectedCharacterId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (fallbackId !== selectedCharacterId) {
        updateSelectedCharacterId(fallbackId);
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
  }, [
    user,
    selectedCharacterId,
    updateSelectedCharacterId,
    clearSelectedCharacter
  ]);

  const refreshCharacters = useCallback(async () => {
    return fetchCharacters();
  }, [fetchCharacters]);

  const fetchGameData = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setSkills(null);
      setAttributes(null);
      setActivities([]);
      setCurrentCity(null);
      setDataLoading(false);
      setError(null);
      return;
    }

    if (!selectedCharacterId) {
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
      const {
        data: profileRow,
        error: profileError,
        status: profileStatus
      }: PostgrestMaybeSingleResponse<PlayerProfile> = await supabase
        .from("profiles")
        .select("*")
        .eq("id", selectedCharacterId)
        .maybeSingle();

      if (profileError && profileStatus !== 406) throw profileError;

      let character = profileRow ?? null;

      if (!character) {
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

      try {
        const loadout = parseClothingLoadout(character.equipped_clothing);
        if (!Object.keys(loadout).length) {
          const ensured = await ensureDefaultWardrobe(character.id, user.id, loadout);
          if (ensured) {
            character = {
              ...character,
              equipped_clothing: ensured as PlayerProfile["equipped_clothing"]
            };
          }
        }
      } catch (wardrobeError) {
        console.error("Failed to ensure default wardrobe:", wardrobeError);
      }

      setCharacters(prev => {
        const others = prev.filter(existing => existing.id !== character.id);
        return sortCharacters([...others, character]);
      });

      await resolveCurrentCity(character.current_city_id ?? null);

      const ensuredSkills = await ensureSkillsRecord(character.id, user.id);
      setSkills(ensuredSkills);
      const ensuredAttributes = await ensureAttributesRecord(character.id);
      setAttributes(ensuredAttributes);

      const { data: activityRows, error: activityError } = await supabase
        .from("activity_feed")
        .select("*")
        .eq("profile_id", character.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (activityError) throw activityError;

      setActivities(activityRows ?? []);
    } catch (err: unknown) {
      console.error("Error fetching game data:", err);
      setError(extractErrorMessage(err));
    } finally {
      setDataLoading(false);
    }
  }, [
    user,
    selectedCharacterId,
    ensureAttributesRecord,
    ensureSkillsRecord,
    fetchCharacters,
    resolveCurrentCity,
    updateSelectedCharacterId
  ]);

  useEffect(() => {
    if (!user) {
      setCharacters([]);
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

  useEffect(() => {
    if (!user || !selectedCharacterId) return;
    void fetchGameData();
  }, [user, selectedCharacterId, fetchGameData]);

  const setActiveCharacter = useCallback(
    async (characterId: string) => {
      if (!user) {
        throw new Error("You must be signed in to switch characters.");
      }

      setCharactersLoading(true);

      try {
        await supabase
          .from("profiles")
          .update({ is_active: false })
          .eq("user_id", user.id);

        const { data, error: activationError } = await supabase
          .from("profiles")
          .update({ is_active: true })
          .eq("id", characterId)
          .select()
          .single();

        if (activationError) throw activationError;

        updateSelectedCharacterId(characterId);
        if (data) {
          setCharacters(prev =>
            sortCharacters(
              prev.map(character =>
                character.id === data.id ? { ...character, ...data } : { ...character, is_active: character.id === characterId }
              )
            )
          );
          setProfile(data);
          await resolveCurrentCity(data.current_city_id ?? null);
        }
      } catch (err) {
        console.error("Error activating character:", err);
        setError(extractErrorMessage(err));
        throw err;
      } finally {
        setCharactersLoading(false);
      }
    },
    [user, updateSelectedCharacterId, resolveCurrentCity]
  );

  const updateProfile = useCallback(
    async (updates: Partial<PlayerProfile>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const { data, error: updateError }: PostgrestSingleResponse<PlayerProfile> = await supabase
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
      setCharacters(prev => sortCharacters(prev.map(character => (character.id === data.id ? data : character))));
      await resolveCurrentCity(data.current_city_id ?? null);
      return data;
    },
    [selectedCharacterId, user, resolveCurrentCity]
  );

  const updateSkills = useCallback(
    async (updates: Partial<PlayerSkills>) => {
      if (!user || !selectedCharacterId || !skills) {
        throw new Error("No active character selected.");
      }

      const { data, error: updateError }: PostgrestSingleResponse<PlayerSkills> = await supabase
        .from("player_skills")
        .update(updates)
        .eq("profile_id", selectedCharacterId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating skills:", updateError);
        throw updateError;
      }

      if (!data) {
        throw new Error("No skill data returned from Supabase.");
      }

      setSkills(data);
      return data;
    },
    [skills, selectedCharacterId, user]
  );

  const updateAttributes = useCallback(
    async (updates: Partial<PlayerAttributes>) => {
      if (!user || !selectedCharacterId || !attributes) {
        throw new Error("No active character selected.");
      }

      const { data, error: updateError }: PostgrestSingleResponse<PlayerAttributes> = await supabase
        .from("player_attributes")
        .update(updates)
        .eq("profile_id", selectedCharacterId)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating attributes:", updateError);
        throw updateError;
      }

      if (!data) {
        throw new Error("No attribute data returned from Supabase.");
      }

      setAttributes(data);
      return data;
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
    [selectedCharacterId, user]
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

        const { data: newSkills, error: skillsInsertError } = await supabase
          .from("player_skills")
          .insert({
            user_id: user.id,
            profile_id: newProfile.id
          })
          .select()
          .single();

        if (skillsInsertError) throw skillsInsertError;

        const { data: newAttributes, error: attributesInsertError } = await supabase
          .from("player_attributes")
          .insert({ profile_id: newProfile.id })
          .select()
          .single();

        if (attributesInsertError) throw attributesInsertError;

        setCharacters(prev => sortCharacters([...prev, newProfile]));

        if (makeActive || !selectedCharacterId) {
          await setActiveCharacter(newProfile.id);
          setSkills(newSkills ?? null);
          setAttributes(newAttributes ?? null);
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
    [profile, selectedCharacterId, setActiveCharacter, updateProfile, user]
  );

  const refreshCharacters = useCallback(async () => {
    return fetchCharacters();
  }, [fetchCharacters]);

  const refetch = useCallback(async () => {
    await fetchGameData();
  }, [fetchGameData]);

  const resetCharacter = useCallback(async () => {
    if (!user) {
      throw new Error("You must be signed in to reset a character.");
    }

    const { data, error: resetError } = await supabase.rpc("reset_player_character");

    if (resetError) {
      console.error("Error resetting character:", resetError);
      throw resetError;
    }

    const result = data?.[0];
    if (!result) {
      throw new Error("Reset did not return any character data.");
    }

    setProfile(result.profile);
    setSkills(result.skills);
    setAttributes(result.attributes);
    setActivities([]);
    updateSelectedCharacterId(result.profile.id);
    await resolveCurrentCity(result.profile.current_city_id ?? null);
    await fetchCharacters();
  }, [fetchCharacters, resolveCurrentCity, updateSelectedCharacterId, user]);

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
    resetCharacter
  };
};

export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useProvideGameData();
  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
};

export const useGameData = (): GameDataContextValue => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error("useGameData must be used within a GameDataProvider");
  }
  return context;
};
