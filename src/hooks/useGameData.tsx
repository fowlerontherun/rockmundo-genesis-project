import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type { PostgrestError, PostgrestMaybeSingleResponse, PostgrestResponse } from "@supabase/supabase-js";

export type PlayerProfile = Tables<"profiles">;
export type SkillDefinition = Tables<"skill_definitions">;
export type SkillProgressRow = Tables<"profile_skill_progress">;
export type SkillUnlockRow = Tables<"profile_skill_unlocks">;
export type ActivityItem = Tables<"activity_feed">;
export type AttributeDefinition = Tables<"attribute_definitions">;
export type ProfileAttribute = Tables<"profile_attributes">;

const CHARACTER_STORAGE_KEY = "rockmundo:selectedCharacterId";

interface AttributeEntry {
  definition: AttributeDefinition;
  value: number;
}

export type AttributesMap = Record<string, AttributeEntry>;
export type PlayerSkills = Record<string, number> & { updated_at?: string | null };
export type UnlockedSkillsMap = Record<string, boolean>;

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
  setActiveCharacter: (characterId: string) => Promise<void>;
  clearSelectedCharacter: () => void;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | null>;
  updateSkillLevel: (skillSlug: string, level: number, experience?: number) => Promise<void>;
  setSkillUnlocked: (skillSlug: string, unlocked: boolean) => Promise<void>;
  updateSkills: (updates: Partial<PlayerSkills>) => Promise<PlayerSkills>;
  updateAttributes: (updates: Partial<Record<string, number>>) => Promise<AttributesMap>;
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

const buildAttributeMap = (
  definitions: AttributeDefinition[],
  rows: ProfileAttribute[]
): AttributesMap => {
  const valueById = new Map(rows.map(entry => [entry.attribute_id, entry.value]));
  return definitions.reduce<AttributesMap>((accumulator, definition) => {
    const fallback = Number.isFinite(definition.default_value) ? definition.default_value : 0;
    const value = valueById.get(definition.id) ?? fallback;
    accumulator[definition.slug] = {
      definition,
      value: Number.isFinite(value) ? value : fallback
    };
    return accumulator;
  }, {});
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
  const [error, setError] = useState<string | null>(null);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const updateSelectedCharacterId = useCallback((characterId: string | null) => {
    persistCharacterId(characterId);
    setSelectedCharacterId(characterId);
  }, []);

  const clearSelectedCharacter = useCallback(() => {
    persistCharacterId(null);
    setSelectedCharacterId(null);
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
      }: PostgrestMaybeSingleResponse<Tables<"cities">> = await supabase
        .from("cities")
        .select("*")
        .eq("id", cityId)
        .maybeSingle();

      if (cityError && status !== 406) {
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

      const storedId = readStoredCharacterId();
      const hasStoredCharacter = storedId ? list.some(character => character.id === storedId) : false;
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStoredCharacter
        ? storedId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (fallbackId !== selectedCharacterId) {
        updateSelectedCharacterId(fallbackId);
      }

      if (!fallbackId) {
        clearSelectedCharacter();
      }

      return list;
    } catch (err: unknown) {
      console.error("Error fetching characters:", err);
      setError(extractErrorMessage(err));
      return [] as PlayerProfile[];
    } finally {
      setCharactersLoading(false);
    }
  }, [user, selectedCharacterId, updateSelectedCharacterId, clearSelectedCharacter]);

  const fetchGameData = useCallback(
    async (characterId?: string) => {
      if (!user) {
        clearSelectedCharacter();
        setDataLoading(false);
        setError(null);
        return;
      }

      const activeCharacterId = characterId ?? selectedCharacterId;
      if (!activeCharacterId) {
        clearSelectedCharacter();
        setDataLoading(false);
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

        const character = profileResponse.data ?? null;
        if (!character) {
          setError("The selected character could not be found.");
          updateSelectedCharacterId(null);
          await fetchCharacters();
          return;
        }

        setProfile(character);
        setCharacters(prev => {
          const others = prev.filter(existing => existing.id !== character.id);
          return [...others, character].sort((a, b) => a.slot_number - b.slot_number);
        });

        const definitions = skillDefinitionsResponse.data ?? [];
        setSkillDefinitions(definitions);

        const progressRows = (skillProgressResponse.data ?? []).map(row => ({
          ...row,
          skill_slug: row.skill_slug ?? definitions.find(def => def.id === row.skill_id)?.slug ?? row.skill_slug ?? null
        })) as SkillProgressRow[];
        setSkillProgress(progressRows);
        const latestProgressUpdate = progressRows.reduce<string | null>((latest, row) => {
          const candidate = row.updated_at ?? row.created_at ?? null;
          if (!candidate) {
            return latest;
          }

          return !latest || candidate > latest ? candidate : latest;
        }, null);
        setSkillsUpdatedAt(latestProgressUpdate);

        const unlockRows = (skillUnlocksResponse.data ?? []).map(row => ({
          ...row,
          skill_slug: row.skill_slug ?? definitions.find(def => def.id === row.skill_id)?.slug ?? row.skill_slug ?? null
        })) as SkillUnlockRow[];
        setSkillUnlockRows(unlockRows);

        const attributeDefs = attributeDefinitionsResponse.data ?? [];
        setAttributeDefinitions(attributeDefs);
        const profileAttributeRows = profileAttributesResponse.data ?? [];
        setAttributes(buildAttributeMap(attributeDefs, profileAttributeRows));

        if (activityResponse.error && activityResponse.status !== 406) {
          throw activityResponse.error;
        }
        setActivities(activityResponse.data ?? []);

        await resolveCurrentCity(character.current_city_id ?? null);
      } catch (err: unknown) {
        console.error("Error fetching game data:", err);
        setError(extractErrorMessage(err));
      } finally {
        setDataLoading(false);
      }
    },
    [
      user,
      selectedCharacterId,
      clearSelectedCharacter,
      updateSelectedCharacterId,
      fetchCharacters,
      resolveCurrentCity
    ]
  );

  useEffect(() => {
    if (!user) {
      setCharacters([]);
      clearSelectedCharacter();
      setCharactersLoading(false);
      setDataLoading(false);
      setError(null);
      return;
    }

    void fetchCharacters();
  }, [user, clearSelectedCharacter, fetchCharacters]);

  useEffect(() => {
    if (!selectedCharacterId) {
      clearSelectedCharacter();
      return;
    }

    void fetchGameData(selectedCharacterId);
  }, [selectedCharacterId, clearSelectedCharacter, fetchGameData]);

  const updateProfile = useCallback(
    async (updates: Partial<PlayerProfile>) => {
      if (!user) {
        throw new Error("You must be signed in to update a profile.");
      }

      const activeProfileId = selectedCharacterId;
      if (!activeProfileId) {
        throw new Error("No active character selected.");
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", activeProfileId)
        .select()
        .maybeSingle();

      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw updateError;
      }

      const nextProfile = data ?? null;
      if (nextProfile) {
        setProfile(nextProfile);
        setCharacters(prev => {
          const others = prev.filter(existing => existing.id !== nextProfile.id);
          return [...others, nextProfile].sort((a, b) => a.slot_number - b.slot_number);
        });
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

        if (upsertError) {
          console.error("Error unlocking skill:", upsertError);
          throw upsertError;
        }

        if (data) {
          const normalized = {
            ...data,
            skill_slug: data.skill_slug ?? definition.slug
          } as SkillUnlockRow;

          setSkillUnlockRows(prev => {
            const others = prev.filter(row => !(row.profile_id === activeProfileId && row.skill_id === definition.id));
            return [...others, normalized];
          });
        }
      } else {
        const { error: deleteError } = await supabase
          .from("profile_skill_unlocks")
          .delete()
          .eq("profile_id", activeProfileId)
          .eq("skill_id", definition.id);

        if (deleteError) {
          console.error("Error removing skill unlock:", deleteError);
          throw deleteError;
        }

        setSkillUnlockRows(prev => prev.filter(row => !(row.profile_id === activeProfileId && row.skill_id === definition.id)));
      }
    },
    [selectedCharacterId, skillDefinitions, user]
  );

  const updateSkills = useCallback(
    async (updates: Partial<PlayerSkills>) => {
      const entries = Object.entries(updates ?? {});
      const timestampEntry = entries.find(([key]) => key === "updated_at");
      const levelEntries = entries.filter(
        ([key, value]) => key !== "updated_at" && typeof value === "number"
      );

      if (timestampEntry && typeof timestampEntry[1] === "string") {
        const nextTimestamp = timestampEntry[1] as string;
        setSkillsUpdatedAt(prev => (!prev || nextTimestamp > prev ? nextTimestamp : prev));
      }

      if (levelEntries.length > 0) {
        await Promise.all(
          levelEntries.map(([slug, value]) => updateSkillLevel(slug, value as number))
        );
      }

      const nextSkills: PlayerSkills = { ...skills };
      if (timestampEntry && typeof timestampEntry[1] === "string") {
        nextSkills.updated_at = timestampEntry[1] as string;
      }

      levelEntries.forEach(([slug, value]) => {
        nextSkills[slug] = value as number;
      });

      return nextSkills;
    },
    [skills, updateSkillLevel]
  );

  const updateAttributes = useCallback(
    async (updates: Partial<Record<string, number>>) => {
      if (!user) {
        throw new Error("You must be signed in to update attributes.");
      }

      const activeProfileId = selectedCharacterId;
      if (!activeProfileId) {
        throw new Error("No active character selected.");
      }

      const entries = Object.entries(updates ?? {}).filter(([, value]) => typeof value === "number");
      if (entries.length === 0) {
        return attributes;
      }

      const payload = entries
        .map(([slug, value]) => {
          const definition = attributeDefinitions.find(def => def.slug === slug);
          if (!definition) {
            return null;
          }

          return {
            profile_id: activeProfileId,
            attribute_id: definition.id,
            value: value as number
          };
        })
        .filter((item): item is { profile_id: string; attribute_id: string; value: number } => Boolean(item));

      if (payload.length === 0) {
        return attributes;
      }

      const { data, error: upsertError } = await supabase
        .from("profile_attributes")
        .upsert(payload, { onConflict: "profile_id,attribute_id" })
        .select();

      if (upsertError) {
        console.error("Error updating attributes:", upsertError);
        throw upsertError;
      }

      const updatedRows = data ?? [];
      const nextAttributes: AttributesMap = { ...attributes };
      updatedRows.forEach(row => {
        const definition = attributeDefinitions.find(def => def.id === row.attribute_id);
        if (!definition) {
          return;
        }

        nextAttributes[definition.slug] = {
          definition,
          value: row.value
        };
      });

      setAttributes(nextAttributes);
      return nextAttributes;
    },
    [attributeDefinitions, attributes, selectedCharacterId, user]
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
      setError(null);

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

          if (attributeInsertError) throw attributeInsertError;
        }

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
      attributeDefinitions,
      profile,
      selectedCharacterId,
      setActiveCharacter,
      updateProfile,
      user
    ]
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

  const hasCharacters = useMemo(() => characters.length > 0, [characters]);
  const loading = useMemo(() => charactersLoading || dataLoading, [charactersLoading, dataLoading]);

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
