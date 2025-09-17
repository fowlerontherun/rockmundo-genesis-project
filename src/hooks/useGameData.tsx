import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { PostgrestError, PostgrestMaybeSingleResponse, PostgrestResponse } from "@supabase/supabase-js";

export type PlayerProfile = Tables<'profiles'>;
export type PlayerSkills = Tables<'player_skills'>;
export type PlayerAttributes = Tables<'player_attributes'>;
export type ActivityItem = Tables<'activity_feed'>;
export type AttributeDefinition = Tables<'attribute_definitions'>;
export type ProfileAttribute = Tables<'profile_attributes'>;
export type SkillDefinition = Tables<'skill_definitions'>;
export type SkillProgressRow = Tables<'profile_skill_progress'>;
export type SkillUnlockRow = Tables<'profile_skill_unlocks'>;
export type SkillProgressInsert = TablesInsert<'profile_skill_progress'>;
export type SkillUnlockInsert = TablesInsert<'profile_skill_unlocks'>;

const CHARACTER_STORAGE_KEY = "rockmundo:selectedCharacterId";

type AttributeEntry = {
  definition: AttributeDefinition;
  value: number;
};

export type AttributesMap = Record<string, AttributeEntry>;

export type SkillProgressUpsertInput = Omit<
  SkillProgressInsert,
  "profile_id" | "user_id" | "id" | "created_at" | "updated_at"
> & {
  profile_id?: string;
  user_id?: string;
};

export type SkillUnlockUpsertInput = Omit<
  SkillUnlockInsert,
  "profile_id" | "user_id" | "id" | "created_at" | "updated_at"
> & {
  profile_id?: string;
  user_id?: string;
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
  currentCity: Tables<'cities'> | null;
  loading: boolean;
  error: string | null;
  currentCity: Tables<'cities'> | null;
  hasCharacters: boolean;
  skillDefinitions: SkillDefinition[];
  skillProgress: SkillProgressRow[];
  skillUnlocks: SkillUnlockRow[];
  setActiveCharacter: (characterId: string) => Promise<void>;
  clearSelectedCharacter: () => void;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | undefined>;
  updateSkills: (updates: Partial<PlayerSkills>) => Promise<PlayerSkills | undefined>;
  updateAttributes: (updates: Partial<PlayerAttributes>) => Promise<PlayerAttributes | undefined>;
  addActivity: (activityType: string, message: string, earnings?: number) => Promise<ActivityItem | undefined>;
  createCharacter: (input: CreateCharacterInput) => Promise<PlayerProfile>;
  refreshCharacters: () => Promise<PlayerProfile[]>;
  resetCharacter: () => Promise<void>;
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

const sortCharacters = (characters: PlayerProfile[]) =>
  [...characters].sort((a, b) => a.slot_number - b.slot_number);

const getStoredSelectedCharacterId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
  return storedValue ?? null;
};

const buildAttributeMap = (
  definitions: AttributeDefinition[],
  values: ProfileAttribute[]
): AttributesMap => {
  const valueByAttributeId = new Map(values.map(entry => [entry.attribute_id, entry.value]));
  return definitions.reduce<AttributesMap>((accumulator, definition) => {
    const fallback = Number.isFinite(definition.default_value) ? definition.default_value : 0;
    const resolvedValue = valueByAttributeId.get(definition.id) ?? fallback;
    accumulator[definition.slug] = {
      definition,
      value: Number.isFinite(resolvedValue) ? resolvedValue : fallback
    };
    return accumulator;
  }, {});
};

const useProvideGameData = (): GameDataContextValue => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => readStoredCharacterId());
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentCity, setCurrentCity] = useState<Tables<'cities'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skillDefinitions, setSkillDefinitions] = useState<SkillDefinition[]>([]);
  const [skillProgress, setSkillProgress] = useState<SkillProgressRow[]>([]);
  const [skillUnlocks, setSkillUnlocks] = useState<SkillUnlockRow[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
    () => getStoredSelectedCharacterId()
  );
  const [charactersLoading, setCharactersLoading] = useState<boolean>(false);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  const persistSelectedCharacterId = useCallback((characterId: string | null) => {
    if (typeof window === "undefined") {
      return characterId ?? null;
    }

    if (characterId) {
      window.localStorage.setItem(CHARACTER_STORAGE_KEY, characterId);
    } else {
      window.localStorage.removeItem(CHARACTER_STORAGE_KEY);
    }

    const storedValue = window.localStorage.getItem(CHARACTER_STORAGE_KEY);
    return storedValue ?? null;
  }, []);

  const clearSelectedCharacter = useCallback(() => {
    persistSelectedCharacterId(null);
    setSelectedCharacterId(null);
    setProfile(null);
    setSkills(null);
    setAttributes(null);
    setActivities([]);
    setCurrentCity(null);
    setSkillProgress([]);
    setSkillUnlocks([]);
  }, [persistSelectedCharacterId]);

  const updateSelectedCharacterId = useCallback(
    (characterId: string | null) => {
      const storedValue = persistSelectedCharacterId(characterId);
      setSelectedCharacterId(storedValue);
    },
    [persistSelectedCharacterId]
  );

  useEffect(() => {
    if (skillDefinitions.length > 0) {
      return;
    }

    const fetchSkillDefinitions = async () => {
      const { data, error } = await supabase
        .from('skill_definitions')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching skill definitions:', error);
        return;
      }

      setSkillDefinitions(data ?? []);
    };

    void fetchSkillDefinitions();
  }, [skillDefinitions.length]);

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
      }: PostgrestMaybeSingleResponse<Tables<'cities'>> = await supabase
        .from('cities')
        .select('*')
        .eq('id', cityId)
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

  const fetchCharacters = useCallback(async () => {
    if (!user) {
      setCharacters([]);
      setCharactersLoading(false);
      clearSelectedCharacter();
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
      setSkillProgress([]);
      setSkillUnlocks([]);
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
      setSkillProgress([]);
      setSkillUnlocks([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setError(null);

    try {
      const [
        profileResponse,
        skillsResponse,
        definitionsResponse,
        profileAttributesResponse,
        activityResponse,
        skillDefinitionsResponse,
        skillProgressResponse,
        skillUnlocksResponse
      ] = (await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', selectedCharacterId)
          .maybeSingle(),
        supabase
          .from('player_skills')
          .select('*')
          .eq('profile_id', selectedCharacterId)
          .maybeSingle(),
        supabase.from('attribute_definitions').select('*').order('slug', { ascending: true }),
        supabase.from('profile_attributes').select('*').eq('profile_id', selectedCharacterId),
        supabase
          .from('activity_feed')
          .select('*')
          .eq('profile_id', selectedCharacterId)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('skill_definitions')
          .select('*')
          .order('sort_order', { ascending: true }),
        supabase
          .from('profile_skill_progress')
          .select('*')
          .eq('profile_id', selectedCharacterId),
        supabase
          .from('profile_skill_unlocks')
          .select('*')
          .eq('profile_id', selectedCharacterId)
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

      setCharacters(prev => {
        const others = prev.filter(existing => existing.id !== character.id);
        return sortCharacters([...others, character]);
      });

      if (skillDefinitionsResponse.error && skillDefinitionsResponse.status !== 406) {
        throw skillDefinitionsResponse.error;
      }

      if (skillProgressResponse.error) {
        throw skillProgressResponse.error;
      }

      if (skillUnlocksResponse.error) {
        throw skillUnlocksResponse.error;
      }

      setSkillDefinitions(skillDefinitionsResponse.data ?? []);
      setSkillProgress(skillProgressResponse.data ?? []);
      setSkillUnlocks(skillUnlocksResponse.data ?? []);

      const definitions = definitionsResponse.data ?? [];
      setAttributeDefinitions(definitions);

      const profileAttributeRows = profileAttributesResponse.data ?? [];
      setAttributes(buildAttributeMap(definitions, profileAttributeRows));

      const { data: attributeRows, error: attributesError } = await supabase
        .from('player_attributes')
        .select('*')
        .eq('profile_id', selectedCharacterId);

      if (attributesError) throw attributesError;

      let attributesData = attributeRows?.[0] ?? null;

      if (!attributesData) {
        const { data: insertedAttributes, error: insertAttributesError } = await supabase
          .from('player_attributes')
          .insert({
            user_id: character.user_id,
            profile_id: character.id,
          })
          .select()
          .single();

        if (insertAttributesError) throw insertAttributesError;

        attributesData = insertedAttributes;
      }

      const { data: activityRows, error: activityError } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('profile_id', selectedCharacterId)
        .order('created_at', { ascending: false })
        .limit(10);

      setSkills(skillsResponse.data ?? null);

      if (activityResponse.error && activityResponse.status !== 406) {
        throw activityResponse.error;
      }

      setActivities(activityResponse.data ?? []);
      setProfile(character);
      setSkills(skillsData);
      setAttributes(attributesData);
      setActivities(activitiesData);
      await resolveCurrentCity(character.current_city_id ?? null);
    } catch (err: unknown) {
      console.error("Error fetching game data:", err);
      setError(extractErrorMessage(err));
    } finally {
      setDataLoading(false);
    }
  }, [user, selectedCharacterId, resolveCurrentCity, updateSelectedCharacterId, fetchCharacters]);

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
  }, [clearSelectedCharacter, fetchCharacters, user]);

  const addActivity = useCallback(
    async (
      activityType: string,
      message: string,
      earnings: number = 0,
      metadata?: ActivityItem['metadata']
    ) => {
      if (!user || !selectedCharacterId) {
        throw new Error('No active character selected.');
      }

      const { data, error: insertError } = await supabase
        .from('activity_feed')
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
        console.error('Error adding activity:', insertError);
        throw insertError;
      }

      if (!data) {
        throw new Error('No activity data returned from Supabase.');
      }

      setActivities(prev => [data, ...prev.slice(0, 9)]);
      return data;
    },
    [user, selectedCharacterId]
  );

  const upsertSkillProgress = useCallback(
    async (profileId: string, entries: SkillProgressUpsertInput[]) => {
      if (!user) {
        throw new Error('You must be signed in to update skill progress.');
      }

      if (!profileId) {
        throw new Error('A profile id is required to update skill progress.');
      }

      if (!Array.isArray(entries) || entries.length === 0) {
        return profileId === selectedCharacterId ? skillProgress : [];
      }

      const payload: SkillProgressInsert[] = entries
        .filter(entry => Boolean(entry.skill_id))
        .map(entry => ({
          current_level: entry.current_level ?? 0,
          current_xp: entry.current_xp ?? 0,
          skill_id: entry.skill_id!,
          profile_id: entry.profile_id ?? profileId,
          user_id: entry.user_id ?? user.id,
        }));

      if (payload.length === 0) {
        return profileId === selectedCharacterId ? skillProgress : [];
      }

      const { data, error } = await supabase
        .from('profile_skill_progress')
        .upsert(payload, { onConflict: 'profile_id,skill_id' })
        .select();

      if (error) {
        console.error('Error updating skill progress:', error);
        throw error;
      }

      if (profileId === selectedCharacterId) {
        setSkillProgress(data ?? []);
      }

      return data ?? [];
    },
    [selectedCharacterId, skillProgress, user]
  );

  const upsertSkillUnlocks = useCallback(
    async (profileId: string, entries: SkillUnlockUpsertInput[]) => {
      if (!user) {
        throw new Error('You must be signed in to update skill unlocks.');
      }

      if (!profileId) {
        throw new Error('A profile id is required to update skill unlocks.');
      }

      if (!Array.isArray(entries) || entries.length === 0) {
        return profileId === selectedCharacterId ? skillUnlocks : [];
      }

      const payload: SkillUnlockInsert[] = entries
        .filter(entry => Boolean(entry.skill_id))
        .map(entry => ({
          skill_id: entry.skill_id!,
          is_unlocked: entry.is_unlocked ?? false,
          unlocked_at: entry.unlocked_at ?? (entry.is_unlocked ? new Date().toISOString() : null),
          profile_id: entry.profile_id ?? profileId,
          user_id: entry.user_id ?? user.id,
        }));

      if (payload.length === 0) {
        return profileId === selectedCharacterId ? skillUnlocks : [];
      }

      const { data, error } = await supabase
        .from('profile_skill_unlocks')
        .upsert(payload, { onConflict: 'profile_id,skill_id' })
        .select();

      if (error) {
        console.error('Error updating skill unlocks:', error);
        throw error;
      }

      if (profileId === selectedCharacterId) {
        setSkillUnlocks(data ?? []);
      }

      return data ?? [];
    },
    [selectedCharacterId, skillUnlocks, user]
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
        throw new Error('You must be signed in to create a character.');
      }

      setCharactersLoading(true);
      setError(null);

      try {
        if (unlockCost > 0) {
          if (!profile || (profile.cash ?? 0) < unlockCost) {
            throw new Error('You do not have enough cash to unlock this character slot.');
          }

          await updateProfile({ cash: (profile.cash ?? 0) - unlockCost });
        }

        const { data: newProfile, error: profileInsertError } = await supabase
          .from('profiles')
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
        if (!newProfile) throw new Error('Failed to create character profile.');

        if (skillDefinitions.length > 0) {
          const defaultProgressEntries: SkillProgressUpsertInput[] = skillDefinitions.map(
            definition => ({
              skill_id: definition.id,
              current_level: definition.starting_level ?? 1,
              current_xp: definition.starting_experience ?? 0,
            })
          );

          const defaultUnlockEntries: SkillUnlockUpsertInput[] = skillDefinitions.map(definition => {
            const unlocked = Boolean(definition.is_default_unlocked);
            return {
              skill_id: definition.id,
              is_unlocked: unlocked,
              unlocked_at: unlocked ? new Date().toISOString() : null,
            };
          });

          await Promise.all([
            upsertSkillProgress(newProfile.id, defaultProgressEntries),
            upsertSkillUnlocks(newProfile.id, defaultUnlockEntries)
          ]);
        } else {
          setSkillProgress([]);
          setSkillUnlocks([]);
        }

        if (attributeDefinitions.length > 0) {
          const attributePayload = attributeDefinitions.map(definition => ({
            profile_id: newProfile.id,
            attribute_id: definition.id,
            value: definition.default_value
          }));

          const { error: attributeInsertError } = await supabase
            .from('profile_attributes')
            .upsert(attributePayload, { onConflict: 'profile_id,attribute_id' });

          if (attributeInsertError) throw attributeInsertError;
        }

        setCharacters(prev => sortCharacters([...prev, newProfile]));

        if (makeActive || !selectedCharacterId) {
          await setActiveCharacter(newProfile.id);
        }

        return newProfile;
      } catch (err) {
        console.error('Error creating character:', err);
        setError(extractErrorMessage(err));
        throw err;
      } finally {
        setCharactersLoading(false);
      }
    },
    [
      user,
      profile,
      attributeDefinitions,
      updateProfile,
      selectedCharacterId,
      setActiveCharacter,
      skillDefinitions,
      upsertSkillProgress,
      upsertSkillUnlocks
    ]
  );

  const refreshCharacters = useCallback(() => fetchCharacters(), [fetchCharacters]);

  const refetch = useCallback(() => fetchGameData(), [fetchGameData]);

  const resetCharacter = useCallback(async () => {
    if (!user) {
      throw new Error('You must be signed in to reset a character.');
    }

    const { data, error: resetError } = await supabase.rpc('reset_player_character');

    if (resetError) {
      console.error('Error resetting character:', resetError);
      throw resetError;
    }

    const result = data?.[0];
    if (!result) {
      throw new Error('Reset did not return any character data.');
    }

    const nextProfileId = result?.profile?.id ?? null;
    if (nextProfileId) {
      updateSelectedCharacterId(nextProfileId);
    } else {
      clearSelectedCharacter();
    }

    await fetchCharacters();
    await fetchGameData();
  }, [user, updateSelectedCharacterId, clearSelectedCharacter, fetchCharacters, fetchGameData]);

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
    skillDefinitions,
    skillProgress,
    skillUnlocks,
    currentCity,
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
    upsertSkillProgress,
    upsertSkillUnlocks
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
