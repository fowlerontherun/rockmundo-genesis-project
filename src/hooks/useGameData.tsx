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
export type SkillDefinition = Tables<"skill_definitions">;
export type SkillProgressRow = Tables<"profile_skill_progress">;
export type SkillUnlockRow = Tables<"profile_skill_unlocks">;
export type ActivityItem = Tables<"activity_feed">;
export type AttributeDefinition = Tables<"attribute_definitions">;
export type ProfileAttribute = Tables<"profile_attributes">;

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
const matchProgressToDefinition = (
  progress: SkillProgressRow,
  definition: SkillDefinition
) => progress.skill_id === definition.id || progress.skill_slug === definition.slug;

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
    persistCharacterId(null);
    setSelectedCharacterId(null);
    persistCharacterId(null);
    setProfile(null);
    setSkillDefinitions([]);
    setSkillProgress([]);
    setSkillUnlockRows([]);
    setSkillsUpdatedAt(null);
    setAttributeDefinitions([]);
    setAttributes({});
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
        status
      }: PostgrestMaybeSingleResponse<Tables<"cities">> = await supabase
        .from("cities")
        .select("*")
        .eq("id", cityId)
        .maybeSingle();

      if (cityError && cityStatus !== 406) {
        console.error("Error fetching current city:", cityError);
        return null;
      }

      const city = data ?? null;
      setCurrentCity(city);
      return city;
    },
    []
  );

  const fetchCharacters = useCallback(async () => {
    if (!user) {
      setCharacters([]);
      clearSelectedCharacter();
      setCharactersLoading(false);
      setError(null);
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

      const list = (data ?? []) as PlayerProfile[];
      setCharacters(list);

      const hasStoredSelection = selectedCharacterId
        ? list.some(character => character.id === selectedCharacterId)
        : false;
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStoredCharacter
        ? storedId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (!fallbackId) {
        clearSelectedCharacter();
      } else if (fallbackId !== selectedCharacterId) {
        updateSelectedCharacterId(fallbackId);
      }

      return list;
    } catch (err: unknown) {
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
        const [
          profileResponse,
          skillDefinitionsResponse,
          skillProgressResponse,
          skillUnlocksResponse,
          attributeDefinitionsResponse,
          profileAttributesResponse,
          activityResponse
        ] = (await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", activeCharacterId)
            .maybeSingle(),
          supabase.from("skill_definitions").select("*").order("display_order", { ascending: true }),
          supabase
            .from("profile_skill_progress")
            .select("*")
            .eq("profile_id", activeCharacterId),
          supabase
            .from("profile_skill_unlocks")
            .select("*")
            .eq("profile_id", activeCharacterId),
          supabase.from("attribute_definitions").select("*").order("slug", { ascending: true }),
          supabase
            .from("profile_attributes")
            .select("*")
            .eq("profile_id", activeCharacterId),
          supabase
            .from("activity_feed")
            .select("*")
            .eq("profile_id", activeCharacterId)
            .order("created_at", { ascending: false })
            .limit(10)
        ])) as [
          PostgrestMaybeSingleResponse<PlayerProfile>,
          PostgrestResponse<SkillDefinition>,
          PostgrestResponse<SkillProgressRow>,
          PostgrestResponse<SkillUnlockRow>,
          PostgrestResponse<AttributeDefinition>,
          PostgrestResponse<ProfileAttribute>,
          PostgrestResponse<ActivityItem>
        ];

        if (profileResponse.error && profileResponse.status !== 406) {
          throw profileResponse.error;
        }

      if (profileError) throw profileError;

        const attributeDefs = attributeDefinitionsResponse.data ?? [];
        setAttributeDefinitions(attributeDefs);
        const profileAttributeRows = profileAttributesResponse.data ?? [];
        setAttributes(buildAttributeMap(attributeDefs, profileAttributeRows));

        if (activityResponse.error && activityResponse.status !== 406) {
          throw activityResponse.error;
        }
        setActivities(activityResponse.data ?? []);
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
        .maybeSingle();

      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw updateError;
      }

      if (!data) {
        throw new Error("No profile data returned from Supabase.");
      }

      return nextProfile;
    },
    [selectedCharacterId, user]
  );

  const updateSkillLevel = useCallback(
    async (skillSlug: string, level: number, experience: number = 0) => {
      if (!user) {
        throw new Error("You must be signed in to update skills.");
      }

      const activeProfileId = selectedCharacterId;
      if (!activeProfileId) {
        throw new Error("No active character selected.");
      }

      const definition = skillDefinitions.find(def => def.slug === skillSlug || def.id === skillSlug);
      if (!definition) {
        throw new Error(`Unknown skill: ${skillSlug}`);
      }

      const { data, error: upsertError } = await supabase
        .from("profile_skill_progress")
        .upsert(
          {
            profile_id: activeProfileId,
            skill_id: definition.id,
            current_level: level,
            current_experience: experience
          },
          { onConflict: "profile_id,skill_id" }
        )
        .select()
        .single();

      if (upsertError) {
        console.error("Error updating skill progress:", upsertError);
        throw upsertError;
      }

      if (data) {
        const normalized = {
          ...data,
          skill_slug: data.skill_slug ?? definition.slug
        } as SkillProgressRow;

        setSkillProgress(prev => {
          const others = prev.filter(row => !(row.profile_id === activeProfileId && row.skill_id === definition.id));
          return [...others, normalized];
        });
        const timestamp = normalized.updated_at ?? normalized.created_at ?? new Date().toISOString();
        setSkillsUpdatedAt(prev => (!prev || timestamp > prev ? timestamp : prev));
      }
    },
    [selectedCharacterId, skillDefinitions, user]
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

        if (upsertError) {
          console.error("Error unlocking skill:", upsertError);
          throw upsertError;
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
    [selectedCharacterId, skillDefinitions, user]
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
      if (!user) {
        throw new Error("You must be signed in to add activities.");
      }

      const activeProfileId = selectedCharacterId;
      if (!activeProfileId) {
        throw new Error("No active character selected.");
      }

      const { data, error: insertError } = await supabase
        .from("activity_feed")
        .insert({
          user_id: user.id,
          profile_id: activeProfileId,
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

      setActivities(prev => [data, ...prev.slice(0, 9)]);
      return data;
    },
    [selectedCharacterId, user]
  );

  const setActiveCharacter = useCallback(
    async (characterId: string) => {
      if (!user) {
        throw new Error("You must be signed in to select a character.");
      }

      setError(null);

      try {
        await supabase
          .from("profiles")
          .update({ is_active: false })
          .eq("user_id", user.id);

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ is_active: true })
          .eq("id", characterId);

        if (updateError) throw updateError;

        updateSelectedCharacterId(characterId);
        await fetchGameData(characterId);
      } catch (err: unknown) {
        console.error("Error setting active character:", err);
        const message = extractErrorMessage(err);
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [fetchGameData, updateSelectedCharacterId, user]
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
        if (attributeDefinitions.length > 0) {
          const attributePayload = attributeDefinitions.map(definition => ({
            profile_id: newProfile.id,
            attribute_id: definition.id,
            value: definition.default_value
          }));

          const { error: attributeInsertError } = await supabase
            .from("profile_attributes")
            .upsert(attributePayload, { onConflict: "profile_id,attribute_id" });

        if (attributesInsertError) throw attributesInsertError;

        setCharacters(prev => [...prev, newProfile].sort((a, b) => a.slot_number - b.slot_number));

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
    if (!user) {
      throw new Error("You must be signed in to reset a character.");
    }

    const { data, error: resetError } = await supabase.rpc("reset_player_character");

    if (resetError) {
      console.error("Error resetting character:", resetError);
      throw resetError;
    }

    const nextProfileId = Array.isArray(data) && data.length > 0 ? data[0]?.profile?.id ?? null : null;
    if (nextProfileId) {
      updateSelectedCharacterId(nextProfileId);
      await fetchGameData(nextProfileId);
    } else {
      clearSelectedCharacter();
    }

    await fetchCharacters();
  }, [clearSelectedCharacter, fetchCharacters, fetchGameData, updateSelectedCharacterId, user]);

  const unlockedSkills = useMemo<UnlockedSkillsMap>(() => {
    if (skillUnlockRows.length === 0) return {};

    return skillUnlockRows.reduce<UnlockedSkillsMap>((accumulator, row) => {
      const definition = skillDefinitions.find(def => matchProgressToDefinition(row, def));
      if (definition) {
        accumulator[definition.slug] = true;
      }
      return accumulator;
    }, {});
  }, [skillDefinitions, skillUnlockRows]);

  const skills = useMemo<PlayerSkills>(() => {
    if (skillDefinitions.length === 0) {
      return { updated_at: skillsUpdatedAt ?? null } as PlayerSkills;
    }

    let latestTimestamp = skillsUpdatedAt ?? null;
    const result: PlayerSkills = { updated_at: latestTimestamp ?? null } as PlayerSkills;

    skillDefinitions.forEach(definition => {
      const progressRow = skillProgress.find(row => matchProgressToDefinition(row, definition));
      result[definition.slug] = progressRow?.current_level ?? 0;
      const candidate = progressRow?.updated_at ?? progressRow?.created_at ?? null;
      if (candidate && (!latestTimestamp || candidate > latestTimestamp)) {
        latestTimestamp = candidate;
      }
    });

    result.updated_at = latestTimestamp ?? null;
    return result;
  }, [skillDefinitions, skillProgress, skillsUpdatedAt]);

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
    skillDefinitions,
    skillProgress,
    unlockedSkills,
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
    updateSkillLevel,
    setSkillUnlocked,
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
