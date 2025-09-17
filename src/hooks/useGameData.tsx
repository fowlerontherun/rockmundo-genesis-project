import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type PlayerProfile = Tables<'profiles'>;
export type PlayerSkills = Tables<'player_skills'>;
export type PlayerAttributes = Tables<'player_attributes'>;
export type ActivityItem = Tables<'activity_feed'>;
type City = Tables<'cities'>;

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
  skills: PlayerSkills | null;
  attributes: PlayerAttributes | null;
  activities: ActivityItem[];
  currentCity: City | null;
  loading: boolean;
  error: string | null;
  hasCharacters: boolean;
  setActiveCharacter: (characterId: string) => Promise<void>;
  clearSelectedCharacter: () => void;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | null>;
  updateSkills: (updates: Partial<PlayerSkills>) => Promise<PlayerSkills | null>;
  updateAttributes: (updates: Partial<PlayerAttributes>) => Promise<PlayerAttributes | null>;
  addActivity: (
    activityType: string,
    message: string,
    earnings?: number,
    metadata?: ActivityItem["metadata"],
  ) => Promise<ActivityItem | null>;
  createCharacter: (input: CreateCharacterInput) => Promise<PlayerProfile>;
  refreshCharacters: () => Promise<PlayerProfile[]>;
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

const isNotFoundError = (error: PostgrestError | null) =>
  Boolean(error && error.code === "PGRST116");

const useProvideGameData = (): GameDataContextValue => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => getStoredCharacterId());
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [attributes, setAttributes] = useState<PlayerAttributes | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentCity, setCurrentCity] = useState<City | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  const setSelectedCharacter = useCallback((characterId: string | null) => {
    setSelectedCharacterId(characterId);
    persistSelectedCharacterId(characterId);
  }, []);

  const clearSelectedCharacter = useCallback(() => {
    setSelectedCharacter(null);
    setProfile(null);
    setSkills(null);
    setAttributes(null);
    setActivities([]);
    setCurrentCity(null);
  }, [setSelectedCharacter]);

  const fetchCharacters = useCallback(async () => {
    if (!user) {
      clearSelectedCharacter();
      setCharacters([]);
      return [] as PlayerProfile[];
    }

    setCharactersLoading(true);

    try {
      const { data, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('slot_number', { ascending: true });

      if (profilesError) throw profilesError;

      const list = sortCharacters(data ?? []);
      setCharacters(list);

      const hasStoredSelection = list.some(character => character.id === selectedCharacterId);
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStoredSelection
        ? selectedCharacterId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (fallbackId !== selectedCharacterId) {
        setSelectedCharacter(fallbackId ?? null);
      }

      return list;
    } catch (err) {
      console.error('Error fetching characters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load characters.');
      return [] as PlayerProfile[];
    } finally {
      setCharactersLoading(false);
    }
  }, [user, selectedCharacterId, clearSelectedCharacter, setSelectedCharacter]);

  const fetchCity = useCallback(async (cityId: string | null) => {
    if (!cityId) {
      setCurrentCity(null);
      return null;
    }

    const { data, error: cityError } = await supabase
      .from('cities')
      .select('*')
      .eq('id', cityId)
      .maybeSingle();

    if (cityError && !isNotFoundError(cityError)) {
      console.error('Error fetching current city:', cityError);
      setCurrentCity(null);
      return null;
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
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', selectedCharacterId)
        .single();

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

      let nextSkills = skillsRow ?? null;
      if (!nextSkills) {
        const { data: insertedSkills, error: insertSkillsError } = await supabase
          .from('player_skills')
          .insert({
            user_id: user.id,
            profile_id: selectedCharacterId,
          })
          .select('*')
          .single();

        if (insertSkillsError) throw insertSkillsError;
        nextSkills = insertedSkills;
      }

      setSkills(nextSkills);

      const { data: attributesRow, error: attributesError } = await supabase
        .from('player_attributes')
        .select('*')
        .eq('profile_id', selectedCharacterId)
        .maybeSingle();

      if (attributesError && !isNotFoundError(attributesError)) throw attributesError;

      let nextAttributes = attributesRow ?? null;
      if (!nextAttributes) {
        const { data: insertedAttributes, error: insertAttributesError } = await supabase
          .from('player_attributes')
          .insert({
            user_id: user.id,
            profile_id: selectedCharacterId,
          })
          .select('*')
          .single();

        if (insertAttributesError) throw insertAttributesError;
        nextAttributes = insertedAttributes;
      }

      setAttributes(nextAttributes);

      const { data: activityRows, error: activityError } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('profile_id', selectedCharacterId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (activityError) throw activityError;

      setActivities(activityRows ?? []);
    } catch (err) {
      console.error('Error fetching game data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load character data.');
    } finally {
      setDataLoading(false);
    }
  }, [user, selectedCharacterId, fetchCity]);

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
      return;
    }

    void fetchGameData();
  }, [selectedCharacterId, user, fetchGameData]);

  const updateProfile = useCallback(async (updates: Partial<PlayerProfile>) => {
    if (!user || !selectedCharacterId) {
      throw new Error('No active character selected.');
    }

    const payload = {
      ...updates,
      updated_at: (updates as { updated_at?: string }).updated_at ?? new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', selectedCharacterId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw updateError;
    }

    if (!data) {
      throw new Error('No profile data returned from Supabase.');
    }

    setProfile(data);

    if ('current_city_id' in payload) {
      void fetchCity(payload.current_city_id ?? null);
    }

    setCharacters(prev =>
      prev.map(character => (character.id === data.id ? data : character))
    );

    return data;
  }, [user, selectedCharacterId, fetchCity]);

  const updateSkills = useCallback(async (updates: Partial<PlayerSkills>) => {
    if (!user || !selectedCharacterId) {
      throw new Error('No active character selected.');
    }

    const payload = {
      ...updates,
      updated_at: (updates as { updated_at?: string }).updated_at ?? new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from('player_skills')
      .update(payload)
      .eq('profile_id', selectedCharacterId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating skills:', updateError);
      throw updateError;
    }

    if (!data) {
      throw new Error('No skill data returned from Supabase.');
    }

    setSkills(data);
    return data;
  }, [user, selectedCharacterId]);

  const updateAttributes = useCallback(async (updates: Partial<PlayerAttributes>) => {
    if (!user || !selectedCharacterId) {
      throw new Error('No active character selected.');
    }

    const payload = {
      ...updates,
      updated_at: (updates as { updated_at?: string }).updated_at ?? new Date().toISOString(),
    };

    const { data, error: updateError } = await supabase
      .from('player_attributes')
      .update(payload)
      .eq('profile_id', selectedCharacterId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating attributes:', updateError);
      throw updateError;
    }

    if (!data) {
      throw new Error('No attribute data returned from Supabase.');
    }

    setAttributes(data);
    return data;
  }, [user, selectedCharacterId]);

  const addActivity = useCallback(async (
    activityType: string,
    message: string,
    earnings: number = 0,
    metadata?: ActivityItem['metadata'],
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
        metadata: metadata ?? null,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error adding activity:', insertError);
      throw insertError;
    }

    if (!data) {
      throw new Error('No activity data returned from Supabase.');
    }

    setActivities(prev => [data, ...prev].slice(0, 10));
    return data;
  }, [user, selectedCharacterId]);

  const setActiveCharacter = useCallback(async (characterId: string) => {
    if (!user) {
      throw new Error('You must be signed in to switch characters.');
    }

    await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('user_id', user.id);

    const { data, error: activationError } = await supabase
      .from('profiles')
      .update({ is_active: true })
      .eq('id', characterId)
      .select('*')
      .single();

    if (activationError) {
      console.error('Error activating character:', activationError);
      throw activationError;
    }

    if (!data) {
      throw new Error('Failed to activate character.');
    }

    setSelectedCharacter(characterId);
    setCharacters(prev => sortCharacters(prev.map(character => (
      character.id === data.id
        ? data
        : { ...character, is_active: false }
    ))));
    setProfile(data);
    await fetchGameData();
  }, [user, fetchGameData, setSelectedCharacter]);

  const createCharacter = useCallback(async ({
    username,
    displayName,
    slotNumber,
    unlockCost,
    makeActive = false,
  }: CreateCharacterInput) => {
    if (!user) {
      throw new Error('You must be signed in to create a character.');
    }

    setCharactersLoading(true);

    try {
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          username,
          display_name: displayName,
          slot_number: slotNumber,
          unlock_cost: unlockCost,
          is_active: makeActive,
        })
        .select('*')
        .single();

      if (profileError) throw profileError;
      if (!newProfile) throw new Error('Failed to create character profile.');

      const { error: skillsError } = await supabase
        .from('player_skills')
        .insert({
          user_id: user.id,
          profile_id: newProfile.id,
        });

      if (skillsError) throw skillsError;

      const { error: attributesError } = await supabase
        .from('player_attributes')
        .insert({
          user_id: user.id,
          profile_id: newProfile.id,
        });

      if (attributesError) throw attributesError;

      setCharacters(prev => sortCharacters([...prev, newProfile]));

      if (makeActive || !selectedCharacterId) {
        setSelectedCharacter(newProfile.id);
        await fetchGameData();
      }

      return newProfile;
    } catch (err) {
      console.error('Error creating character:', err);
      setError(err instanceof Error ? err.message : 'Failed to create character.');
      throw err;
    } finally {
      setCharactersLoading(false);
    }
  }, [user, selectedCharacterId, fetchGameData, setSelectedCharacter]);

  const refreshCharacters = useCallback(async () => {
    return fetchCharacters();
  }, [fetchCharacters]);

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

export const useGameData = (): GameDataContextValue => {
  const context = useContext(GameDataContext);
  if (!context) {
    throw new Error('useGameData must be used within a GameDataProvider');
  }
  return context;
};
