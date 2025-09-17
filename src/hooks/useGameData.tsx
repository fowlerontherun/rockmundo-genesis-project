import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import type { Tables } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type PlayerProfile = Tables<'profiles'>;
export type PlayerSkills = Tables<'player_skills'>;
export type ActivityItem = Tables<'activity_feed'>;

const CHARACTER_STORAGE_KEY = "rockmundo:selectedCharacterId";

const isPostgrestError = (error: unknown): error is PostgrestError =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  "code" in error;

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
  activities: ActivityItem[];
  loading: boolean;
  error: string | null;
  hasCharacters: boolean;
  setActiveCharacter: (characterId: string) => Promise<void>;
  clearSelectedCharacter: () => void;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<PlayerProfile | undefined>;
  updateSkills: (updates: Partial<PlayerSkills>) => Promise<PlayerSkills | undefined>;
  addActivity: (activityType: string, message: string, earnings?: number) => Promise<ActivityItem | undefined>;
  createCharacter: (input: CreateCharacterInput) => Promise<PlayerProfile>;
  refreshCharacters: () => Promise<PlayerProfile[]>;
  refetch: () => Promise<void>;
}

const GameDataContext = createContext<GameDataContextValue | undefined>(undefined);

const extractErrorMessage = (error: unknown) => {
  if (isPostgrestError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "An unknown error occurred.";
};

const sortCharacters = (characters: PlayerProfile[]) =>
  [...characters].sort((a, b) => a.slot_number - b.slot_number);

const useProvideGameData = (): GameDataContextValue => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<PlayerProfile[]>([]);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [skills, setSkills] = useState<PlayerSkills | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(CHARACTER_STORAGE_KEY);
  });

  const persistSelectedCharacterId = useCallback((characterId: string | null) => {
    if (typeof window === "undefined") return;

    if (characterId) {
      window.localStorage.setItem(CHARACTER_STORAGE_KEY, characterId);
    } else {
      window.localStorage.removeItem(CHARACTER_STORAGE_KEY);
    }
  }, []);

  const clearSelectedCharacter = useCallback(() => {
    setSelectedCharacterId(null);
    persistSelectedCharacterId(null);
  }, [persistSelectedCharacterId]);

  const updateSelectedCharacterId = useCallback((characterId: string | null) => {
    setSelectedCharacterId(characterId);
    persistSelectedCharacterId(characterId);
  }, [persistSelectedCharacterId]);

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
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('slot_number', { ascending: true });

      if (profilesError) throw profilesError;

      const list = sortCharacters(data ?? []);
      setCharacters(list);

      const hasStoredCharacter = list.some(character => character.id === selectedCharacterId);
      const activeCharacterId = list.find(character => character.is_active)?.id ?? null;
      const fallbackId = hasStoredCharacter
        ? selectedCharacterId
        : activeCharacterId ?? list[0]?.id ?? null;

      if (fallbackId !== selectedCharacterId) {
        updateSelectedCharacterId(fallbackId ?? null);
      }

      if (!fallbackId) {
        setProfile(null);
        setSkills(null);
        setActivities([]);
      }

      return list;
    } catch (err) {
      console.error('Error fetching characters:', err);
      setError(extractErrorMessage(err));
      return [] as PlayerProfile[];
    } finally {
      setCharactersLoading(false);
    }
  }, [user, selectedCharacterId, updateSelectedCharacterId, clearSelectedCharacter]);

  const fetchGameData = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setSkills(null);
      setActivities([]);
      setDataLoading(false);
      setError(null);
      return;
    }

    if (!selectedCharacterId) {
      setProfile(null);
      setSkills(null);
      setActivities([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setError(null);

    try {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', selectedCharacterId);

      if (profileError) throw profileError;

      const character = profileRows?.[0] ?? null;

      if (!character) {
        setProfile(null);
        setSkills(null);
        setActivities([]);
        setError('The selected character could not be found.');
        updateSelectedCharacterId(null);
        await fetchCharacters();
        return;
      }

      setProfile(character);
      setCharacters(prev => {
        const others = prev.filter(existing => existing.id !== character.id);
        return sortCharacters([...others, character]);
      });

      const { data: skillsRows, error: skillsError } = await supabase
        .from('player_skills')
        .select('*')
        .eq('profile_id', selectedCharacterId);

      if (skillsError) throw skillsError;

      setSkills(skillsRows?.[0] ?? null);

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
      setError(extractErrorMessage(err));
    } finally {
      setDataLoading(false);
    }
  }, [user, selectedCharacterId, updateSelectedCharacterId, fetchCharacters]);

  useEffect(() => {
    if (!user) {
      setCharacters([]);
      setProfile(null);
      setSkills(null);
      setActivities([]);
      setError(null);
      setCharactersLoading(false);
      setDataLoading(false);
      clearSelectedCharacter();
      return;
    }

    fetchCharacters();
  }, [user, fetchCharacters, clearSelectedCharacter]);

  useEffect(() => {
    if (!user) return;
    fetchGameData();
  }, [user, selectedCharacterId, fetchGameData]);

  const setActiveCharacter = useCallback(async (characterId: string) => {
    if (!user) {
      throw new Error('You must be signed in to switch characters.');
    }

    setCharactersLoading(true);

    try {
      await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('user_id', user.id);

      const { data, error: activationError } = await supabase
        .from('profiles')
        .update({ is_active: true })
        .eq('id', characterId)
        .select()
        .single();

      if (activationError) throw activationError;

      updateSelectedCharacterId(characterId);
      setCharacters(prev => sortCharacters(prev.map(character => ({
        ...character,
        is_active: character.id === characterId
      }))));
      setProfile(data ?? null);
    } catch (err) {
      console.error('Error activating character:', err);
      setError(extractErrorMessage(err));
      throw err;
    } finally {
      setCharactersLoading(false);
    }
  }, [user, updateSelectedCharacterId]);

  const updateProfile = useCallback(async (updates: Partial<PlayerProfile>) => {
    if (!user || !selectedCharacterId) {
      throw new Error('No active character selected.');
    }

    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', selectedCharacterId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw updateError;
    }

    if (!data) {
      throw new Error('No profile data returned from Supabase.');
    }

    setProfile(data);
    setCharacters(prev => sortCharacters(prev.map(character => character.id === data.id ? data : character)));
    return data;
  }, [user, selectedCharacterId]);

  const updateSkills = useCallback(async (updates: Partial<PlayerSkills>) => {
    if (!user || !selectedCharacterId) {
      throw new Error('No active character selected.');
    }

    const { data, error: updateError } = await supabase
      .from('player_skills')
      .update(updates)
      .eq('profile_id', selectedCharacterId)
      .select()
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

  const addActivity = useCallback(async (
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
  }, [user, selectedCharacterId]);

  const createCharacter = useCallback(async ({
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

      const { error: skillsInsertError } = await supabase
        .from('player_skills')
        .insert({
          user_id: user.id,
          profile_id: newProfile.id
        });

      if (skillsInsertError) throw skillsInsertError;

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
  }, [user, profile, selectedCharacterId, setActiveCharacter, updateProfile]);

  const refreshCharacters = useCallback(async () => fetchCharacters(), [fetchCharacters]);

  const refetch = useCallback(async () => {
    await fetchGameData();
  }, [fetchGameData]);

  const hasCharacters = useMemo(() => characters.length > 0, [characters]);
  const loading = useMemo(() => charactersLoading || dataLoading, [charactersLoading, dataLoading]);

  return {
    characters,
    selectedCharacterId,
    profile,
    skills,
    activities,
    loading,
    error,
    hasCharacters,
    setActiveCharacter,
    clearSelectedCharacter,
    updateProfile,
    updateSkills,
    addActivity,
    createCharacter,
    refreshCharacters,
    refetch
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
