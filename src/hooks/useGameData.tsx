import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type {
  PostgrestError,
  PostgrestMaybeSingleResponse,
  PostgrestResponse
} from "@supabase/supabase-js";

export type PlayerProfile = Tables<"profiles">;
export type PlayerSkills = Tables<"player_skills">;
export type PlayerAttributes = Tables<"player_attributes">;
export type ActivityItem = Tables<"activity_feed">;
export type AttributeDefinition = Tables<"attribute_definitions">;
export type ProfileAttribute = Tables<"profile_attributes">;

const CHARACTER_STORAGE_KEY = "rockmundo:selectedCharacterId";

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
  skillDefinitions: SkillDefinition[];
  skillProgress: SkillProgressRow[];
  unlockedSkills: UnlockedSkillsMap;
  skills: PlayerSkills;
  attributes: AttributesMap;
  activities: ActivityItem[];
  currentCity: Tables<"cities"> | null;
  loading: boolean;
  error: string | null;
  hasCharacters: boolean;
  skillDefinitions: SkillDefinition[];
  skillProgress: SkillProgressRow[];
  skillUnlocks: SkillUnlockRow[];
  setActiveCharacter: (characterId: string) => Promise<void>;
  clearSelectedCharacter: () => void;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | undefined>;
  updateSkills: (updates: Partial<PlayerSkills>) => Promise<PlayerSkills | undefined>;
  updateAttributes: (updates: Partial<PlayerAttributes>) => Promise<PlayerAttributes | undefined>;
  addActivity: (
    activityType: string,
    message: string,
    earnings?: number
  ) => Promise<ActivityItem | undefined>;
  createCharacter: (input: CreateCharacterInput) => Promise<PlayerProfile>;
  refreshCharacters: () => Promise<PlayerProfile[]>;
  refetch: () => Promise<void>;
  resetCharacter: () => Promise<void>;
  upsertSkillProgress: (
    profileId: string,
    entries: SkillProgressUpsertInput[]
  ) => Promise<SkillProgressRow[]>;
  upsertSkillUnlocks: (
    profileId: string,
    entries: SkillUnlockUpsertInput[]
  ) => Promise<SkillUnlockRow[]>;
}

const GameDataContext = createContext<GameDataContextValue | undefined>(undefined);

const readStoredCharacterId = () => {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
  return value ?? null;
};

const writeStoredCharacterId = (characterId: string | null) => {
  if (typeof window === "undefined") return;
  if (characterId) {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, characterId);
  } else {
    window.localStorage.removeItem(CHARACTER_STORAGE_KEY);
  }
};

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

const matchProgressToDefinition = (
  progress: SkillProgressRow,
  definition: SkillDefinition
) => progress.skill_id === definition.id || progress.skill_slug === definition.slug;

const useProvideGameData = (): GameDataContextValue => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => readStoredCharacterId());
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinition[]>([]);
  const [skillProgress, setSkillProgress] = useState<SkillProgressRow[]>([]);
  const [skillUnlockRows, setSkillUnlockRows] = useState<SkillUnlockRow[]>([]);
  const [skillsUpdatedAt, setSkillsUpdatedAt] = useState<string | null>(null);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [attributes, setAttributes] = useState<AttributesMap>({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentCity, setCurrentCity] = useState<Tables<"cities"> | null>(null);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearGameState = useCallback(() => {
    setProfile(null);
    setSkills(null);
    setAttributes(null);
    setActivities([]);
    setCurrentCity(null);
  }, []);

  const fetchCharacters = useCallback(async () => {
    if (!user) {
      setCharacters([]);
      setSelectedCharacterId(null);
      clearGameState();
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

      const list = data ?? [];
      setCharacters(list);

      const hasStored = selectedCharacterId && list.some(character => character.id === selectedCharacterId);
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStored
        ? selectedCharacterId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (fallbackId !== selectedCharacterId) {
        setSelectedCharacterId(fallbackId);
        writeStoredCharacterId(fallbackId);
      }

      if (!fallbackId) {
        clearGameState();
      }

      return list;
    } catch (err: unknown) {
      console.error("Error fetching characters:", err);
      setError(extractErrorMessage(err));
      return [] as PlayerProfile[];
    } finally {
      setCharactersLoading(false);
  }, [user, selectedCharacterId, clearGameState]);

  const resolveCurrentCity = useCallback(
    async (cityId: string | null) => {
      if (!cityId) {
        setCurrentCity(null);
        return;
      }

      const { data, error: cityError, status } = await supabase
        .from("cities")
        .select("*")
        .eq("id", cityId)
        .maybeSingle();

      if (cityError && status !== 406) {
        console.error("Error fetching current city:", cityError);
        return;
      }

      setCurrentCity(data ?? null);
    },
    []
  );

  const fetchGameData = useCallback(async () => {
    if (!user || !selectedCharacterId) {
      clearGameState();
      setDataLoading(false);
      setError(null);
      return;
    }

    setDataLoading(true);
    setError(null);

    try {
      const [
        profileResponse,
        skillsResponse,
        attributeDefinitionsResponse,
        profileAttributesResponse,
        activityResponse,
        skillDefinitionsResponse,
        skillProgressResponse,
        skillUnlocksResponse
      ] = (await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", selectedCharacterId)
          .maybeSingle(),
        supabase
          .from("player_skills")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .maybeSingle(),
        supabase.from("attribute_definitions").select("*").order("slug", { ascending: true }),
        supabase.from("profile_attributes").select("*").eq("profile_id", selectedCharacterId),
        supabase
          .from("activity_feed")
          .select("*")
          .eq("profile_id", selectedCharacterId)
          .order("created_at", { ascending: false })
          .limit(10)
      ])) as [
        PostgrestMaybeSingleResponse<PlayerProfile>,
        PostgrestMaybeSingleResponse<PlayerSkills>,
        PostgrestResponse<AttributeDefinition>,
        PostgrestResponse<ProfileAttribute>,
        PostgrestResponse<ActivityItem>,
        PostgrestResponse<SkillDefinition>,
        PostgrestResponse<SkillProgressRow>,
        PostgrestResponse<SkillUnlockRow>
      ];

      if (profileResponse.error && profileResponse.status !== 406) {
        throw profileResponse.error;
      }

      const character = profileResponse.data ?? null;

      if (!character) {
        clearGameState();
        setError("The selected character could not be found.");
        setSelectedCharacterId(null);
        writeStoredCharacterId(null);
        await fetchCharacters();
        return;
      }

      setProfile(character);
      await resolveCurrentCity(character.current_city_id ?? null);

      if (skillsResponse.error && skillsResponse.status !== 406) {
        throw skillsResponse.error;
      }

      let skillsData = skillsResponse.data ?? null;

      if (!skillsData) {
        const { data: insertedSkills, error: insertSkillsError } = await supabase
          .from("player_skills")
          .insert({
            user_id: character.user_id,
            profile_id: character.id
          })
          .select()
          .single();

        if (insertSkillsError) throw insertSkillsError;
        skillsData = insertedSkills;
      }

      setSkills(skillsData);

      const definitions = attributeDefinitionsResponse.data ?? [];
      setAttributeDefinitions(definitions);

      const profileAttributeRows = profileAttributesResponse.data ?? [];
      const definitionById = new Map(definitions.map(definition => [definition.id, definition]));

      const resolvedAttributes = profileAttributeRows.reduce<Record<string, number>>((acc, row) => {
        const definition = definitionById.get(row.attribute_id);
        if (definition) {
          acc[definition.slug] = Number(row.value ?? definition.default_value ?? 0);
        }
        return acc;
      }, {});

      const { data: attributeRows, error: attributesError } = await supabase
        .from("player_attributes")
        .select("*")
        .eq("profile_id", selectedCharacterId);

      if (attributesError && attributesError.code !== "PGRST116") throw attributesError;

      if (skillUnlocksResponse.error) {
        throw skillUnlocksResponse.error;
      }

      if (!attributesData) {
        const { data: insertedAttributes, error: insertAttributesError } = await supabase
          .from("player_attributes")
          .insert({
            user_id: character.user_id,
            profile_id: character.id,
            attribute_points: 0,
            mental_focus: resolvedAttributes["mental_focus"] ?? 0,
            physical_endurance: resolvedAttributes["physical_endurance"] ?? 0
          })
          .select()
          .single();

        if (insertAttributesError) throw insertAttributesError;
        attributesData = insertedAttributes;
      }

      setAttributes(attributesData);

  const updateSkillLevel = useCallback(
    async (skillSlug: string, level: number, experience: number = 0) => {
      if (!user) {
        throw new Error("You must be signed in to update skills.");
      }

      setActivities(activityResponse.data ?? []);
    } catch (err) {
      console.error("Error fetching game data:", err);
      setError(extractErrorMessage(err));
    } finally {
      setDataLoading(false);
    }
  }, [
    user,
    selectedCharacterId,
    clearGameState,
    fetchCharacters,
    resolveCurrentCity
  ]);

  useEffect(() => {
    if (!user) {
      setCharacters([]);
      setSelectedCharacterId(null);
      writeStoredCharacterId(null);
      clearGameState();
      setError(null);
      setCharactersLoading(false);
      setDataLoading(false);
      return;
    }

    void fetchCharacters();
  }, [clearGameState, fetchCharacters, user]);

  useEffect(() => {
    writeStoredCharacterId(selectedCharacterId);
    void fetchGameData();
  }, [fetchGameData, selectedCharacterId]);

  const setActiveCharacter = useCallback(
    async (characterId: string) => {
      if (!user) {
        throw new Error("You must be signed in to select a character.");
      }

      setSelectedCharacterId(characterId);
      writeStoredCharacterId(characterId);

      try {
        await supabase
          .from("profiles")
          .update({ is_active: false })
          .eq("user_id", user.id);

        await supabase
          .from("profiles")
          .update({ is_active: true })
          .eq("id", characterId);
      } catch (err) {
        console.error("Error setting active character:", err);
      }

      await fetchGameData();
    },
    [user, fetchGameData]
  );

  const clearSelectedCharacter = useCallback(() => {
    setSelectedCharacterId(null);
    writeStoredCharacterId(null);
    clearGameState();
  }, [clearGameState]);

  const updateProfile = useCallback(
    async (updates: Partial<PlayerProfile>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const payload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString()
      };

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", selectedCharacterId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw updateError;
      }

      const nextProfile = data ?? (profile ? { ...profile, ...payload } : null);
      setProfile(nextProfile);
      return nextProfile ?? undefined;
    },
    [profile, selectedCharacterId, user]
  );

  const updateSkills = useCallback(
    async (updates: Partial<PlayerSkills>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const payload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString()
      };

      const { data, error: updateError } = await supabase
        .from("player_skills")
        .update(payload)
        .eq("profile_id", selectedCharacterId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("Error updating skills:", updateError);
        throw updateError;
      }

      const nextSkills = data ?? (skills ? { ...skills, ...payload } : null);
      setSkills(nextSkills);
      return nextSkills ?? undefined;
    },
    [selectedCharacterId, skills, user]
  );

  const updateAttributes = useCallback(
    async (updates: Partial<PlayerAttributes>) => {
      if (!user || !selectedCharacterId) {
        throw new Error("No active character selected.");
      }

      const payload = {
        ...updates,
        updated_at: updates.updated_at ?? new Date().toISOString()
      };

      try {
        const { data, error: updateError } = await supabase
          .from("player_attributes")
          .update(payload)
          .eq("profile_id", selectedCharacterId)
          .select()
          .maybeSingle();

        if (updateError) {
          throw updateError;
        }

        const nextAttributes = data ?? (attributes ? { ...attributes, ...payload } : null);
        setAttributes(nextAttributes);
        return nextAttributes;
      } catch (updateError) {
        console.error("Error updating attributes:", updateError);
        throw updateError;
      }
    },
    [attributes, selectedCharacterId, user]
  );

  const setSkillUnlocked = useCallback(
    async (skillSlug: string, unlocked: boolean) => {
      if (!user) {
        throw new Error("You must be signed in to update skill unlocks.");
      }

      const activeProfileId = selectedCharacterId;
      if (!activeProfileId) {
        throw new Error("No active character selected.");
      }

      const definition = skillDefinitions.find(def => def.slug === skillSlug || def.id === skillSlug);
      if (!definition) {
        throw new Error(`Unknown skill: ${skillSlug}`);
      }

      if (unlocked) {
        const { data, error: upsertError } = await supabase
          .from("profile_skill_unlocks")
          .upsert(
            {
              profile_id: activeProfileId,
              skill_id: definition.id
            },
            { onConflict: "profile_id,skill_id" }
          )
          .select()
          .single();
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

        const { error: skillsInsertError } = await supabase
          .from("player_skills")
          .insert({
            user_id: user.id,
            profile_id: newProfile.id
          });

          await Promise.all([
            upsertSkillProgress(newProfile.id, defaultProgressEntries),
            upsertSkillUnlocks(newProfile.id, defaultUnlockEntries)
          ]);
        } else {
          setSkillProgress([]);
          setSkillUnlocks([]);
        }

        const { error: attributesInsertError } = await supabase
          .from("player_attributes")
          .insert({
            user_id: user.id,
            profile_id: newProfile.id
          });

        if (attributesInsertError) throw attributesInsertError;

        setCharacters(prev => [...prev, newProfile]);

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
    [profile, selectedCharacterId, setActiveCharacter, updateProfile, user]
  );

  const refreshCharacters = useCallback(() => fetchCharacters(), [fetchCharacters]);

  const refetch = useCallback(() => fetchGameData(), [fetchGameData]);

  const resetCharacter = useCallback(async () => {
    if (!user) {
      throw new Error("You must be signed in to reset a character.");
    }

    const { data, error: resetError } = await supabase.rpc('reset_player_character');

    if (resetError) {
      console.error('Error resetting character:', resetError);
      throw resetError;
    }

    const nextProfileId = Array.isArray(data) && data.length > 0 ? data[0]?.profile?.id ?? null : null;
    if (nextProfileId) {
      setSelectedCharacterId(nextProfileId);
      writeStoredCharacterId(nextProfileId);
    } else {
      clearSelectedCharacter();
    }

    await fetchCharacters();
    await fetchGameData();
  }, [clearSelectedCharacter, fetchCharacters, fetchGameData, user]);

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
    refetch,
    resetCharacter,
    upsertSkillProgress,
    upsertSkillUnlocks
  };
};

export const GameDataProvider = ({ children }: { children: ReactNode }) => {
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
